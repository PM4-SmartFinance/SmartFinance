import type { FastifyRequest } from "fastify";
import type { SessionData } from "@fastify/secure-session";
import { ServiceError } from "../errors.js";
import { prisma } from "../prisma.js";
import * as auditService from "../services/audit.service.js";

type SessionUser = SessionData["user"];

/**
 * Memoises verifySession's result for the lifetime of a single request so
 * chained preHandlers + handler reads don't fan out into multiple DB reads.
 * Keyed on the request object — entries are GC'd when the request finishes.
 */
const verifiedUserCache = new WeakMap<FastifyRequest, SessionUser>();

/**
 * Extract the authenticated user from the session.
 *
 * **Precondition:** must only be called inside a route guarded by
 * `requireRole` (or `requireOwnerOrAdmin`). Those preHandlers already throw
 * 401 when no session exists, so the throw below is a defensive backstop —
 * it should never fire in correctly-wired routes. Calling this from an
 * unguarded route is a bug: the helper alone does not constitute auth.
 *
 * @returns the typed, non-null session user — no `!` assertion needed.
 * @throws {ServiceError} 401 if no session exists (defensive).
 */
export function getSessionUser(request: FastifyRequest) {
  const user = request.session.get("user");
  if (!user) throw new ServiceError(401, "Unauthorized");
  return user;
}

export const ROLES = {
  ADMIN: 2,
  USER: 1,
} as const;

export type RoleType = keyof typeof ROLES;

/**
 * Number of trailing chars of the Argon2 hash kept on the session as a
 * password-version stamp. Must match `PWD_VERSION_LENGTH` in auth.service.
 * Changing this length silently re-issues colliding versions for users with
 * existing sessions — bump only alongside a forced session-wide invalidation.
 */
const PWD_VERSION_LENGTH = 10;

/**
 * Re-verifies the session against the database on every protected request.
 *
 * Three conditions force a 401 + `request.session.delete()`:
 *   1. The user record was deleted (`!dbUser`).
 *   2. The account was deactivated (`!dbUser.active`).
 *   3. The password has changed since the session was issued (the session's
 *      `pwdVersion` no longer matches the trailing slice of the stored hash),
 *      OR the session predates this feature and carries no `pwdVersion` at
 *      all — fail closed and force a single re-login.
 *
 * Each forced eviction emits an audit event so the trail is preserved.
 *
 * Result is memoised per-request via `verifiedUserCache` so chained
 * preHandlers + handler reads do not multiply DB lookups.
 */
export async function verifySession(request: FastifyRequest): Promise<SessionUser> {
  const cached = verifiedUserCache.get(request);
  if (cached) return cached;

  const user = request.session.get("user");
  if (!user) {
    throw new ServiceError(401, "Unauthorized");
  }

  const dbUser = await prisma.dimUser.findUnique({
    where: { id: user.id },
    select: { active: true, password: true, role: true },
  });

  if (!dbUser) {
    void auditService.logEvent({
      action: "SESSION_INVALIDATED",
      userId: user.id,
      reason: "user_missing",
    });
    request.session.delete();
    throw new ServiceError(401, "Unauthorized");
  }

  if (!dbUser.active) {
    void auditService.logEvent({
      action: "SESSION_INVALIDATED",
      userId: user.id,
      reason: "user_inactive",
    });
    request.session.delete();
    throw new ServiceError(401, "Unauthorized");
  }

  // Fail closed: a session without `pwdVersion` predates this feature and
  // cannot be revalidated against the current password — force re-login.
  if (!user.pwdVersion || user.pwdVersion !== dbUser.password.slice(-PWD_VERSION_LENGTH)) {
    void auditService.logEvent({
      action: "SESSION_INVALIDATED",
      userId: user.id,
      reason: user.pwdVersion ? "pwd_version_mismatch" : "pwd_version_missing",
    });
    request.session.delete();
    throw new ServiceError(401, "Session expired");
  }

  verifiedUserCache.set(request, user);
  return user;
}

export function requireRole(requiredRole: RoleType) {
  return async (request: FastifyRequest) => {
    const user = await verifySession(request);

    if (!(user.role in ROLES)) {
      throw new ServiceError(403, "Forbidden");
    }
    const hasRole = ROLES[user.role as RoleType] >= ROLES[requiredRole];
    if (!hasRole) {
      throw new ServiceError(403, "Forbidden");
    }
  };
}

export function requireOwnerOrAdmin(paramIdName = "id") {
  return async (request: FastifyRequest) => {
    const user = await verifySession(request);

    if (!(user.role in ROLES)) {
      throw new ServiceError(403, "Forbidden");
    }
    // Admins are always allowed
    if (user.role && ROLES[user.role as RoleType] >= ROLES["ADMIN"]) {
      return;
    }
    // Avoid using `any` to satisfy ESLint - treat params as unknown and narrow
    const params = (request as unknown as { params?: Record<string, string> }).params ?? {};
    const targetId = params[paramIdName];
    if (!targetId) {
      throw new ServiceError(400, "Missing target id");
    }
    if (user.id !== targetId) {
      throw new ServiceError(403, "Forbidden");
    }
  };
}
