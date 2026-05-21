import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { ADMIN_STORAGE_STATE } from "../global-setup";
import { loginAsAdmin } from "../helpers/auth";
import type { ApiClient, Transaction } from "../helpers/api-client";

const FIXTURE = resolve(__dirname, "../fixtures/filters-15-transactions.csv");

const OCT = { startDate: "2025-10-01", endDate: "2025-10-31" } as const;
const Q4 = { startDate: "2025-10-01", endDate: "2025-12-31" } as const;

test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe.configure({ mode: "serial" });

test.describe("filters", () => {
  let admin: ApiClient;
  let importedIds: string[] = [];

  test.beforeAll(async () => {
    admin = await loginAsAdmin(test.info().project.use.baseURL ?? "http://localhost:5173");
    const before = await admin.transactions.list({
      startDate: Q4.startDate,
      endDate: Q4.endDate,
      limit: 100,
    });
    await admin.transactions.importCsv(FIXTURE, "neon");
    const after = await admin.transactions.list({
      startDate: Q4.startDate,
      endDate: Q4.endDate,
      limit: 100,
    });
    importedIds = diffById(before.items, after.items);
    expect(importedIds, "fixture should import 15 rows").toHaveLength(15);
  });

  test.afterAll(async () => {
    if (!admin) return;
    try {
      for (const id of importedIds) {
        try {
          await admin.transactions.delete(id);
        } catch {
          // ignore — best effort
        }
      }
    } finally {
      await admin.dispose();
    }
  });

  test("Dashboard date range filters the summary", async () => {
    const octSummary = await admin.dashboard.summary(OCT);
    const q4Summary = await admin.dashboard.summary(Q4);
    expect(octSummary.transactionCount).toBeGreaterThanOrEqual(5);
    expect(q4Summary.transactionCount).toBeGreaterThanOrEqual(15);
    expect(q4Summary.transactionCount).toBeGreaterThan(octSummary.transactionCount);
  });

  test("Budgets period selector toggles view state", async ({ page }) => {
    await page.goto("/budgets");
    const period = page.getByLabel("View Period");
    await expect(period).toHaveValue("MONTHLY");
    await period.selectOption("YEARLY");
    await expect(period).toHaveValue("YEARLY");
    await period.selectOption("DATE_RANGE");
    await expect(page.getByLabel("Start Date")).toBeVisible();
    await expect(page.getByLabel("End Date")).toBeVisible();
  });

  test("Transactions date range narrows the table to October only", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByLabel("Start Date").fill(OCT.startDate);
    await page.getByLabel("End Date").fill(OCT.endDate);
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText(/Page 1 of 1/i)).toBeVisible();
    await expect(page.getByRole("row").filter({ has: page.locator("td") })).toHaveCount(5);
  });

  test("Transactions free-text search filters by merchant", async ({ page }) => {
    await page.goto("/transactions");
    // Wide date range so search hits all 3 Spotify rows
    await page.getByLabel("Start Date").fill(Q4.startDate);
    await page.getByLabel("End Date").fill(Q4.endDate);
    await page.getByLabel("Search").fill("Spotify");
    await page.getByRole("button", { name: "Apply" }).click();
    const rows = page.getByRole("row").filter({ has: page.locator("td") });
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toContainText(/Spotify/i);
  });

  test("Combined date + search returns the intersection", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByLabel("Start Date").fill(OCT.startDate);
    await page.getByLabel("End Date").fill(OCT.endDate);
    await page.getByLabel("Search").fill("Coop");
    await page.getByRole("button", { name: "Apply" }).click();
    const rows = page.getByRole("row").filter({ has: page.locator("td") });
    await expect(rows).toHaveCount(2);
    for (const text of await rows.allTextContents()) {
      expect(text).toMatch(/Coop/i);
    }
  });
});

function diffById(before: Transaction[], after: Transaction[]): string[] {
  const beforeIds = new Set(before.map((t) => t.id));
  return after.filter((t) => !beforeIds.has(t.id)).map((t) => t.id);
}
