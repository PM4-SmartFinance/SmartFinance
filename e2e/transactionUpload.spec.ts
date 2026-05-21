import { test, expect } from "@playwright/test";

test("Transaction upload and filtering works", async ({ page }) => {
  await page.goto("http://localhost:5173/login");
  await page.getByRole("textbox", { name: "Email" }).click();
  await page.getByRole("textbox", { name: "Email" }).fill("dev@smartfinance.local");
  await page.getByRole("textbox", { name: "Email" }).press("Tab");
  await page.getByRole("textbox", { name: "Password" }).fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page
    .getByText("DashboardWelcome back, Local Dev UserTransactionsBudgetsCategoriesSettingsLD")
    .click();
  await page.getByRole("heading", { name: "Dashboard" }).click();
  await page.getByRole("heading", { name: "Dashboard" }).click();
  await page.getByRole("heading", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page
    .locator('input[type="file"]')
    .setInputFiles("test-data/raw-import-formats/neon/neon-export.csv");
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText("5 transactions imported")).toBeVisible();
  await page.locator("a").filter({ hasText: "Recent" }).click();
  await page.getByRole("textbox", { name: "Start Date" }).fill("2025-04-21");
  await page.getByRole("textbox", { name: "End Date" }).fill("2026-05-21");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("cell", { name: "Max Muster ZKB" })).toBeVisible();
});
