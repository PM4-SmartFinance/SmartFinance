import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { requireRole } from "../middleware/rbac.js";
import { ServiceError } from "../errors.js";
import type { ImportFormat } from "../services/import.service.js";
import { importTransactions, SUPPORTED_FORMATS } from "../services/import.service.js";
import { decodeCSVBuffer } from "../services/importers/csv.utils.js";
import type { SortBy, SortOrder } from "../services/transaction.service.js";
import * as transactionService from "../services/transaction.service.js";

interface ListTransactionsQuery {
  page: number;
  limit: number;
  sortBy: SortBy;
  sortOrder: SortOrder;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
}

interface TransactionParams {
  id: string;
}

interface PatchTransactionBody {
  categoryId?: string;
  notes?: string;
}

const FORMAT_ENCODING: Record<ImportFormat, string> = {
  neon: "utf-8",
  zkb: "utf-8",
  wise: "utf-8",
  ubs: "iso-8859-1",
};

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
    notes: { type: "string", maxLength: 10000 },
  },
  minProperties: 1,
  additionalProperties: false,
} as const;

const listTransactionsSchema = {
  querystring: {
    type: "object",
    properties: {
      page: { type: "integer", minimum: 1, default: 1 },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      sortBy: { type: "string", enum: ["date", "amount", "merchant"], default: "date" },
      sortOrder: { type: "string", enum: ["asc", "desc"], default: "desc" },
      startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      endDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      categoryId: { type: "string" },
      minAmount: { type: "number" },
      maxAmount: { type: "number" },
      search: { type: "string", minLength: 1, maxLength: 200 },
    },
  },
} as const;

export async function transactionRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: ListTransactionsQuery }>(
    "/transactions",
    {
      schema: listTransactionsSchema,
      preHandler: requireRole("USER"),
    },
    async (request, reply) => {
      const user = request.session.get("user");
      if (!user) throw new ServiceError(401, "Unauthorized");

      const result = await transactionService.listTransactions({
        userId: user.id,
        ...request.query,
      });

      return reply.send(result);
    },
  );

  app.post(
    "/transactions/auto-categorize",
    {
      preHandler: requireRole("USER"),
      schema: {
        response: {
          200: {
            type: "object",
            properties: { categorized: { type: "integer" } },
            required: ["categorized"],
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.session.get("user");
      if (!user) throw new ServiceError(401, "Unauthorized");
      const result = await transactionService.autoCategorizeTransactions(user.id);
      return reply.send(result);
    },
  );

  app.get<{ Params: TransactionParams }>(
    "/transactions/:id",
    {
      preHandler: requireRole("USER"),
      schema: { params: transactionParamsSchema },
    },
    async (request, reply) => {
      const user = request.session.get("user");
      if (!user) throw new ServiceError(401, "Unauthorized");
      const transaction = await transactionService.getTransaction(request.params.id, user.id);
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
      const transaction = await transactionService.updateTransaction(
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
      await transactionService.deleteTransaction(request.params.id, user.id);
      return reply.status(204).send();
    },
  );

  await app.register(async function importRoutes(importApp) {
    await importApp.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB

    importApp.post<{ Querystring: { accountId: string; format: ImportFormat } }>(
      "/transactions/import",
      {
        preHandler: requireRole("USER"),
        schema: {
          querystring: {
            type: "object",
            required: ["accountId", "format"],
            properties: {
              accountId: { type: "string", minLength: 1 },
              format: { type: "string", enum: SUPPORTED_FORMATS as unknown as string[] },
            },
          },
        },
      },
      async (request, reply) => {
        const { accountId, format } = request.query;
        const user = request.session.get("user");
        if (!user) throw new ServiceError(401, "Unauthorized");

        const fileData = await request.file();
        if (!fileData) {
          throw new ServiceError(400, "No file uploaded");
        }

        const buffer = await fileData.toBuffer();
        const csvText = decodeCSVBuffer(buffer, FORMAT_ENCODING[format]);

        const result = await importTransactions({
          csvText,
          format,
          accountId,
          userId: user.id,
          logger: request.log,
        });

        return reply.status(200).send(result);
      },
    );
  });
}
