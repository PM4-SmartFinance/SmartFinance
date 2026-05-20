import type { FastifyInstance } from "fastify";
import * as authService from "../services/auth.service.js";
import * as userService from "../services/user.service.js";
import { verifySession } from "../middleware/rbac.js";
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
    "/auth/login",
    {
      schema: { body: authBodySchema },
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const user = await authService.login(request.body.email, request.body.password);
      request.session.set("user", user);
      return reply.send({ ok: true });
    },
  );

  app.post("/auth/logout", async (request, reply) => {
    const user = request.session.get("user");
    await authService.recordLogout(user?.id ?? null);
    request.session.delete();
    return reply.send({ ok: true });
  });

  app.get("/auth/me", async (request, reply) => {
    const sessionUser = await verifySession(request);
    try {
      const user = await userService.getProfile(sessionUser.id);
      return reply.send({ user });
    } catch (err) {
      // Race: verifySession passed, but the user row was deleted before
      // getProfile ran. Mirror the eviction semantics used inside
      // verifySession so /auth/me returns 401 with a cleared session.
      if (err instanceof ServiceError && err.statusCode === 404) {
        request.session.delete();
        throw new ServiceError(401, "Unauthorized");
      }
      throw err;
    }
  });
}
