import type { FastifyInstance } from "fastify";
import { requireRole } from "../middleware/rbac.js";
import * as budgetService from "../services/budget.service.js";
import type { PeriodFilter } from "../services/budget.service.js";
import { BudgetType } from "@prisma/client";

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
  limitAmount?: number;
  categoryId?: string;
  type?: BudgetType;
  month?: number;
  year?: number;
  active?: boolean;
}

const BUDGET_TYPES = Object.values(BudgetType);

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
  properties: {
    limitAmount: { type: "number", exclusiveMinimum: 0 },
    categoryId: { type: "string" },
    type: { type: "string", enum: BUDGET_TYPES },
    month: { type: "integer", minimum: 1, maximum: 12 },
    year: { type: "integer", minimum: 2000 },
    active: { type: "boolean" },
  },
  minProperties: 1,
} as const;

interface BudgetQuerystring {
  period?: PeriodFilter;
  startDate?: string;
  endDate?: string;
}

const PERIOD_VALUES: PeriodFilter[] = ["DAILY", "MONTHLY", "YEARLY", "DATE_RANGE"];

const budgetQuerystringSchema = {
  type: "object",
  properties: {
    period: { type: "string", enum: PERIOD_VALUES },
    startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    endDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
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
  app.get<{ Querystring: BudgetQuerystring }>(
    "/budgets",
    { preHandler: requireRole("USER"), schema: { querystring: budgetQuerystringSchema } },
    async (request, reply) => {
      const session = request.session.get("user")!;
      const budgets = await budgetService.listBudgets(session.id);
      const { period, startDate, endDate } = request.query;

      if (period) {
        const categorySpending = await budgetService.getCategorySpendingForPeriod(
          session.id,
          period,
          budgets,
          startDate,
          endDate,
        );
        return reply.send({ budgets, categorySpending });
      }

      return reply.send({ budgets });
    },
  );

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
      const budget = await budgetService.updateBudget(request.params.id, session.id, request.body);
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
