import type { FastifyInstance } from "fastify";
import { requireRole } from "../middleware/rbac.js";
import { ServiceError } from "../errors.js";
import { findAccountsByUser } from "../repositories/account.repository.js";

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  app.get("/accounts", { preHandler: requireRole("USER") }, async (request, reply) => {
    const user = request.session.get("user");
    if (!user) throw new ServiceError(401, "Unauthorized");

    const accounts = await findAccountsByUser(user.id);
    return reply.status(200).send({ accounts });
  });
}
