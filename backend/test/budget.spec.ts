import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import type { FastifyInstance } from "fastify";

type SessionCookie = { name: string; value: string; httpOnly?: boolean };

let app: FastifyInstance;

const TEST_EMAIL = "test.budget.user@example.com";
const TEST_EMAIL_2 = "test.budget.user2@example.com";
const TEST_PASSWORD = "BudgetPass!1";

let sessionCookie: string;
let sessionCookie2: string;
let testCategoryId: string;
let testUserId: string;
let testUserId2: string;

async function loginUser(email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password },
  });
  const cookies = (res.cookies as SessionCookie[] | undefined) ?? [];
  const cookie = cookies.find((c) => c.name === "session");
  return cookie!.value;
}

beforeAll(async () => {
  await prisma.dimUser.deleteMany();

  await prisma.dimCurrency.upsert({
    where: { code: "CHF" },
    create: { code: "CHF", name: "Swiss Franc", format: "CHF 1'234.56" },
    update: {},
  });

  app = await buildApp();
  await app.ready();

  // Register user 1 (Bootstrap -> becomes ADMIN)
  const r1 = await app.inject({
    method: "POST",
    url: "/api/v1/users",
    payload: { email: TEST_EMAIL, password: TEST_PASSWORD, displayName: "User 1", role: "ADMIN" },
  });
  expect(r1.statusCode).toBe(201);
  testUserId = r1.json().user.id;

  sessionCookie = await loginUser(TEST_EMAIL, TEST_PASSWORD);

  // Register user 2 (Requires ADMIN session)
  const r2 = await app.inject({
    method: "POST",
    url: "/api/v1/users",
    cookies: { session: sessionCookie },
    payload: { email: TEST_EMAIL_2, password: TEST_PASSWORD, displayName: "User 2", role: "USER" },
  });
  expect(r2.statusCode).toBe(201);
  testUserId2 = r2.json().user.id;

  sessionCookie2 = await loginUser(TEST_EMAIL_2, TEST_PASSWORD);

  // Create a category for user 1
  const category = await prisma.dimCategory.create({
    data: { categoryName: "Test_Category", userId: testUserId },
  });
  testCategoryId = category.id;
});

afterAll(async () => {
  await prisma.dimBudget.deleteMany({
    where: { userId: { in: [testUserId, testUserId2] } },
  });
  await prisma.dimCategory.deleteMany({ where: { userId: testUserId } });
  await prisma.dimUser.deleteMany({
    where: { email: { in: [TEST_EMAIL, TEST_EMAIL_2] } },
  });
  await app.close();
});

describe("Budget CRUD", () => {
  let createdBudgetId: string;

  it("POST /budgets creates a MONTHLY budget and returns 201", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
      payload: { categoryId: testCategoryId, type: "MONTHLY", limitAmount: 500 },
    });
    expect(res.statusCode).toBe(201);
    const { budget } = res.json();
    expect(budget).toMatchObject({
      categoryId: testCategoryId,
      type: "MONTHLY",
      month: 0,
      year: 0,
    });
    expect(budget).toHaveProperty("id");
    expect(budget).toHaveProperty("limitAmount");
    expect(budget).toHaveProperty("currentSpending");
    expect(Number(budget.currentSpending)).toBe(0);
    createdBudgetId = budget.id;
  });

  it("POST /budgets creates a SPECIFIC_MONTH_YEAR budget", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
      payload: {
        categoryId: testCategoryId,
        type: "SPECIFIC_MONTH_YEAR",
        month: 3,
        year: 2026,
        limitAmount: 300,
      },
    });
    expect(res.statusCode).toBe(201);
    const { budget } = res.json();
    expect(budget).toMatchObject({
      type: "SPECIFIC_MONTH_YEAR",
      month: 3,
      year: 2026,
    });
  });

  it("POST /budgets creates a DAILY budget", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
      payload: { categoryId: testCategoryId, type: "DAILY", limitAmount: 20 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().budget.type).toBe("DAILY");
  });

  it("POST /budgets creates a YEARLY budget", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
      payload: { categoryId: testCategoryId, type: "YEARLY", limitAmount: 6000 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().budget.type).toBe("YEARLY");
  });

  it("POST /budgets creates a SPECIFIC_MONTH budget", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
      payload: { categoryId: testCategoryId, type: "SPECIFIC_MONTH", month: 12, limitAmount: 800 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().budget).toMatchObject({ type: "SPECIFIC_MONTH", month: 12, year: 0 });
  });

  it("POST /budgets creates a SPECIFIC_YEAR budget", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
      payload: { categoryId: testCategoryId, type: "SPECIFIC_YEAR", year: 2027, limitAmount: 5000 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().budget).toMatchObject({ type: "SPECIFIC_YEAR", month: 0, year: 2027 });
  });

  it("GET /budgets returns all budgets for the user", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
    });
    expect(res.statusCode).toBe(200);
    const { budgets } = res.json();
    expect(Array.isArray(budgets)).toBe(true);
    expect(budgets.length).toBeGreaterThanOrEqual(6);
    const found = budgets.find((b: { id: string }) => b.id === createdBudgetId);
    expect(found).toBeDefined();
    expect(Number(found.currentSpending)).toBe(0);
  });

  it("POST /budgets with duplicate type+category returns 409", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
      payload: { categoryId: testCategoryId, type: "MONTHLY", limitAmount: 300 },
    });
    expect(res.statusCode).toBe(409);
  });

  it("POST /budgets with SPECIFIC_MONTH_YEAR missing month returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
      payload: {
        categoryId: testCategoryId,
        type: "SPECIFIC_MONTH_YEAR",
        year: 2026,
        limitAmount: 300,
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /budgets with SPECIFIC_YEAR missing year returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
      payload: { categoryId: testCategoryId, type: "SPECIFIC_YEAR", limitAmount: 300 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /budgets with invalid type returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
      payload: { categoryId: testCategoryId, type: "INVALID", limitAmount: 300 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /budgets with limitAmount <= 0 returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
      payload: { categoryId: testCategoryId, type: "MONTHLY", limitAmount: 0 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("PATCH /budgets/:id updates limitAmount", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/budgets/${createdBudgetId}`,
      cookies: { session: sessionCookie },
      payload: { limitAmount: 750 },
    });
    expect(res.statusCode).toBe(200);
    const { budget } = res.json();
    expect(Number(budget.limitAmount)).toBe(750);
    expect(budget).toHaveProperty("currentSpending");
  });

  it("PATCH /budgets/:id with another user's budget returns 404 and does not mutate", async () => {
    const before = await prisma.dimBudget.findUniqueOrThrow({ where: { id: createdBudgetId } });
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/budgets/${createdBudgetId}`,
      cookies: { session: sessionCookie2 },
      payload: { limitAmount: 100 },
    });
    expect(res.statusCode).toBe(404);
    // 404-on-stranger contract is "deny + no-op": the row must be untouched.
    const after = await prisma.dimBudget.findUniqueOrThrow({ where: { id: createdBudgetId } });
    expect(Number(after.limitAmount)).toBe(Number(before.limitAmount));
    expect(after.categoryId).toBe(before.categoryId);
    expect(after.type).toBe(before.type);
  });

  it("DELETE /budgets/:id with another user's budget returns 404 and does not delete", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/budgets/${createdBudgetId}`,
      cookies: { session: sessionCookie2 },
    });
    expect(res.statusCode).toBe(404);
    // The budget must still exist after the 404.
    const stillThere = await prisma.dimBudget.findUnique({ where: { id: createdBudgetId } });
    expect(stillThere).not.toBeNull();
  });

  it("DELETE /budgets/:id returns 204 and budget is gone", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/budgets/${createdBudgetId}`,
      cookies: { session: sessionCookie },
    });
    expect(res.statusCode).toBe(204);

    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
    });
    const { budgets } = listRes.json();
    expect(budgets.find((b: { id: string }) => b.id === createdBudgetId)).toBeUndefined();
  });

  it("GET /budgets without session returns 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/budgets",
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /budgets without session returns 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      payload: { categoryId: testCategoryId, type: "MONTHLY", limitAmount: 200 },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /budgets with categoryId not belonging to user returns 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie2 },
      payload: { categoryId: testCategoryId, type: "MONTHLY", limitAmount: 200 },
    });
    expect(res.statusCode).toBe(404);
  });

  it("GET /budgets reflects currentSpending from transactions", async () => {
    // Create a SPECIFIC_MONTH_YEAR budget for month 6 / 2026
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
      payload: {
        categoryId: testCategoryId,
        type: "SPECIFIC_MONTH_YEAR",
        month: 6,
        year: 2026,
        limitAmount: 1000,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const budgetId = createRes.json().budget.id;

    // Set up transaction fixtures
    const currency = await prisma.dimCurrency.findFirstOrThrow({ where: { code: "CHF" } });
    const merchant = await prisma.dimMerchant.create({ data: { name: "Test Grocery Store" } });
    await prisma.userMerchantMapping.create({
      data: { userId: testUserId, merchantId: merchant.id, categoryId: testCategoryId },
    });
    const dateId = 20260615;
    await prisma.dimDate.upsert({
      where: { id: dateId },
      create: { id: dateId, dayOfWeek: "Monday", month: 6, year: 2026 },
      update: {},
    });
    const account = await prisma.dimAccount.create({
      data: {
        name: "Test Account",
        iban: "CH00 0000 0000 0000 0001 0",
        currencyId: currency.id,
        userId: testUserId,
      },
    });
    await prisma.factTransactions.createMany({
      data: [
        {
          amount: -50.25,
          userId: testUserId,
          accountId: account.id,
          merchantId: merchant.id,
          categoryId: testCategoryId,
          dateId,
        },
        {
          amount: -149.75,
          userId: testUserId,
          accountId: account.id,
          merchantId: merchant.id,
          categoryId: testCategoryId,
          dateId,
        },
      ],
    });

    // GET /budgets should reflect total spending of 200.00
    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
    });
    expect(listRes.statusCode).toBe(200);
    const found = listRes.json().budgets.find((b: { id: string }) => b.id === budgetId);
    expect(found).toBeDefined();
    expect(Number(found.currentSpending)).toBe(200);
    expect(found.percentageUsed).toBe(20);
    expect(Number(found.remainingAmount)).toBe(800);
    expect(found.isOverBudget).toBe(false);

    // Clean up fixtures
    await prisma.factTransactions.deleteMany({ where: { accountId: account.id } });
    await prisma.dimAccount.delete({ where: { id: account.id } });
    await prisma.userMerchantMapping.delete({
      where: { userId_merchantId: { userId: testUserId, merchantId: merchant.id } },
    });
    await prisma.dimMerchant.delete({ where: { id: merchant.id } });
    await prisma.dimBudget.delete({ where: { id: budgetId } });
  });

  it("GET /budgets reflects currentSpending for MONTHLY budget (current month)", async () => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const currentDay = now.getDate();

    // Create a separate category for this test
    const category = await prisma.dimCategory.create({
      data: { categoryName: "Monthly Test Cat", userId: testUserId },
    });

    // Create MONTHLY budget
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
      payload: { categoryId: category.id, type: "MONTHLY", limitAmount: 1000 },
    });
    expect(createRes.statusCode).toBe(201);
    const budgetId = createRes.json().budget.id;

    // Set up transaction fixtures for today's date
    const currency = await prisma.dimCurrency.findFirstOrThrow({ where: { code: "CHF" } });
    const merchant = await prisma.dimMerchant.create({ data: { name: "Monthly Test Store" } });
    await prisma.userMerchantMapping.create({
      data: { userId: testUserId, merchantId: merchant.id, categoryId: category.id },
    });
    const dateId = currentYear * 10000 + currentMonth * 100 + currentDay;
    await prisma.dimDate.upsert({
      where: { id: dateId },
      create: { id: dateId, dayOfWeek: "Monday", month: currentMonth, year: currentYear },
      update: {},
    });
    const account = await prisma.dimAccount.create({
      data: {
        name: "Monthly Test Acc",
        iban: "CH00 0000 0000 0000 0002 0",
        currencyId: currency.id,
        userId: testUserId,
      },
    });
    await prisma.factTransactions.create({
      data: {
        amount: -75.0,
        userId: testUserId,
        accountId: account.id,
        merchantId: merchant.id,
        categoryId: category.id,
        dateId,
      },
    });

    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
    });
    expect(listRes.statusCode).toBe(200);
    const found = listRes.json().budgets.find((b: { id: string }) => b.id === budgetId);
    expect(found).toBeDefined();
    expect(Number(found.currentSpending)).toBe(75);

    // Clean up
    await prisma.factTransactions.deleteMany({ where: { accountId: account.id } });
    await prisma.dimAccount.delete({ where: { id: account.id } });
    await prisma.userMerchantMapping.delete({
      where: { userId_merchantId: { userId: testUserId, merchantId: merchant.id } },
    });
    await prisma.dimMerchant.delete({ where: { id: merchant.id } });
    await prisma.dimBudget.delete({ where: { id: budgetId } });
    await prisma.dimCategory.delete({ where: { id: category.id } });
  });

  it("GET /budgets reflects currentSpending for DAILY budget (today only)", async () => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const currentDay = now.getDate();

    const category = await prisma.dimCategory.create({
      data: { categoryName: "Daily Test Cat", userId: testUserId },
    });

    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
      payload: { categoryId: category.id, type: "DAILY", limitAmount: 50 },
    });
    expect(createRes.statusCode).toBe(201);
    const budgetId = createRes.json().budget.id;

    const currency = await prisma.dimCurrency.findFirstOrThrow({ where: { code: "CHF" } });
    const merchant = await prisma.dimMerchant.create({ data: { name: "Daily Test Store" } });
    await prisma.userMerchantMapping.create({
      data: { userId: testUserId, merchantId: merchant.id, categoryId: category.id },
    });

    const todayDateId = currentYear * 10000 + currentMonth * 100 + currentDay;
    await prisma.dimDate.upsert({
      where: { id: todayDateId },
      create: { id: todayDateId, dayOfWeek: "Monday", month: currentMonth, year: currentYear },
      update: {},
    });

    // Transaction from a different day (yesterday) — should NOT count
    const yesterdayDay = currentDay > 1 ? currentDay - 1 : 1;
    const yesterdayDateId = currentYear * 10000 + currentMonth * 100 + yesterdayDay;
    if (currentDay > 1) {
      await prisma.dimDate.upsert({
        where: { id: yesterdayDateId },
        create: {
          id: yesterdayDateId,
          dayOfWeek: "Sunday",
          month: currentMonth,
          year: currentYear,
        },
        update: {},
      });
    }

    const account = await prisma.dimAccount.create({
      data: {
        name: "Daily Test Acc",
        iban: "CH00 0000 0000 0000 0003 0",
        currencyId: currency.id,
        userId: testUserId,
      },
    });

    await prisma.factTransactions.createMany({
      data: [
        // Today's transaction — should count
        {
          amount: -15.0,
          userId: testUserId,
          accountId: account.id,
          merchantId: merchant.id,
          categoryId: category.id,
          dateId: todayDateId,
        },
        // Yesterday's transaction — should NOT count for daily budget
        ...(currentDay > 1
          ? [
              {
                amount: -99.0,
                userId: testUserId,
                accountId: account.id,
                merchantId: merchant.id,
                categoryId: category.id,
                dateId: yesterdayDateId,
              },
            ]
          : []),
      ],
    });

    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
    });
    expect(listRes.statusCode).toBe(200);
    const found = listRes.json().budgets.find((b: { id: string }) => b.id === budgetId);
    expect(found).toBeDefined();
    expect(Number(found.currentSpending)).toBe(15);

    // Clean up
    await prisma.factTransactions.deleteMany({ where: { accountId: account.id } });
    await prisma.dimAccount.delete({ where: { id: account.id } });
    await prisma.userMerchantMapping.delete({
      where: { userId_merchantId: { userId: testUserId, merchantId: merchant.id } },
    });
    await prisma.dimMerchant.delete({ where: { id: merchant.id } });
    await prisma.dimBudget.delete({ where: { id: budgetId } });
    await prisma.dimCategory.delete({ where: { id: category.id } });
  });

  it("GET /budgets reflects currentSpending for YEARLY budget (all months in current year)", async () => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const currentDay = now.getDate();

    const category = await prisma.dimCategory.create({
      data: { categoryName: "Yearly Test Cat", userId: testUserId },
    });

    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
      payload: { categoryId: category.id, type: "YEARLY", limitAmount: 10000 },
    });
    expect(createRes.statusCode).toBe(201);
    const budgetId = createRes.json().budget.id;

    const currency = await prisma.dimCurrency.findFirstOrThrow({ where: { code: "CHF" } });
    const merchant = await prisma.dimMerchant.create({ data: { name: "Yearly Test Store" } });
    await prisma.userMerchantMapping.create({
      data: { userId: testUserId, merchantId: merchant.id, categoryId: category.id },
    });

    // Transaction in current month
    const dateId1 = currentYear * 10000 + currentMonth * 100 + currentDay;
    await prisma.dimDate.upsert({
      where: { id: dateId1 },
      create: { id: dateId1, dayOfWeek: "Monday", month: currentMonth, year: currentYear },
      update: {},
    });

    // Transaction in January of current year (different month, same year — should count)
    const dateId2 = currentYear * 10000 + 100 + 15; // Jan 15
    await prisma.dimDate.upsert({
      where: { id: dateId2 },
      create: { id: dateId2, dayOfWeek: "Thursday", month: 1, year: currentYear },
      update: {},
    });

    const account = await prisma.dimAccount.create({
      data: {
        name: "Yearly Test Acc",
        iban: "CH00 0000 0000 0000 0004 0",
        currencyId: currency.id,
        userId: testUserId,
      },
    });

    await prisma.factTransactions.createMany({
      data: [
        {
          amount: -100.0,
          userId: testUserId,
          accountId: account.id,
          merchantId: merchant.id,
          categoryId: category.id,
          dateId: dateId1,
        },
        {
          amount: -200.0,
          userId: testUserId,
          accountId: account.id,
          merchantId: merchant.id,
          categoryId: category.id,
          dateId: dateId2,
        },
      ],
    });

    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
    });
    expect(listRes.statusCode).toBe(200);
    const found = listRes.json().budgets.find((b: { id: string }) => b.id === budgetId);
    expect(found).toBeDefined();
    expect(Number(found.currentSpending)).toBe(300);

    // Clean up
    await prisma.factTransactions.deleteMany({ where: { accountId: account.id } });
    await prisma.dimAccount.delete({ where: { id: account.id } });
    await prisma.userMerchantMapping.delete({
      where: { userId_merchantId: { userId: testUserId, merchantId: merchant.id } },
    });
    await prisma.dimMerchant.delete({ where: { id: merchant.id } });
    await prisma.dimBudget.delete({ where: { id: budgetId } });
    await prisma.dimCategory.delete({ where: { id: category.id } });
  });
});

describe("Budget full-edit contract", () => {
  // Self-contained fixtures — does not depend on Budget CRUD's residual state.
  // beforeEach resets budgets so each `it` is order-independent.
  let fullEditCatA: string; // owns the mutable budgetA
  let fullEditCatB: string; // owns the conflict-target budgetB
  let strangerCatId: string; // category owned by testUserId2 — for stranger 404 tests
  let budgetAId: string;
  let strangerBudgetId: string;

  beforeAll(async () => {
    fullEditCatA = (
      await prisma.dimCategory.create({
        data: { categoryName: "Test_FullEdit_CatA", userId: testUserId },
      })
    ).id;
    fullEditCatB = (
      await prisma.dimCategory.create({
        data: { categoryName: "Test_FullEdit_CatB", userId: testUserId },
      })
    ).id;
    strangerCatId = (
      await prisma.dimCategory.create({
        data: { categoryName: "Test_FullEdit_Stranger", userId: testUserId2 },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.dimBudget.deleteMany({
      where: { categoryId: { in: [fullEditCatA, fullEditCatB, strangerCatId] } },
    });
    await prisma.dimCategory.deleteMany({
      where: { id: { in: [fullEditCatA, fullEditCatB, strangerCatId] } },
    });
  });

  beforeEach(async () => {
    // Reset all fixture budgets so tests can run in any order.
    await prisma.dimBudget.deleteMany({
      where: { categoryId: { in: [fullEditCatA, fullEditCatB, strangerCatId] } },
    });

    const rA = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
      payload: { categoryId: fullEditCatA, type: "MONTHLY", limitAmount: 300 },
    });
    expect(rA.statusCode).toBe(201);
    budgetAId = rA.json().budget.id;

    // budgetB is the conflict-target fixture; only its existence matters here.
    const rB = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
      payload: {
        categoryId: fullEditCatB,
        type: "SPECIFIC_MONTH_YEAR",
        month: 5,
        year: 2026,
        limitAmount: 200,
      },
    });
    expect(rB.statusCode).toBe(201);

    const rStranger = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie2 },
      payload: { categoryId: strangerCatId, type: "MONTHLY", limitAmount: 100 },
    });
    expect(rStranger.statusCode).toBe(201);
    strangerBudgetId = rStranger.json().budget.id;
  });

  it("POST /budgets response includes full contract shape with concrete isActive/priority values", async () => {
    // Use SPECIFIC_YEAR for the current year so isActive is deterministically true
    // regardless of when this test runs.
    const currentYear = new Date().getFullYear();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
      payload: {
        categoryId: fullEditCatA,
        type: "SPECIFIC_YEAR",
        year: currentYear,
        limitAmount: 150,
      },
    });
    expect(res.statusCode).toBe(201);
    const { budget } = res.json();
    expect(budget).toMatchObject({
      categoryId: fullEditCatA,
      type: "SPECIFIC_YEAR",
      month: 0,
      year: currentYear,
      isActive: true,
      priority: 2, // SPECIFIC_YEAR
    });
    expect(budget).toHaveProperty("id");
    expect(budget).toHaveProperty("limitAmount");
    expect(budget).toHaveProperty("currentSpending");
    expect(budget).toHaveProperty("percentageUsed");
    expect(budget).toHaveProperty("remainingAmount");
    expect(budget).toHaveProperty("isOverBudget");
  });

  it("PATCH /budgets/:id returns 400 when limitAmount is negative", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/budgets/${budgetAId}`,
      cookies: { session: sessionCookie },
      payload: { limitAmount: -10 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("PATCH /budgets/:id updates categoryId and returns 200 with new categoryId", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/budgets/${budgetAId}`,
      cookies: { session: sessionCookie },
      payload: { categoryId: fullEditCatB },
    });
    expect(res.statusCode).toBe(200);
    const { budget } = res.json();
    expect(budget.categoryId).toBe(fullEditCatB);
    expect(budget.type).toBe("MONTHLY"); // type unchanged
  });

  it("PATCH /budgets/:id updates type, month, and year in one request (200)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/budgets/${budgetAId}`,
      cookies: { session: sessionCookie },
      payload: { type: "SPECIFIC_MONTH_YEAR", month: 8, year: 2025 },
    });
    expect(res.statusCode).toBe(200);
    const { budget } = res.json();
    expect(budget.type).toBe("SPECIFIC_MONTH_YEAR");
    expect(budget.month).toBe(8);
    expect(budget.year).toBe(2025);
  });

  it("PATCH /budgets/:id returns 409 when the update creates a duplicate budget and budgetA is unchanged", async () => {
    // Move budgetA onto fullEditCatB as SPECIFIC_MONTH_YEAR, month=5, year=2026 — duplicates budgetB.
    const before = await prisma.dimBudget.findUniqueOrThrow({ where: { id: budgetAId } });
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/budgets/${budgetAId}`,
      cookies: { session: sessionCookie },
      payload: { categoryId: fullEditCatB, type: "SPECIFIC_MONTH_YEAR", month: 5, year: 2026 },
    });
    expect(res.statusCode).toBe(409);
    // The 409 must be "deny + no-op": budgetA must retain its original categoryId/type/month/year.
    const after = await prisma.dimBudget.findUniqueOrThrow({ where: { id: budgetAId } });
    expect(after.categoryId).toBe(before.categoryId);
    expect(after.type).toBe(before.type);
    expect(after.month).toBe(before.month);
    expect(after.year).toBe(before.year);
  });

  it("PATCH /budgets/:id updates limitAmount and response has full contract shape", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/budgets/${budgetAId}`,
      cookies: { session: sessionCookie },
      payload: { limitAmount: 999 },
    });
    expect(res.statusCode).toBe(200);
    const { budget } = res.json();
    expect(Number(budget.limitAmount)).toBe(999);
    expect(budget).toHaveProperty("id");
    expect(budget).toHaveProperty("categoryId");
    expect(budget).toHaveProperty("type");
    expect(budget).toHaveProperty("month");
    expect(budget).toHaveProperty("year");
    expect(budget).toHaveProperty("currentSpending");
    expect(budget).toHaveProperty("percentageUsed");
    expect(budget).toHaveProperty("remainingAmount");
    expect(budget).toHaveProperty("isOverBudget");
    expect(budget).toHaveProperty("isActive");
    expect(budget).toHaveProperty("priority");
  });

  it("PATCH /budgets/:id returns 404 when categoryId does not belong to the user", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/budgets/${budgetAId}`,
      cookies: { session: sessionCookie },
      payload: { categoryId: randomUUID() },
    });
    expect(res.statusCode).toBe(404);
  });

  it("PATCH /budgets/:id with limitAmount only returns 404 for a stranger's budget and does not mutate", async () => {
    const before = await prisma.dimBudget.findUniqueOrThrow({ where: { id: strangerBudgetId } });
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/budgets/${strangerBudgetId}`,
      cookies: { session: sessionCookie },
      payload: { limitAmount: 50 },
    });
    expect(res.statusCode).toBe(404);
    const after = await prisma.dimBudget.findUniqueOrThrow({ where: { id: strangerBudgetId } });
    expect(Number(after.limitAmount)).toBe(Number(before.limitAmount));
  });

  it("DELETE /budgets/:id returns 404 for a stranger's budget", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/budgets/${strangerBudgetId}`,
      cookies: { session: sessionCookie },
    });
    expect(res.statusCode).toBe(404);
    // Verify the stranger's budget still exists
    const stillThere = await prisma.dimBudget.findUnique({ where: { id: strangerBudgetId } });
    expect(stillThere).not.toBeNull();
  });
});
