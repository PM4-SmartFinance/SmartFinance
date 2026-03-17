import Fastify from "fastify";
import secureSession from "@fastify/secure-session";
import authRoutes from "./routes/auth.js";
import { requireRole } from "./middleware/rbac.js";

export function buildServer() {
  const server = Fastify({ logger: true });

  const sessionSecret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && !sessionSecret) {
    throw new Error("SESSION_SECRET must be set in production");
  }
  const finalSecret = sessionSecret || "dev_secret_change_me_32chars_min";

  server.register(secureSession, {
    key: Buffer.from(finalSecret.padEnd(32, "0")).slice(0, 32),
    cookie: {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  });

  server.register(authRoutes);

  server.get("/api/v1/protected", { preHandler: requireRole("USER") }, async (_request, reply) => {
    return reply.send({ secret: "only for logged-in users" });
  });

  return server;
}

if (require.main === module) {
  const server = buildServer();
  server.listen({ port: Number(process.env.PORT) || 3000, host: "0.0.0.0" }).catch((err) => {
    server.log.error(err);
    process.exit(1);
  });
}
