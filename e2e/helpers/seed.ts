import type {
  ApiClient,
  Category,
  CategoryRule,
  Budget,
  MatchType,
  BudgetType,
} from "./api-client";

export type SeededCategory = Category & { rules: CategoryRule[] };

export type CategorySeed = {
  name: string;
  rules?: Array<{ pattern: string; matchType?: MatchType; priority?: number }>;
};

export async function seedCategories(
  client: ApiClient,
  seeds: CategorySeed[],
): Promise<SeededCategory[]> {
  const out: SeededCategory[] = [];
  for (const seed of seeds) {
    const category = await client.categories.create(seed.name);
    const rules: CategoryRule[] = [];
    for (const r of seed.rules ?? []) {
      rules.push(
        await client.rules.create({
          pattern: r.pattern,
          matchType: r.matchType ?? "contains",
          categoryId: category.id,
          priority: r.priority ?? 100,
        }),
      );
    }
    out.push({ ...category, rules });
  }
  return out;
}

export async function seedMonthlyBudget(
  client: ApiClient,
  categoryId: string,
  limitAmount: number,
): Promise<Budget> {
  const now = new Date();
  return client.budgets.create({
    categoryId,
    type: "SPECIFIC_MONTH_YEAR" satisfies BudgetType,
    limitAmount,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
}

export type CleanupBag = {
  budgetIds: string[];
  ruleIds: string[];
  categoryIds: string[];
  userIds: string[];
};

export function newCleanupBag(): CleanupBag {
  return { budgetIds: [], ruleIds: [], categoryIds: [], userIds: [] };
}

export async function cleanup(client: ApiClient, bag: CleanupBag): Promise<void> {
  for (const id of bag.budgetIds) await safeDelete(() => client.budgets.delete(id));
  for (const id of bag.ruleIds) await safeDelete(() => client.rules.delete(id));
  for (const id of bag.categoryIds) await safeDelete(() => client.categories.delete(id));
  for (const id of bag.userIds) await safeDelete(() => client.users.delete(id));
}

async function safeDelete(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    // Best-effort teardown — log and continue so one failure doesn't leak the rest.
    console.warn("[e2e cleanup] delete failed:", (err as Error).message);
  }
}
