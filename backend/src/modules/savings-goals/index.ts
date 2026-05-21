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

const LEGACY_ARRAY_KEY = "goals";
const RECORD_PREFIX = "goals:";

function recordKey(goalId: string): string {
  return `${RECORD_PREFIX}${goalId}`;
}

function isSavingsGoal(value: unknown): value is SavingsGoal {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["id"] === "string" &&
    typeof v["name"] === "string" &&
    typeof v["targetAmount"] === "number" &&
    typeof v["currentAmount"] === "number"
  );
}

/**
 * Lists all goals for a user. On the first call after the per-record refactor,
 * a legacy `goals` array key is split into per-record entries and removed.
 * Subsequent calls only see per-record entries.
 */
async function listGoals(storage: ModuleStorageAdapter, userId: string): Promise<SavingsGoal[]> {
  const entries = await storage.list(userId);
  const legacy = entries.find((e) => e.key === LEGACY_ARRAY_KEY);
  const recordEntries = entries.filter((e) => e.key.startsWith(RECORD_PREFIX));
  const recordGoals = recordEntries.map((e) => e.value).filter(isSavingsGoal);

  if (legacy && Array.isArray(legacy.value)) {
    const legacyGoals = (legacy.value as unknown[]).filter(isSavingsGoal);
    const seen = new Set(recordGoals.map((g) => g.id));
    for (const goal of legacyGoals) {
      if (seen.has(goal.id)) continue;
      await storage.set(userId, recordKey(goal.id), goal);
      seen.add(goal.id);
    }
    await storage.delete(userId, LEGACY_ARRAY_KEY);
    return [...recordGoals, ...legacyGoals.filter((g) => !recordGoals.some((r) => r.id === g.id))];
  }

  return recordGoals;
}

async function loadGoal(
  storage: ModuleStorageAdapter,
  userId: string,
  goalId: string,
): Promise<SavingsGoal | null> {
  const raw = await storage.get(userId, recordKey(goalId));
  return isSavingsGoal(raw) ? raw : null;
}

export function createSavingsGoalsModule(): SmartFinanceModule {
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
          const goals = await listGoals(storage, user.id);
          return reply.send({ goals });
        });

        app.get("/goals/widget", { preHandler: requireRole("USER") }, async (request, reply) => {
          const user = getSessionUser(request);
          const goals = await listGoals(storage, user.id);
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
            if (name.trim() === "") {
              throw new ServiceError(400, "Goal name is required");
            }
            const newGoal: SavingsGoal = {
              id: randomUUID(),
              name: name.trim(),
              targetAmount,
              currentAmount: 0,
            };
            await storage.set(user.id, recordKey(newGoal.id), newGoal);
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
            const goal = await loadGoal(storage, user.id, goalId);
            if (!goal) throw new ServiceError(404, "Goal not found");

            if (request.body.name !== undefined) {
              if (request.body.name.trim() === "") {
                throw new ServiceError(400, "Goal name must be a non-empty string");
              }
              goal.name = request.body.name.trim();
            }
            if (request.body.targetAmount !== undefined) {
              goal.targetAmount = request.body.targetAmount;
            }
            if (request.body.currentAmount !== undefined) {
              goal.currentAmount = request.body.currentAmount;
            }

            await storage.set(user.id, recordKey(goalId), goal);
            return reply.send({ goal });
          },
        );

        app.delete<{ Params: { goalId: string } }>(
          "/goals/:goalId",
          { preHandler: requireRole("USER") },
          async (request, reply) => {
            const user = getSessionUser(request);
            const { goalId } = request.params;
            const existing = await loadGoal(storage, user.id, goalId);
            if (!existing) throw new ServiceError(404, "Goal not found");
            await storage.delete(user.id, recordKey(goalId));
            return reply.status(204).send();
          },
        );

        initialized = true;
      } catch (err) {
        initError = err instanceof Error ? err.message : String(err);
        throw err;
      }
    },

    getStatus(): ModuleStatus {
      const status: ModuleStatus = { initialized };
      if (initError !== undefined) status.error = initError;
      return status;
    },

    async onTransactionImported(event: TransactionImportedEvent): Promise<void> {
      if (!moduleLogger) return;
      moduleLogger.info(
        { moduleId: "savings-goals", userId: event.userId, imported: event.imported },
        "savings-goals: transaction import event received",
      );
    },
  };
}
