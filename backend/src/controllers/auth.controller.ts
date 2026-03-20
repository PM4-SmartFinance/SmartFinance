import type { FastifyInstance } from "fastify";
import * as authService from "../services/auth.service.js";
import * as auditService from "../services/audit.service.js";
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
      const user = await authService.register(request.body.email, request.body.password);
      await auditService.logEvent("USER_CREATED", user.id, { email: user.email, role: user.role });
      request.session.set("user", { id: user.id, role: user.role, email: user.email });
      return reply.status(201).send({ user });
    },
  );

  app.post<{ Body: AuthBody }>(
    "/auth/login",
    { schema: { body: authBodySchema } },
    async (request, reply) => {
      try {
        const user = await authService.login(request.body.email, request.body.password);
        await auditService.logEvent("LOGIN_SUCCESS", user.id, { email: request.body.email });
        request.session.set("user", { id: user.id, role: user.role, email: user.email });
        return reply.send({ ok: true });
      } catch (err) {
        await auditService.logEvent("LOGIN_FAILED", null, { email: request.body.email });
        throw err;
      }
    },
  );

  app.post("/auth/logout", async (request, reply) => {
    const user = request.session.get("user");
    if (user) {
      await auditService.logEvent("LOGOUT", user.id);
    }
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
