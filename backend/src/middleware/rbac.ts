import type { FastifyRequest } from "fastify";
import { ServiceError } from "../errors.js";

export const ROLES = {
  ADMIN: 2,
  USER: 1,
} as const;

export type RoleType = keyof typeof ROLES;

export function requireRole(requiredRole: RoleType) {
  return async (request: FastifyRequest) => {
    const user = request.session.get("user");
    if (!user) {
      throw new ServiceError(401, "Unauthorized");
    }
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
    const user = request.session.get("user");
    if (!user) {
      throw new ServiceError(401, "Unauthorized");
    }
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
