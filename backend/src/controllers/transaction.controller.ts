import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { requireRole, getSessionUser } from "../middleware/rbac.js";
import { ServiceError } from "../errors.js";
import {
  importTransactions,
  resolveImportEncoding,
  SUPPORTED_FORMATS,
} from "../services/import.service.js";
import { getImporter, getAllPluginFormats } from "../services/importer-registry.service.js";
import { decodeCSVBuffer } from "../services/importers/csv.utils.js";
import type { SortBy, SortOrder } from "../services/transaction.service.js";
import * as transactionService from "../services/transaction.service.js";

type ImportFormat = (typeof SUPPORTED_FORMATS)[number];

const BUILTIN_FORMAT_LABELS: Record<ImportFormat, string> = {
  neon: "Neon",
  zkb: "ZKB",
  wise: "Wise",
  ubs: "UBS",
};

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

interface UpdateTransactionBody {
  categoryId?: string | null;
  notes?: string;
  date?: string;
  amount?: number;
  reason?: string;
}

const updateTransactionSchema = {
  params: {
    type: "object",
    properties: { id: { type: "string", format: "uuid" } },
    required: ["id"],
  },
  body: {
    type: "object",
    properties: {
      // `null` clears the category and restores the post-import
      // "uncategorized" state (KAN-156).
      categoryId: { type: ["string", "null"], format: "uuid" },
      notes: { type: "string", maxLength: 10000 },
      date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      amount: { type: "number" },
      reason: { type: "string", maxLength: 1000 },
    },
    minProperties: 1,
    additionalProperties: false,
  },
} as const;

const deleteTransactionSchema = {
  params: {
    type: "object",
    properties: { id: { type: "string", format: "uuid" } },
    required: ["id"],
  },
  body: {
    type: ["object", "null"],
    properties: {
      reason: { type: "string", maxLength: 1000 },
    },
    additionalProperties: false,
  },
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
      const user = getSessionUser(request);

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
        body: { type: "null" },
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
      const user = getSessionUser(request);
      const result = await transactionService.autoCategorizeTransactions(user.id);
      return reply.send(result);
    },
  );

  app.post<{ Body: { startDate: string; endDate: string } }>(
    "/transactions/recategorize",
    {
      preHandler: requireRole("USER"),
      schema: {
        body: {
          type: "object",
          required: ["startDate", "endDate"],
          properties: {
            startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            endDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          },
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: { recategorized: { type: "integer" } },
            required: ["recategorized"],
          },
        },
      },
    },
    async (request, reply) => {
      const user = getSessionUser(request);
      const { startDate, endDate } = request.body;
      const result = await transactionService.recategorizeTransactionsInRange(
        user.id,
        startDate,
        endDate,
      );
      return reply.send(result);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/transactions/:id",
    {
      preHandler: requireRole("USER"),
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", format: "uuid" } },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const user = getSessionUser(request);
      const transaction = await transactionService.getTransaction(request.params.id, user.id);
      return reply.send({ transaction });
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateTransactionBody }>(
    "/transactions/:id",
    {
      preHandler: requireRole("USER"),
      schema: updateTransactionSchema,
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = getSessionUser(request);
      const isAdmin = user.role === "ADMIN";
      const transaction = await transactionService.updateTransaction(
        id,
        user.id,
        request.body,
        isAdmin,
      );
      return reply.send({ transaction });
    },
  );

  app.delete<{ Params: { id: string }; Body: { reason?: string } | null }>(
    "/transactions/:id",
    {
      schema: deleteTransactionSchema,
      preHandler: requireRole("USER"),
    },
    async (request, reply) => {
      const { id } = request.params;
      const reason = request.body?.reason;
      const user = getSessionUser(request);
      const isAdmin = user.role === "ADMIN";
      await transactionService.deleteTransaction(id, user.id, reason, isAdmin);
      return reply.status(204).send();
    },
  );

  app.get(
    "/transactions/import/formats",
    { preHandler: requireRole("USER") },
    async (_request, reply) => {
      const builtin = SUPPORTED_FORMATS.map((f) => ({ value: f, label: BUILTIN_FORMAT_LABELS[f] }));
      const plugins = getAllPluginFormats().map((p) => ({ value: p.format, label: p.label }));
      return reply.send({ formats: [...builtin, ...plugins] });
    },
  );

  await app.register(async function importRoutes(importApp) {
    await importApp.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB

    importApp.post<{ Querystring: { accountId?: string; format: string } }>(
      "/transactions/import",
      {
        preHandler: requireRole("USER"),
        schema: {
          querystring: {
            type: "object",
            required: ["format"],
            properties: {
              accountId: { type: "string", minLength: 1 },
              format: { type: "string", minLength: 1 },
            },
            additionalProperties: false,
          },
        },
      },
      async (request, reply) => {
        const { accountId, format } = request.query;
        const user = getSessionUser(request);

        const isBuiltin = (SUPPORTED_FORMATS as readonly string[]).includes(format);
        const plugin = isBuiltin ? undefined : getImporter(format);
        if (!isBuiltin && !plugin) {
          throw new ServiceError(400, `Unsupported import format: ${format}`);
        }

        const fileData = await request.file();
        if (!fileData) {
          throw new ServiceError(400, "No file uploaded");
        }

        const encoding = resolveImportEncoding(format);

        const buffer = await fileData.toBuffer();
        const csvText = decodeCSVBuffer(buffer, encoding);

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
