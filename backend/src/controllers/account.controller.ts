import type { FastifyInstance } from "fastify";
import { requireRole, getSessionUser } from "../middleware/rbac.js";
import * as accountService from "../services/account.service.js";

interface AccountParams {
  id: string;
}

interface CreateAccountBody {
  name: string;
  iban: string;
  accountNumber?: string | null;
}

interface UpdateAccountBody {
  name?: string;
  iban?: string;
  accountNumber?: string | null;
  active?: boolean;
}

const uuidPattern = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";

// Length-bounded; permits the spaced IBAN form used elsewhere in the app
// (e.g. "CH93 0076 2011 6238 5295 7"). Trimming/normalisation is left to the
// client — uniqueness is enforced verbatim by the DB constraint.
const accountFields = {
  name: { type: "string", minLength: 1, maxLength: 100 },
  iban: { type: "string", minLength: 5, maxLength: 42, pattern: "^[A-Za-z0-9 ]+$" },
  // `null` clears the stored account number. Bounded, permits the spaced form.
  accountNumber: { type: ["string", "null"], maxLength: 64, pattern: "^[A-Za-z0-9 ]*$" },
} as const;

const accountParamsSchema = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "string", pattern: uuidPattern } },
} as const;

const accountResponseProperties = {
  id: { type: "string" },
  name: { type: "string" },
  iban: { type: "string" },
  accountNumber: { type: ["string", "null"] },
  active: { type: "boolean" },
} as const;

const accountsListSchema = {
  response: {
    200: {
      type: "object",
      required: ["accounts"],
      properties: {
        accounts: {
          type: "array",
          items: {
            type: "object",
            properties: accountResponseProperties,
            required: ["id", "name", "iban"],
          },
        },
      },
    },
  },
} as const;

const accountWriteResponse = {
  type: "object",
  required: ["account"],
  properties: {
    account: {
      type: "object",
      properties: accountResponseProperties,
      required: ["id", "name", "iban"],
    },
  },
} as const;

const createAccountSchema = {
  body: {
    type: "object",
    required: ["name", "iban"],
    additionalProperties: false,
    properties: accountFields,
  },
  response: { 201: accountWriteResponse },
} as const;

const updateAccountSchema = {
  params: accountParamsSchema,
  body: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: { ...accountFields, active: { type: "boolean" } },
  },
  response: { 200: accountWriteResponse },
} as const;

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/accounts",
    { preHandler: requireRole("USER"), schema: accountsListSchema },
    async (request, reply) => {
      const user = getSessionUser(request);
      const accounts = await accountService.getAccountsByUser(user.id);
      return reply.status(200).send({ accounts });
    },
  );

  app.post<{ Body: CreateAccountBody }>(
    "/accounts",
    { preHandler: requireRole("USER"), schema: createAccountSchema },
    async (request, reply) => {
      const user = getSessionUser(request);
      const account = await accountService.createAccount(user.id, request.body);
      return reply.status(201).send({ account });
    },
  );

  app.patch<{ Params: AccountParams; Body: UpdateAccountBody }>(
    "/accounts/:id",
    { preHandler: requireRole("USER"), schema: updateAccountSchema },
    async (request, reply) => {
      const user = getSessionUser(request);
      const account = await accountService.updateAccount(request.params.id, user.id, request.body);
      return reply.status(200).send({ account });
    },
  );

  app.delete<{ Params: AccountParams }>(
    "/accounts/:id",
    { preHandler: requireRole("USER"), schema: { params: accountParamsSchema } },
    async (request, reply) => {
      const user = getSessionUser(request);
      await accountService.deleteAccount(request.params.id, user.id);
      return reply.status(204).send();
    },
  );
}
