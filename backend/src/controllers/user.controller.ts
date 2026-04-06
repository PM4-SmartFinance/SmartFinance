import type { FastifyInstance } from "fastify";
import { requireRole } from "../middleware/rbac.js";
import { ServiceError } from "../errors.js";
import * as userService from "../services/user.service.js";

interface UpdateProfileBody {
  displayName?: string;
  email?: string;
}

interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

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
}
