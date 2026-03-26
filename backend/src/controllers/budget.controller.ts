import type { FastifyInstance } from "fastify";
import { requireRole } from "../middleware/rbac.js";
import * as budgetService from "../services/budget.service.js";

interface BudgetParams {
  id: string;
}

interface CreateBudgetBody {
  categoryId: string;
  month: number;
  year: number;
  limitAmount: number;
}

interface UpdateBudgetBody {
  limitAmount: number;
}

const createBudgetSchema = {
  type: "object",
  required: ["categoryId", "month", "year", "limitAmount"],
  properties: {
    categoryId: { type: "string" },
    month: { type: "integer", minimum: 1, maximum: 12 },
    year: { type: "integer", minimum: 2000 },
    limitAmount: { type: "number", exclusiveMinimum: 0 },
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
    id: { type: "string" },
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
      const { categoryId, month, year, limitAmount } = request.body;
      const budget = await budgetService.createBudget(
        session.id,
        categoryId,
        month,
        year,
        limitAmount,
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
