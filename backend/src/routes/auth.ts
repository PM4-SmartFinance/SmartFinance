import { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { prisma } from "../prisma.js";

const bodySchema = {
  type: "object",
  required: ["email", "password"],
  properties: {
    email: { type: "string" },
    password: { type: "string" },
  },
};

export default async function authRoutes(fastify: FastifyInstance) {
  const prefix = "/api/v1/auth";

  fastify.post(`${prefix}/register`, { schema: { body: bodySchema } }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return reply.status(409).send({ error: "User exists" });

    const hashed = await argon2.hash(password);

    const user = await prisma.$transaction(async (tx) => {
      const count = await tx.user.count();
      const role = count === 0 ? "ADMIN" : "USER";
      return tx.user.create({
        data: { email, password: hashed, role },
        select: { id: true, email: true, role: true, createdAt: true },
      });
    });

    // set session
    request.session.set("user", { id: user.id, role: user.role, email: user.email });
    return reply.status(201).send({ user });
  });

  fastify.post(`${prefix}/login`, { schema: { body: bodySchema } }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return reply.status(401).send({ error: "Invalid credentials" });

    const ok = await argon2.verify(user.password, password);
    if (!ok) return reply.status(401).send({ error: "Invalid credentials" });

    request.session.set("user", { id: user.id, role: user.role, email: user.email });
    return reply.send({ ok: true });
  });

  fastify.post(`${prefix}/logout`, async (request, reply) => {
    request.session.delete();
    return reply.send({ ok: true });
  });

  fastify.get(`${prefix}/me`, async (request, reply) => {
    const user = request.session.get("user");
    if (!user) return reply.status(401).send({ error: "Unauthorized" });
    return reply.send({ user });
  });
}
