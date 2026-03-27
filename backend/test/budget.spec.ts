import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
  // Clean up
  await prisma.dimUser.deleteMany({
    where: { email: { in: [TEST_EMAIL, TEST_EMAIL_2] } },
  });

  await prisma.dimCurrency.upsert({
    where: { code: "CHF" },
    create: { code: "CHF", name: "Swiss Franc", format: "CHF 1'234.56" },
    update: {},
  });

  app = await buildApp();
  await app.ready();

  // Register user 1
  const r1 = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  expect(r1.statusCode).toBe(201);
  testUserId = r1.json().user.id;

  // Register user 2
  const r2 = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { email: TEST_EMAIL_2, password: TEST_PASSWORD },
  });
  expect(r2.statusCode).toBe(201);
  testUserId2 = r2.json().user.id;

  sessionCookie = await loginUser(TEST_EMAIL, TEST_PASSWORD);
  sessionCookie2 = await loginUser(TEST_EMAIL_2, TEST_PASSWORD);

  // Create a category for user 1
  const category = await prisma.dimCategory.create({
    data: { categoryName: "Groceries", userId: testUserId },
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

  it("POST /budgets creates a budget and returns 201 with correct shape", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
      payload: { categoryId: testCategoryId, month: 3, year: 2026, limitAmount: 500 },
    });
    expect(res.statusCode).toBe(201);
    const { budget } = res.json();
    expect(budget).toMatchObject({
      categoryId: testCategoryId,
      month: 3,
      year: 2026,
    });
    expect(budget).toHaveProperty("id");
    expect(budget).toHaveProperty("limitAmount");
    expect(budget).toHaveProperty("currentSpending");
    expect(Number(budget.currentSpending)).toBe(0);
    createdBudgetId = budget.id;
  });

  it("GET /budgets returns list including the created budget with currentSpending", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
    });
    expect(res.statusCode).toBe(200);
    const { budgets } = res.json();
    expect(Array.isArray(budgets)).toBe(true);
    const found = budgets.find((b: { id: string }) => b.id === createdBudgetId);
    expect(found).toBeDefined();
    expect(Number(found.currentSpending)).toBe(0);
  });

  it("POST /budgets with same categoryId+month+year returns 409", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
      payload: { categoryId: testCategoryId, month: 3, year: 2026, limitAmount: 300 },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toHaveProperty(
      "message",
      "Budget already exists for this category and month",
    );
  });

  it("POST /budgets with invalid month returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
      payload: { categoryId: testCategoryId, month: 13, year: 2026, limitAmount: 500 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /budgets with limitAmount <= 0 returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie },
      payload: { categoryId: testCategoryId, month: 4, year: 2026, limitAmount: 0 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("PATCH /budgets/:id updates limitAmount and returns updated budget", async () => {
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

  it("PATCH /budgets/:id with another user's budget returns 404", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/budgets/${createdBudgetId}`,
      cookies: { session: sessionCookie2 },
      payload: { limitAmount: 100 },
    });
    expect(res.statusCode).toBe(404);
  });

  it("DELETE /budgets/:id with another user's budget returns 404", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/budgets/${createdBudgetId}`,
      cookies: { session: sessionCookie2 },
    });
    expect(res.statusCode).toBe(404);
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
      payload: { categoryId: testCategoryId, month: 5, year: 2026, limitAmount: 200 },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /budgets with categoryId not belonging to user returns 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/budgets",
      cookies: { session: sessionCookie2 },
      payload: { categoryId: testCategoryId, month: 6, year: 2026, limitAmount: 200 },
    });
    expect(res.statusCode).toBe(404);
  });
});
