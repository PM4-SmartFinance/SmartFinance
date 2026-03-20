import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { requireRole } from "../middleware/rbac.js";
import { ServiceError } from "../errors.js";
import { importTransactions, SUPPORTED_FORMATS } from "../services/import.service.js";
import type { ImportFormat } from "../services/import.service.js";

export async function importTransactionRoutes(app: FastifyInstance): Promise<void> {
  await app.register(multipart);

  app.get(
    "/transactions/import/formats",
    {
      preHandler: requireRole("USER"),
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              formats: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      return reply.status(200).send({ formats: SUPPORTED_FORMATS });
    },
  );

  app.post<{ Querystring: { accountId: string; format: string } }>(
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
      const csvText = buffer.toString("utf-8");

      const result = await importTransactions({
        csvText,
        format: format as ImportFormat,
        accountId,
        userId: user.id,
      });

      return reply.status(200).send(result);
    },
  );
}
