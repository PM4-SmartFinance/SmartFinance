import type { FastifyInstance } from "fastify";
import { requireRole } from "../middleware/rbac.js";
import * as budgetService from "../services/budget.service.js";
import type { BudgetType } from "@prisma/client";

interface BudgetParams {
  id: string;
}

interface CreateBudgetBody {
  categoryId: string;
  type: BudgetType;
  limitAmount: number;
  month?: number;
  year?: number;
}

interface UpdateBudgetBody {
  limitAmount: number;
}

const BUDGET_TYPES = [
  "DAILY",
  "MONTHLY",
  "YEARLY",
  "SPECIFIC_MONTH",
  "SPECIFIC_YEAR",
  "SPECIFIC_MONTH_YEAR",
];

const createBudgetSchema = {
  type: "object",
  required: ["categoryId", "type", "limitAmount"],
  properties: {
    categoryId: { type: "string" },
    type: { type: "string", enum: BUDGET_TYPES },
    limitAmount: { type: "number", exclusiveMinimum: 0 },
    month: { type: "integer", minimum: 1, maximum: 12 },
    year: { type: "integer", minimum: 2000 },
  },
} as const;

const updateBudgetSchema = {
  type: "object",
  required: ["limitAmount"],
  properties: {
    limitAmount: { type: "number", exclusiveMinimum: 0 },
  },
} as const;

const budgetParamsSchema = {
  type: "object",
  required: ["id"],
  properties: {
    id: {
      type: "string",
      pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    },
  },
} as const;

export async function budgetRoutes(app: FastifyInstance): Promise<void> {
  app.get("/budgets", { preHandler: requireRole("USER") }, async (request, reply) => {
    const session = request.session.get("user")!;
    const budgets = await budgetService.listBudgets(session.id);
    return reply.send({ budgets });
  });

  app.post<{ Body: CreateBudgetBody }>(
    "/budgets",
    { preHandler: requireRole("USER"), schema: { body: createBudgetSchema } },
    async (request, reply) => {
      const session = request.session.get("user")!;
      const { categoryId, type, limitAmount, month, year } = request.body;
      const budget = await budgetService.createBudget(
        session.id,
        categoryId,
        type,
        limitAmount,
        month,
        year,
      );
      return reply.status(201).send({ budget });
    },
  );

  app.patch<{ Params: BudgetParams; Body: UpdateBudgetBody }>(
    "/budgets/:id",
    {
      preHandler: requireRole("USER"),
      schema: { params: budgetParamsSchema, body: updateBudgetSchema },
    },
    async (request, reply) => {
      const session = request.session.get("user")!;
      const budget = await budgetService.updateBudget(
        request.params.id,
        session.id,
        request.body.limitAmount,
      );
      return reply.send({ budget });
    },
  );

  app.delete<{ Params: BudgetParams }>(
    "/budgets/:id",
    { preHandler: requireRole("USER"), schema: { params: budgetParamsSchema } },
    async (request, reply) => {
      const session = request.session.get("user")!;
      await budgetService.deleteBudget(request.params.id, session.id);
      return reply.status(204).send();
    },
  );
}
