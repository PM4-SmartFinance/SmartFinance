import type { FastifyInstance } from "fastify";
import { requireRole, requireOwnerOrAdmin } from "../middleware/rbac.js";
import { ServiceError } from "../errors.js";
import * as userService from "../services/user.service.js";

interface UserParams {
  id: string;
}

interface UserQuery {
  limit: number;
  offset: number;
  active?: boolean;
}

const listUsersSchema = {
  querystring: {
    type: "object",
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
      offset: { type: "integer", minimum: 0, default: 0 },
      active: { type: "boolean" },
    },
    additionalProperties: false,
  },
};

interface UpdateUserBody {
  name?: string;
  role?: "ADMIN" | "USER";
  active?: boolean;
}

interface UpdateProfileBody {
  displayName?: string;
  email?: string;
}

interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
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

const updateProfileSchema = {
  type: "object",
  properties: {
    displayName: { type: "string", minLength: 1, maxLength: 100 },
    email: { type: "string", pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" },
  },
  additionalProperties: false,
} as const;

const changePasswordSchema = {
  type: "object",
  required: ["currentPassword", "newPassword"],
  properties: {
    currentPassword: { type: "string", minLength: 1 },
    newPassword: { type: "string", minLength: 8 },
  },
  additionalProperties: false,
} as const;

export async function userRoutes(app: FastifyInstance): Promise<void> {
  // --- Profile routes (from develop) ---

  app.get("/users/me", { preHandler: requireRole("USER") }, async (request, reply) => {
    const sessionUser = request.session.get("user");
    if (!sessionUser) throw new ServiceError(401, "Unauthorized");

    const profile = await userService.getProfile(sessionUser.id);
    return reply.send({ user: profile });
  });

  app.patch<{ Body: UpdateProfileBody }>(
    "/users/me",
    { preHandler: requireRole("USER"), schema: { body: updateProfileSchema } },
    async (request, reply) => {
      const sessionUser = request.session.get("user");
      if (!sessionUser) throw new ServiceError(401, "Unauthorized");

      const { displayName, email } = request.body;
      const updated = await userService.updateProfile(sessionUser.id, {
        ...(displayName !== undefined && { displayName }),
        ...(email !== undefined && { email }),
      });

      // Refresh session so subsequent /auth/me calls return the new email
      if (updated && email !== undefined) {
        request.session.set("user", {
          id: sessionUser.id,
          role: sessionUser.role,
          email: updated.email,
        });
      }

      return reply.send({ user: updated });
    },
  );

  app.post<{ Body: ChangePasswordBody }>(
    "/users/me/change-password",
    { preHandler: requireRole("USER"), schema: { body: changePasswordSchema } },
    async (request, reply) => {
      const sessionUser = request.session.get("user");
      if (!sessionUser) throw new ServiceError(401, "Unauthorized");

      await userService.changePassword(
        sessionUser.id,
        request.body.currentPassword,
        request.body.newPassword,
      );

      // Invalidate the current session — client must re-authenticate
      request.session.delete();

      return reply.send({ ok: true });
    },
  );

  // --- CRUD routes (KAN-74 & KAN-75) ---

  const createUserSchema = {
    body: {
      type: "object",
      required: ["email", "password"],
      properties: {
        email: { type: "string", pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" },
        password: { type: "string", minLength: 8 },
        displayName: { type: "string", minLength: 1, maxLength: 100 },
        role: { type: "string", enum: ["ADMIN", "USER"] },
      },
      additionalProperties: false,
    },
  };

  app.post<{ Body: { email: string; password: string; displayName?: string; role?: string } }>(
    "/users",
    { schema: createUserSchema },
    async (request, reply) => {
      const sessionUser = request.session.get("user") ?? null;
      const user = await userService.onboardUser(sessionUser, request.body);
      return reply.status(201).send({ user });
    },
  );

  app.get<{ Querystring: UserQuery }>(
    "/users",
    { preHandler: requireRole("ADMIN"), schema: listUsersSchema },
    async (request, reply) => {
      // Fastify schema guarantees these are numbers/boolean
      const { limit, offset, active } = request.query;
      const sessionUser = request.session.get("user") ?? null;

      const res = await userService.listUsers(sessionUser, {
        limit,
        offset,
        ...(active !== undefined && { active }),
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
