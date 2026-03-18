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
