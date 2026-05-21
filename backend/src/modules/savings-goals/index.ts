import { randomUUID } from "crypto";
import type { FastifyBaseLogger } from "fastify";
import type {
  SmartFinanceModule,
  ModuleContext,
  ModuleStatus,
  ModuleStorageAdapter,
  TransactionImportedEvent,
} from "../../types/module.js";
import { getSessionUser, requireRole } from "../../middleware/rbac.js";
import { ServiceError } from "../../errors.js";

interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
}

const GOALS_KEY = "goals";

async function loadGoals(storage: ModuleStorageAdapter, userId: string): Promise<SavingsGoal[]> {
  const raw = await storage.get(userId, GOALS_KEY);
  if (!Array.isArray(raw)) return [];
  return raw as SavingsGoal[];
}

async function persistGoals(
  storage: ModuleStorageAdapter,
  userId: string,
  goals: SavingsGoal[],
): Promise<void> {
  await storage.set(userId, GOALS_KEY, goals);
}

function createSavingsGoalsModule(): SmartFinanceModule {
  let initialized = false;
  let initError: string | undefined;
  let moduleLogger: FastifyBaseLogger | undefined;

  return {
    id: "savings-goals",
    name: "Savings Goals",
    requiredRole: "USER",

    async init(context: ModuleContext): Promise<void> {
      const { app, storage } = context;
      moduleLogger = context.logger;

      try {
        context.registerNavItem({
          label: "Savings Goals",
          path: "/modules/savings-goals",
        });

        context.registerWidget({
          widgetId: "savings-goals-summary",
          title: "Savings Goals",
          dataEndpoint: "/modules/savings-goals/goals/widget",
        });

        app.get("/goals", { preHandler: requireRole("USER") }, async (request, reply) => {
          const user = getSessionUser(request);
          const goals = await loadGoals(storage, user.id);
          return reply.send({ goals });
        });

        app.get("/goals/widget", { preHandler: requireRole("USER") }, async (request, reply) => {
          const user = getSessionUser(request);
          const goals = await loadGoals(storage, user.id);
          const items = goals.map((g) => ({
            id: g.id,
            label: g.name,
            detail: `${g.currentAmount.toFixed(2)} / ${g.targetAmount.toFixed(2)}`,
            progress:
              g.targetAmount > 0
                ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100))
                : 0,
          }));
          return reply.send({
            items,
            emptyMessage: "No savings goals yet. Create your first goal!",
          });
        });

        app.post<{ Body: { name: string; targetAmount: number } }>(
          "/goals",
          {
            preHandler: requireRole("USER"),
            schema: {
              body: {
                type: "object",
                required: ["name", "targetAmount"],
                properties: {
                  name: { type: "string", minLength: 1, maxLength: 200 },
                  targetAmount: { type: "number", exclusiveMinimum: 0 },
                },
                additionalProperties: false,
              },
            },
          },
          async (request, reply) => {
            const user = getSessionUser(request);
            const { name, targetAmount } = request.body;
            if (!name || typeof name !== "string" || name.trim() === "") {
              throw new ServiceError(400, "Goal name is required");
            }
            if (typeof targetAmount !== "number" || targetAmount <= 0) {
              throw new ServiceError(400, "Target amount must be a positive number");
            }
            const goals = await loadGoals(storage, user.id);
            const newGoal: SavingsGoal = {
              id: randomUUID(),
              name: name.trim(),
              targetAmount,
              currentAmount: 0,
            };
            goals.push(newGoal);
            await persistGoals(storage, user.id, goals);
            return reply.status(201).send({ goal: newGoal });
          },
        );

        app.patch<{
          Params: { goalId: string };
          Body: { name?: string; targetAmount?: number; currentAmount?: number };
        }>(
          "/goals/:goalId",
          {
            preHandler: requireRole("USER"),
            schema: {
              body: {
                type: "object",
                properties: {
                  name: { type: "string", minLength: 1, maxLength: 200 },
                  targetAmount: { type: "number", exclusiveMinimum: 0 },
                  currentAmount: { type: "number", minimum: 0 },
                },
                additionalProperties: false,
              },
            },
          },
          async (request, reply) => {
            const user = getSessionUser(request);
            const { goalId } = request.params;
            const goals = await loadGoals(storage, user.id);
            const idx = goals.findIndex((g) => g.id === goalId);
            if (idx === -1) throw new ServiceError(404, "Goal not found");
            const goal = goals[idx]!;

            if (request.body.name !== undefined) {
              if (typeof request.body.name !== "string" || request.body.name.trim() === "") {
                throw new ServiceError(400, "Goal name must be a non-empty string");
              }
              goal.name = request.body.name.trim();
            }
            if (request.body.targetAmount !== undefined) {
              if (typeof request.body.targetAmount !== "number" || request.body.targetAmount <= 0) {
                throw new ServiceError(400, "Target amount must be a positive number");
              }
              goal.targetAmount = request.body.targetAmount;
            }
            if (request.body.currentAmount !== undefined) {
              if (
                typeof request.body.currentAmount !== "number" ||
                request.body.currentAmount < 0
              ) {
                throw new ServiceError(400, "Current amount must be a non-negative number");
              }
              goal.currentAmount = request.body.currentAmount;
            }

            goals[idx] = goal;
            await persistGoals(storage, user.id, goals);
            return reply.send({ goal });
          },
        );

        app.delete<{ Params: { goalId: string } }>(
          "/goals/:goalId",
          { preHandler: requireRole("USER") },
          async (request, reply) => {
            const user = getSessionUser(request);
            const { goalId } = request.params;
            const goals = await loadGoals(storage, user.id);
            const filtered = goals.filter((g) => g.id !== goalId);
            if (filtered.length === goals.length) throw new ServiceError(404, "Goal not found");
            await persistGoals(storage, user.id, filtered);
            return reply.status(204).send();
          },
        );

        initialized = true;
      } catch (err) {
        initError = err instanceof Error ? (err.stack ?? err.message) : String(err);
        throw err;
      }
    },

    getStatus(): ModuleStatus {
      const status: ModuleStatus = { initialized };
      if (initError !== undefined) status.error = initError;
      return status;
    },

    async onTransactionImported(event: TransactionImportedEvent): Promise<void> {
      if (!moduleLogger) throw new Error("savings-goals: onTransactionImported called before init");
      moduleLogger.info(
        { moduleId: "savings-goals", userId: event.userId, imported: event.imported },
        "savings-goals: transaction import event received",
      );
    },
  };
}

export const savingsGoalsModule = createSavingsGoalsModule();
