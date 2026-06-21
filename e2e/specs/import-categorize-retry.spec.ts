import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { ADMIN_STORAGE_STATE } from "../global-setup";
import { loginAsAdmin } from "../helpers/auth";
import type { ApiClient, Category, CategoryRule, Budget } from "../helpers/api-client";

const FIXTURE = resolve(__dirname, "../fixtures/neon-20-transactions.csv");
const RANGE = { startDate: "2026-01-01", endDate: "2026-03-31" } as const;
const RUN_ID = Date.now();

type Wave = {
  category: Category;
  rule: CategoryRule;
};

test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe.configure({ mode: "serial" });

test.describe("import → partial categorization → retry → full categorization", () => {
  let admin: ApiClient;
  const wave1: Record<"coop" | "sbb", Wave> = {} as Record<"coop" | "sbb", Wave>;
  const wave2: Record<"migros" | "spotify", Wave> = {} as Record<"migros" | "spotify", Wave>;
  let budget: Budget;

  test.beforeAll(async () => {
    admin = await loginAsAdmin(test.info().project.use.baseURL ?? "http://localhost:5173");

    // Wave-1 categories + rules
    const coopCat = await admin.categories.create(`E2E-Groceries-${RUN_ID}`);
    const coopRule = await admin.rules.create({
      pattern: "Coop",
      matchType: "contains",
      categoryId: coopCat.id,
      priority: 500,
    });
    wave1.coop = { category: coopCat, rule: coopRule };

    const sbbCat = await admin.categories.create(`E2E-Transport-${RUN_ID}`);
    const sbbRule = await admin.rules.create({
      pattern: "SBB",
      matchType: "contains",
      categoryId: sbbCat.id,
      priority: 500,
    });
    wave1.sbb = { category: sbbCat, rule: sbbRule };

    // Budget for one of the fixture months (Feb 2026) so the budgets page
    // shows progress against the imported wave-1 spending.
    budget = await admin.budgets.create({
      categoryId: coopCat.id,
      type: "SPECIFIC_MONTH_YEAR",
      limitAmount: 500,
      month: 2,
      year: 2026,
    });
  });

  test.afterAll(async () => {
    if (!admin) return;
    try {
      // Delete the imported transactions (lookup by date range)
      const imported = await admin.transactions.list({
        startDate: RANGE.startDate,
        endDate: RANGE.endDate,
        limit: 100,
      });
      for (const tx of imported.items) {
        try {
          await admin.transactions.delete(tx.id);
        } catch {
          // ignore — soft delete may already have hit it
        }
      }

      try {
        await admin.budgets.delete(budget.id);
      } catch {
        // ignore
      }
      for (const w of [wave1.coop, wave1.sbb, wave2.migros, wave2.spotify]) {
        if (!w) continue;
        try {
          await admin.rules.delete(w.rule.id);
        } catch {
          // ignore
        }
        try {
          await admin.categories.delete(w.category.id);
        } catch {
          // ignore
        }
      }
    } finally {
      await admin.dispose();
    }
  });

  test("partial categorization on first import — only wave-1 rules exist", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

    // Selecting a file opens the import wizard (KAN-163). Detection pre-fills
    // the format (Neon fixture) and the account (admin has exactly one), so the
    // Import button enables once detect settles; Playwright's click auto-waits.
    await page.locator('input[type="file"]').setInputFiles(FIXTURE);
    await expect(page.getByRole("heading", { name: "Import CSV" })).toBeVisible();
    await page.getByRole("button", { name: /^Import$/ }).click();

    await expect(page.getByText(/^20 transactions imported successfully\.?$/)).toBeVisible();

    // API: 10 categorized into wave-1, 10 uncategorized
    const list = await admin.transactions.list({
      startDate: RANGE.startDate,
      endDate: RANGE.endDate,
      limit: 100,
    });
    expect(list.total).toBe(20);
    const byCategory = countByCategory(list.items);
    expect(byCategory.get(wave1.coop.category.id) ?? 0).toBe(5);
    expect(byCategory.get(wave1.sbb.category.id) ?? 0).toBe(5);
    const uncategorized = list.items.filter((t) => t.categoryId === null).length;
    expect(uncategorized).toBe(10);

    // Dashboard categories endpoint reflects wave-1
    const dashCats = await admin.dashboard.categories(RANGE);
    expect(dashCats.find((c) => c.categoryId === wave1.coop.category.id)).toBeDefined();
    expect(dashCats.find((c) => c.categoryId === wave1.sbb.category.id)).toBeDefined();
    expect(dashCats.find((c) => c.isUncategorized)).toBeDefined();

    // Transactions page: filtered by wave-1 category shows 5 rows
    await page.goto("/transactions");
    await page.getByLabel("Start Date").fill(RANGE.startDate);
    await page.getByLabel("End Date").fill(RANGE.endDate);
    const categoryFilter = page.getByLabel("Filter by Category");
    await categoryFilter.selectOption({ value: wave1.coop.category.id });
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByRole("row").filter({ hasText: "Coop" })).toHaveCount(5);

    // Budgets page renders without error and shows the categories nav.
    // Spending progress assertions are exercised by filters.spec via DATE_RANGE.
    await page.goto("/budgets");
    await expect(page.getByRole("heading", { level: 1, name: "Budgets" })).toBeVisible();
  });

  test("full categorization after creating wave-2 rules and re-running auto-categorize", async () => {
    // Wave-2 categories + rules (API)
    const migrosCat = await admin.categories.create(`E2E-Shopping-${RUN_ID}`);
    const migrosRule = await admin.rules.create({
      pattern: "Migros",
      matchType: "contains",
      categoryId: migrosCat.id,
      priority: 500,
    });
    wave2.migros = { category: migrosCat, rule: migrosRule };

    const spotifyCat = await admin.categories.create(`E2E-Entertainment-${RUN_ID}`);
    const spotifyRule = await admin.rules.create({
      pattern: "Spotify",
      matchType: "contains",
      categoryId: spotifyCat.id,
      priority: 500,
    });
    wave2.spotify = { category: spotifyCat, rule: spotifyRule };

    // KAN-154 made `createRule` auto-categorize as a side-effect, so the two
    // wave-2 rule inserts above already categorized the 10 uncategorized rows.
    // The explicit re-run therefore must be a no-op (idempotent).
    const result = await admin.transactions.autoCategorize();
    expect(result.categorized).toBe(0);

    const list = await admin.transactions.list({
      startDate: RANGE.startDate,
      endDate: RANGE.endDate,
      limit: 100,
    });
    const uncategorized = list.items.filter((t) => t.categoryId === null).length;
    expect(uncategorized).toBe(0);

    const byCategory = countByCategory(list.items);
    expect(byCategory.get(wave2.migros.category.id) ?? 0).toBe(5);
    expect(byCategory.get(wave2.spotify.category.id) ?? 0).toBe(5);

    const dashCats = await admin.dashboard.categories(RANGE);
    expect(dashCats.find((c) => c.categoryId === wave2.migros.category.id)).toBeDefined();
    expect(dashCats.find((c) => c.categoryId === wave2.spotify.category.id)).toBeDefined();
    expect(dashCats.find((c) => c.isUncategorized)).toBeUndefined();
  });
});

function countByCategory(items: { categoryId: string | null }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const it of items) {
    if (!it.categoryId) continue;
    out.set(it.categoryId, (out.get(it.categoryId) ?? 0) + 1);
  }
  return out;
}
