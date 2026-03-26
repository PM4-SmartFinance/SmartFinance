import type { FastifyInstance } from "fastify";
import { ServiceError } from "../errors.js";
import { requireRole } from "../middleware/rbac.js";
import * as transactionsService from "../services/transactions.service.js";

interface TransactionParams {
  id: string;
}

interface PatchTransactionBody {
  categoryId?: string;
  notes?: string;
}

const transactionParamsSchema = {
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "string", format: "uuid" },
  },
} as const;

const patchTransactionBodySchema = {
  type: "object",
  properties: {
    categoryId: { type: "string", format: "uuid" },
    notes: { type: "string" },
  },
  additionalProperties: false,
} as const;

export async function singleTransactionRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: TransactionParams }>(
    "/transactions/:id",
    {
      preHandler: requireRole("USER"),
      schema: { params: transactionParamsSchema },
    },
    async (request, reply) => {
      const user = request.session.get("user");
      if (!user) throw new ServiceError(401, "Unauthorized");
      const transaction = await transactionsService.getTransaction(request.params.id, user.id);
      return reply.send({ transaction });
    },
  );

  app.patch<{ Params: TransactionParams; Body: PatchTransactionBody }>(
    "/transactions/:id",
    {
      preHandler: requireRole("USER"),
      schema: { params: transactionParamsSchema, body: patchTransactionBodySchema },
    },
    async (request, reply) => {
      const user = request.session.get("user");
      if (!user) throw new ServiceError(401, "Unauthorized");
      const transaction = await transactionsService.updateTransaction(
        request.params.id,
        user.id,
        request.body,
      );
      return reply.send({ transaction });
    },
  );

  app.delete<{ Params: TransactionParams }>(
    "/transactions/:id",
    {
      preHandler: requireRole("USER"),
      schema: { params: transactionParamsSchema },
    },
    async (request, reply) => {
      const user = request.session.get("user");
      if (!user) throw new ServiceError(401, "Unauthorized");
      await transactionsService.deleteTransaction(request.params.id, user.id);
      return reply.status(204).send();
    },
  );
}
