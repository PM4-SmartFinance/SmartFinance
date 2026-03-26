import type { FastifyInstance } from "fastify";
import * as authService from "../services/auth.service.js";
import { ServiceError } from "../errors.js";

interface AuthBody {
  email: string;
  password: string;
}

const authBodySchema = {
  type: "object",
  required: ["email", "password"],
  properties: {
    email: { type: "string", pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" },
    password: { type: "string", minLength: 8 },
  },
} as const;

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: AuthBody }>(
    "/auth/register",
    { schema: { body: authBodySchema } },
    async (request, reply) => {
      const user = await authService.register(
        request.body.email,
        request.body.password,
        request.log,
      );
      request.session.set("user", { id: user.id, role: user.role, email: user.email });
      return reply.status(201).send({ user });
    },
  );

  app.post<{ Body: AuthBody }>(
    "/auth/login",
    { schema: { body: authBodySchema } },
    async (request, reply) => {
      const user = await authService.login(request.body.email, request.body.password, request.log);
      request.session.set("user", { id: user.id, role: user.role, email: user.email });
      return reply.send({ ok: true });
    },
  );

  app.post("/auth/logout", async (request, reply) => {
    const user = request.session.get("user");
    await authService.recordLogout(user?.id ?? null, request.log);
    request.session.delete();
    return reply.send({ ok: true });
  });

  app.get("/auth/me", async (request, reply) => {
    const user = request.session.get("user");
    if (!user) {
      throw new ServiceError(401, "Unauthorized");
    }
    return reply.send({ user });
  });
}
