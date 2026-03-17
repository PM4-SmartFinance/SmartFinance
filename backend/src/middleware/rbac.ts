import { FastifyReply, FastifyRequest } from "fastify";

export const ROLES = {
  ADMIN: 2,
  USER: 1,
} as const;

export type RoleType = keyof typeof ROLES;

export function requireRole(requiredRole: RoleType) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.session.get("user");
    if (!user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const hasRole = ROLES[user.role as RoleType] >= ROLES[requiredRole];
    if (!hasRole) {
      return reply.status(403).send({ error: "Forbidden" });
    }
  };
}
