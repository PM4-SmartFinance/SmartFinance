import type { FastifyInstance } from "fastify";
import { requireRole, requireOwnerOrAdmin } from "../middleware/rbac.js";
import * as userService from "../services/user.service.js";
interface UserParams {
  id: string;
}

interface UserQuery {
  limit?: string;
  offset?: string;
}

interface UpdateUserBody {
  name?: string;
  role?: "ADMIN" | "USER";
  active?: boolean;
  [key: string]: unknown;
}
const patchUserSchema = {
  body: {
    type: "object",
    properties: {
      name: { type: "string", maxLength: 255 },
      role: { type: "string", enum: ["ADMIN", "USER"] },
      active: { type: "boolean" },
    },
    additionalProperties: false,
    minProperties: 1,
  },
};

export async function userRoutes(app: FastifyInstance) {
  app.get<{ Querystring: UserQuery }>(
    "/users",
    { preHandler: requireRole("ADMIN") },
    async (request, reply) => {
      // No more casting! request.query is now typed as UserQuery
      const { limit, offset } = request.query;
      const sessionUser = request.session.get("user") ?? null;

      const res = await userService.listUsers(sessionUser, {
        limit: limit ? Number(limit) : 50,
        offset: offset ? Number(offset) : 0,
      });
      return reply.send(res);
    },
  );

  app.get<{ Params: UserParams }>(
    "/users/:id",
    { preHandler: requireOwnerOrAdmin("id") },
    async (request, reply) => {
      const { id } = request.params;
      const sessionUser = request.session.get("user") ?? null;
      const user = await userService.getUserById(sessionUser, id);
      return reply.send({ user });
    },
  );

  app.patch<{ Params: UserParams; Body: UpdateUserBody }>(
    "/users/:id",
    { preHandler: requireOwnerOrAdmin("id"), schema: patchUserSchema },
    async (request, reply) => {
      const { id } = request.params;
      const payload = request.body;
      const sessionUser = request.session.get("user") ?? null;
      const updated = await userService.updateUser(sessionUser, id, payload);
      return reply.send({ user: updated });
    },
  );

  app.delete<{ Params: UserParams }>(
    "/users/:id",
    { preHandler: requireOwnerOrAdmin("id") },
    async (request, reply) => {
      const { id } = request.params;
      const sessionUser = request.session.get("user") ?? null;
      await userService.deleteUser(sessionUser, id);
      return reply.status(204).send();
    },
  );
}
