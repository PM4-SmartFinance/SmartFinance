import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import type { FastifyInstance } from "fastify";

type SessionCookie = { name: string; value: string; httpOnly?: boolean };

let app: FastifyInstance;

const TEST_EMAIL = "test.dashboard.user@example.com";
const TEST_EMAIL_2 = "test.dashboard.user2@example.com";
const TEST_PASSWORD = "DashboardPass!1";

let sessionCookie: string;
let testUserId: string;
let testUserId2: string;
let testAccountId: string;
let testAccountId2: string;
let testMerchantId: string;
let testMerchantId2: string;

function getMonthAnchor(offsetMonths: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + offsetMonths);

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = 15;

  return {
    year,
    month,
    day,
    dateId: year * 10000 + month * 100 + day,
  };
}

async function seedTransaction(
  userId: string,
  accountId: string,
  merchantId: string,
  amount: number,
  offsetMonths: number,
) {
  const anchor = getMonthAnchor(offsetMonths);

  await prisma.dimDate.upsert({
    where: { id: anchor.dateId },
    create: {
      id: anchor.dateId,
      dayOfWeek: "Monday",
      month: anchor.month,
      year: anchor.year,
    },
    update: {},
  });

  await prisma.factTransactions.create({
    data: {
      amount,
      userId,
      accountId,
      merchantId,
      dateId: anchor.dateId,
    },
  });
}

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
  await prisma.dimUser.deleteMany({ where: { email: { in: [TEST_EMAIL, TEST_EMAIL_2] } } });

  await prisma.dimCurrency.upsert({
    where: { code: "CHF" },
    create: { code: "CHF", name: "Swiss Franc", format: "CHF 1'234.56" },
    update: {},
  });

  app = await buildApp();
  await app.ready();

  const registerOne = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  expect(registerOne.statusCode).toBe(201);
  testUserId = registerOne.json().user.id;

  const registerTwo = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { email: TEST_EMAIL_2, password: TEST_PASSWORD },
  });
  expect(registerTwo.statusCode).toBe(201);
  testUserId2 = registerTwo.json().user.id;

  sessionCookie = await loginUser(TEST_EMAIL, TEST_PASSWORD);

  const currency = await prisma.dimCurrency.findUniqueOrThrow({ where: { code: "CHF" } });

  const account = await prisma.dimAccount.create({
    data: {
      name: "Dashboard Test Account",
      iban: "CH00 0000 0000 0000 0100 0",
      currencyId: currency.id,
      userId: testUserId,
    },
  });
  testAccountId = account.id;

  const account2 = await prisma.dimAccount.create({
    data: {
      name: "Dashboard Test Account 2",
      iban: "CH00 0000 0000 0000 0101 0",
      currencyId: currency.id,
      userId: testUserId2,
    },
  });
  testAccountId2 = account2.id;

  const merchant = await prisma.dimMerchant.create({ data: { name: "DashTest Merchant" } });
  const merchant2 = await prisma.dimMerchant.create({ data: { name: "DashTest Merchant 2" } });
  testMerchantId = merchant.id;
  testMerchantId2 = merchant2.id;

  // User 1 transactions in the default 6-month window
  await seedTransaction(testUserId, testAccountId, testMerchantId, 300, -5);
  await seedTransaction(testUserId, testAccountId, testMerchantId, -100, -5);
  await seedTransaction(testUserId, testAccountId, testMerchantId, -50, -2);
  await seedTransaction(testUserId, testAccountId, testMerchantId, 1000, 0);
  await seedTransaction(testUserId, testAccountId, testMerchantId, -200, 0);

  // User 1 transaction outside 6-month window but inside 12-month window
  await seedTransaction(testUserId, testAccountId, testMerchantId, -75, -7);

  // User 2 transaction in same month as user 1 to verify user isolation
  await seedTransaction(testUserId2, testAccountId2, testMerchantId2, 9999, 0);
});

afterAll(async () => {
  await prisma.factTransactions.deleteMany({
    where: { userId: { in: [testUserId, testUserId2] } },
  });
  await prisma.dimAccount.deleteMany({ where: { userId: { in: [testUserId, testUserId2] } } });
  await prisma.dimMerchant.deleteMany({ where: { name: { startsWith: "DashTest" } } });
  await prisma.dimUser.deleteMany({ where: { email: { in: [TEST_EMAIL, TEST_EMAIL_2] } } });
  await app.close();
});

describe("GET /api/v1/dashboard/trends", () => {
  it("returns 401 without a valid session", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/trends",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 for months below minimum", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/trends?months=5",
      cookies: { session: sessionCookie },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 6 months by default, bucketed by month/year and zero-padded", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/trends",
      cookies: { session: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: Array<{ year: number; month: number; income: number; expenses: number }>;
    };

    expect(body.data).toHaveLength(6);

    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    now.setUTCDate(1);

    const expectedByKey = new Map<string, { income: number; expenses: number }>();

    for (let i = -5; i <= 0; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
      expectedByKey.set(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`, { income: 0, expenses: 0 });
    }

    const oldest = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    expectedByKey.set(`${oldest.getUTCFullYear()}-${oldest.getUTCMonth() + 1}`, {
      income: 300,
      expenses: 100,
    });

    const mid = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
    expectedByKey.set(`${mid.getUTCFullYear()}-${mid.getUTCMonth() + 1}`, {
      income: 0,
      expenses: 50,
    });

    expectedByKey.set(`${now.getUTCFullYear()}-${now.getUTCMonth() + 1}`, {
      income: 1000,
      expenses: 200,
    });

    for (const row of body.data) {
      const expected = expectedByKey.get(`${row.year}-${row.month}`);
      expect(expected).toBeDefined();
      expect(row.income).toBeCloseTo(expected!.income, 8);
      expect(row.expenses).toBeCloseTo(expected!.expenses, 8);
    }
  });

  it("returns 12 months when requested and includes older in-range data", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/trends?months=12",
      cookies: { session: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: Array<{ year: number; month: number; income: number; expenses: number }>;
    };

    expect(body.data).toHaveLength(12);

    const target = new Date();
    target.setUTCHours(0, 0, 0, 0);
    target.setUTCDate(1);
    target.setUTCMonth(target.getUTCMonth() - 7);

    const row = body.data.find(
      (item) => item.year === target.getUTCFullYear() && item.month === target.getUTCMonth() + 1,
    );

    expect(row).toBeDefined();
    expect(row!.income).toBeCloseTo(0, 8);
    expect(row!.expenses).toBeCloseTo(75, 8);
  });
});
