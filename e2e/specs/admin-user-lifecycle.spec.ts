import { test, expect, type Page } from "@playwright/test";
import { ADMIN_STORAGE_STATE } from "../global-setup";
import { loginAsAdmin, E2E_PASSWORD } from "../helpers/auth";
import { cleanup, newCleanupBag } from "../helpers/seed";

const NEW_USER_EMAIL = `e2e-lifecycle-${Date.now()}@test.local`;
const NEW_USER_NAME = `E2E Lifecycle ${Date.now()}`;

test.describe.configure({ mode: "serial" });

test.describe("admin user lifecycle", () => {
  const bag = newCleanupBag();
  let newUserId: string | null = null;

  test.afterAll(async ({ playwright }) => {
    const baseURL = test.info().project.use.baseURL ?? "http://localhost:5173";
    const admin = await loginAsAdmin(baseURL);
    try {
      await cleanup(admin, bag);
    } finally {
      await admin.dispose();
    }
    void playwright;
  });

  test("admin creates new user via Settings → User Management", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ADMIN_STORAGE_STATE });
    const page = await ctx.newPage();
    try {
      await page.goto("/settings/users");
      await expect(page.getByRole("heading", { level: 2, name: "Users" })).toBeVisible();

      await page.getByRole("button", { name: "Create User" }).first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Create New User" })).toBeVisible();

      await dialog.getByLabel("Email").fill(NEW_USER_EMAIL);
      await dialog.getByLabel("Password").fill(E2E_PASSWORD);
      await dialog.getByLabel("Display Name").fill(NEW_USER_NAME);
      await dialog.getByRole("button", { name: "Create User" }).click();

      await expect(dialog).toBeHidden();
      await expect(page.getByRole("cell", { name: NEW_USER_EMAIL })).toBeVisible();

      const admin = await loginAsAdmin(test.info().project.use.baseURL ?? "http://localhost:5173");
      try {
        const users = await admin.users.list({ limit: 100 });
        const created = users.find((u) => u.email === NEW_USER_EMAIL);
        expect(created, "new user should exist via API").toBeDefined();
        newUserId = created!.id;
        bag.userIds.push(newUserId);
      } finally {
        await admin.dispose();
      }
    } finally {
      await ctx.close();
    }
  });

  test("new user can sign in and reaches the dashboard", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await signInViaUI(page, NEW_USER_EMAIL, E2E_PASSWORD);
      await expect(page).toHaveURL(/\/$|\/dashboard/);
      await expect(page.getByText(`Welcome back, ${NEW_USER_NAME}`)).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test("non-admin does NOT see User Management link in Settings", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await signInViaUI(page, NEW_USER_EMAIL, E2E_PASSWORD);
      await page.getByRole("link", { name: "Settings" }).click();
      await expect(page).toHaveURL(/\/settings/);
      await expect(page.getByRole("link", { name: "Profile" })).toBeVisible();
      await expect(page.getByRole("link", { name: "User Management" })).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });

  test("admin deactivates the new user", async ({ browser }) => {
    expect(newUserId, "newUserId must be set by the first test").not.toBeNull();
    const ctx = await browser.newContext({ storageState: ADMIN_STORAGE_STATE });
    const page = await ctx.newPage();
    try {
      await page.goto("/settings/users");
      const row = page.getByRole("row", { name: new RegExp(NEW_USER_EMAIL) });
      await expect(row).toBeVisible();
      await row.getByRole("button", { name: "Deactivate" }).click();
      await expect(row.getByText("Deactivated")).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test("deactivated user is blocked from signing in", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await page.goto("/login");
      await page.getByLabel("Email").fill(NEW_USER_EMAIL);
      await page.getByLabel("Password").fill(E2E_PASSWORD);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByRole("alert")).toContainText(/deactivated/i);
      await expect(page).toHaveURL(/\/login/);
    } finally {
      await ctx.close();
    }
  });
});

async function signInViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}
