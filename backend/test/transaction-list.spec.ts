import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import type { FastifyInstance } from "fastify";

type SessionCookie = { name: string; value: string; httpOnly?: boolean };

let app: FastifyInstance;

const TEST_EMAIL = "test.txlist.user@example.com";
const TEST_EMAIL_2 = "test.txlist.user2@example.com";
const TEST_PASSWORD = "TxListPass!1";

let sessionCookie: string;
let sessionCookie2: string;
let testUserId: string;
let testUserId2: string;
let testAccountId: string;
let testCategoryId: string;

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
  // Clean up leftover test data
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

  // Register user 1 (Bootstrap -> becomes ADMIN)
  const r1 = await app.inject({
    method: "POST",
    url: "/api/v1/users",
    payload: { email: TEST_EMAIL, password: TEST_PASSWORD, displayName: "User 1", role: "ADMIN" },
  });
  expect(r1.statusCode).toBe(201);
  testUserId = r1.json().user.id;

  sessionCookie = await loginUser(TEST_EMAIL, TEST_PASSWORD);

  const r2 = await app.inject({
    method: "POST",
    url: "/api/v1/users",
    cookies: { session: sessionCookie },
    payload: { email: TEST_EMAIL_2, password: TEST_PASSWORD, displayName: "User 2", role: "USER" },
  });
  expect(r2.statusCode).toBe(201);
  testUserId2 = r2.json().user.id;

  sessionCookie2 = await loginUser(TEST_EMAIL_2, TEST_PASSWORD);
  sessionCookie2 = await loginUser(TEST_EMAIL_2, TEST_PASSWORD);

  // Create category and merchant mapping for user 1
  const category = await prisma.dimCategory.create({
    data: { categoryName: "Groceries", userId: testUserId },
  });
  testCategoryId = category.id;

  const currency = await prisma.dimCurrency.findFirstOrThrow({ where: { code: "CHF" } });
  const account = await prisma.dimAccount.create({
    data: {
      name: "Test TX Account",
      iban: "CH00 0000 0000 0000 0099 0",
      currencyId: currency.id,
      userId: testUserId,
    },
  });
  testAccountId = account.id;

  // Create merchants
  const merchantA = await prisma.dimMerchant.create({ data: { name: "TxTest Supermarket" } });
  const merchantB = await prisma.dimMerchant.create({ data: { name: "TxTest Electronics" } });

  // Map merchantA to Groceries category for user 1
  await prisma.userMerchantMapping.create({
    data: { userId: testUserId, merchantId: merchantA.id, categoryId: testCategoryId },
  });

  // Seed dates
  const dates = [
    { id: 20250115, dayOfWeek: "Wednesday", month: 1, year: 2025 },
    { id: 20250220, dayOfWeek: "Thursday", month: 2, year: 2025 },
    { id: 20250310, dayOfWeek: "Monday", month: 3, year: 2025 },
  ];
  for (const d of dates) {
    await prisma.dimDate.upsert({ where: { id: d.id }, create: d, update: {} });
  }

  // Seed transactions for user 1
  await prisma.factTransactions.createMany({
    data: [
      {
        amount: 25.5,
        userId: testUserId,
        accountId: testAccountId,
        merchantId: merchantA.id,
        dateId: 20250115,
      },
      {
        amount: 150.0,
        userId: testUserId,
        accountId: testAccountId,
        merchantId: merchantA.id,
        dateId: 20250220,
      },
      {
        amount: 499.99,
        userId: testUserId,
        accountId: testAccountId,
        merchantId: merchantB.id,
        dateId: 20250310,
      },
    ],
  });

  // Seed a transaction for user 2 (should not be visible to user 1)
  const account2 = await prisma.dimAccount.create({
    data: {
      name: "Test TX Account 2",
      iban: "CH00 0000 0000 0000 0098 0",
      currencyId: currency.id,
      userId: testUserId2,
    },
  });
  await prisma.factTransactions.createMany({
    data: [
      {
        amount: 999.0,
        userId: testUserId2,
        accountId: account2.id,
        merchantId: merchantA.id,
        dateId: 20250115,
      },
    ],
  });
});

afterAll(async () => {
  // Clean up in correct order (foreign key constraints)
  await prisma.factTransactions.deleteMany({
    where: { userId: { in: [testUserId, testUserId2] } },
  });
  await prisma.dimAccount.deleteMany({ where: { userId: { in: [testUserId, testUserId2] } } });
  await prisma.userMerchantMapping.deleteMany({ where: { userId: testUserId } });
  await prisma.dimMerchant.deleteMany({ where: { name: { startsWith: "TxTest" } } });
  await prisma.dimCategory.deleteMany({ where: { userId: testUserId } });
  await prisma.dimUser.deleteMany({ where: { email: { in: [TEST_EMAIL, TEST_EMAIL_2] } } });
  await app.close();
});

describe("GET /transactions", () => {
  it("returns 401 without session", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transactions",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns paginated response with correct shape", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transactions",
      cookies: { session: sessionCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("meta");
    expect(body.meta).toMatchObject({
      totalCount: 3,
      totalPages: 1,
      page: 1,
      limit: 20,
    });
    expect(body.data).toHaveLength(3);
  });

  it("each transaction has expected fields", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transactions",
      cookies: { session: sessionCookie },
    });
    const tx = res.json().data[0];
    expect(tx).toHaveProperty("id");
    expect(tx).toHaveProperty("amount");
    expect(tx).toHaveProperty("date");
    expect(tx).toHaveProperty("accountId");
    expect(tx).toHaveProperty("merchantId");
    expect(tx).toHaveProperty("merchant");
    expect(tx).toHaveProperty("categoryId");
    expect(tx).toHaveProperty("categoryName");
  });

  it("user isolation: user 2 does not see user 1 transactions", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transactions",
      cookies: { session: sessionCookie2 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.meta.totalCount).toBe(1);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].amount).toBe("999");
  });

  it("pagination limits results", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transactions?limit=2&page=1",
      cookies: { session: sessionCookie },
    });
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.meta.totalCount).toBe(3);
    expect(body.meta.totalPages).toBe(2);
  });

  it("page 2 returns remaining results", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transactions?limit=2&page=2",
      cookies: { session: sessionCookie },
    });
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.meta.page).toBe(2);
  });

  it("sorts by amount ascending", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transactions?sortBy=amount&sortOrder=asc",
      cookies: { session: sessionCookie },
    });
    const amounts = res.json().data.map((t: { amount: string }) => parseFloat(t.amount));
    expect(amounts).toEqual([...amounts].sort((a, b) => a - b));
  });

  it("sorts by date descending (default)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transactions",
      cookies: { session: sessionCookie },
    });
    const dates = res.json().data.map((t: { date: string }) => t.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("filters by date range", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transactions?startDate=2025-02-01&endDate=2025-03-31",
      cookies: { session: sessionCookie },
    });
    const body = res.json();
    expect(body.meta.totalCount).toBe(2);
    for (const tx of body.data) {
      expect(tx.date >= "2025-02-01").toBe(true);
      expect(tx.date <= "2025-03-31").toBe(true);
    }
  });

  it("filters by amount range", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transactions?minAmount=100&maxAmount=500",
      cookies: { session: sessionCookie },
    });
    const body = res.json();
    expect(body.meta.totalCount).toBe(2);
    for (const tx of body.data) {
      const amount = parseFloat(tx.amount);
      expect(amount).toBeGreaterThanOrEqual(100);
      expect(amount).toBeLessThanOrEqual(500);
    }
  });

  it("filters by categoryId", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/transactions?categoryId=${testCategoryId}`,
      cookies: { session: sessionCookie },
    });
    const body = res.json();
    // Only merchantA is mapped to Groceries — 2 transactions
    expect(body.meta.totalCount).toBe(2);
    for (const tx of body.data) {
      expect(tx.categoryId).toBe(testCategoryId);
      expect(tx.categoryName).toBe("Groceries");
    }
  });

  it("category fields are null for unmapped merchants", async () => {
    // merchantB has no mapping — filter by high amount to get that transaction
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transactions?minAmount=400",
      cookies: { session: sessionCookie },
    });
    const body = res.json();
    expect(body.meta.totalCount).toBe(1);
    expect(body.data[0].categoryId).toBeNull();
    expect(body.data[0].categoryName).toBeNull();
  });

  it("returns 400 when minAmount exceeds maxAmount", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transactions?minAmount=100&maxAmount=10",
      cookies: { session: sessionCookie },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for invalid query params", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transactions?page=abc",
      cookies: { session: sessionCookie },
    });
    expect(res.statusCode).toBe(400);
  });
});
