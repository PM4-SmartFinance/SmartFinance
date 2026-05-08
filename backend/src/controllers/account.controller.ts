import type { FastifyInstance } from "fastify";
import { requireRole, getSessionUser } from "../middleware/rbac.js";
import * as accountService from "../services/account.service.js";

const accountsResponseSchema = {
  response: {
    200: {
      type: "object",
      properties: {
        accounts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              iban: { type: "string" },
            },
            required: ["id", "name", "iban"],
          },
        },
      },
      required: ["accounts"],
    },
  },
} as const;

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/accounts",
    { preHandler: requireRole("USER"), schema: accountsResponseSchema },
    async (request, reply) => {
      const user = getSessionUser(request);
      const accounts = await accountService.getAccountsByUser(user.id);
      return reply.status(200).send({ accounts });
    },
  );
}
