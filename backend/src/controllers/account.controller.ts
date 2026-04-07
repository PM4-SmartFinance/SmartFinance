import type { FastifyInstance } from "fastify";
import { requireRole } from "../middleware/rbac.js";
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
      const user = request.session.get("user")!;
      const accounts = await accountService.getAccountsByUser(user.id);
      return reply.status(200).send({ accounts });
    },
  );
}
