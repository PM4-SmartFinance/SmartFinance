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

/** Returns YYYY-MM-DD for the 1st of the month at the given offset from today. */
function monthStart(offsetMonths: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + offsetMonths);
  return d.toISOString().slice(0, 10);
}

/** Returns YYYY-MM-DD for the last day of the month at the given offset from today. */
function monthEnd(offsetMonths: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + offsetMonths + 1);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
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
  if (!cookie) throw new Error(`Login failed for ${email}: no session cookie in response`);
  return cookie.value;
}

beforeAll(async () => {
  // Full wipe — this spec relies on the bootstrap flow (first POST /users is
  // unauthenticated). `fileParallelism` is disabled in vitest.config.ts.
  await prisma.dimUser.deleteMany();

  await prisma.dimCurrency.upsert({
    where: { code: "CHF" },
    create: { code: "CHF", name: "Swiss Franc", format: "CHF 1'234.56" },
    update: {},
  });

  app = await buildApp();
  await app.ready();

  // Bootstrap the first user — automatically becomes ADMIN.
  const registerOne = await app.inject({
    method: "POST",
    url: "/api/v1/users",
    payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  expect(registerOne.statusCode).toBe(201);
  testUserId = registerOne.json().user.id;

  // Log in as the admin so we can create the second user.
  sessionCookie = await loginUser(TEST_EMAIL, TEST_PASSWORD);

  const registerTwo = await app.inject({
    method: "POST",
    url: "/api/v1/users",
    cookies: { session: sessionCookie },
    payload: { email: TEST_EMAIL_2, password: TEST_PASSWORD },
  });
  expect(registerTwo.statusCode).toBe(201);
  testUserId2 = registerTwo.json().user.id;

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

  const seededDateIds = [-7, -5, -2, 0].map((offset) => getMonthAnchor(offset).dateId);
  await prisma.dimDate.deleteMany({ where: { id: { in: seededDateIds } } });

  await prisma.dimUser.deleteMany({ where: { email: { in: [TEST_EMAIL, TEST_EMAIL_2] } } });
  await app.close();
});

describe("GET /api/v1/dashboard/trends", () => {
  // 6-month window: from 5 months ago to this month
  const sixMonthStart = monthStart(-5);
  const sixMonthEnd = monthEnd(0);

  // 12-month window: from 11 months ago to this month
  const twelveMonthStart = monthStart(-11);
  const twelveMonthEnd = monthEnd(0);

  it("returns 401 without a valid session", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/dashboard/trends?startDate=${sixMonthStart}&endDate=${sixMonthEnd}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 when startDate is missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/dashboard/trends?endDate=${sixMonthEnd}`,
      cookies: { session: sessionCookie },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when endDate is missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/dashboard/trends?startDate=${sixMonthStart}`,
      cookies: { session: sessionCookie },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when date format is invalid", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/trends?startDate=not-a-date&endDate=2025-01-31",
      cookies: { session: sessionCookie },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns daily buckets across the full range, gap-filled with zeros", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/dashboard/trends?startDate=${sixMonthStart}&endDate=${sixMonthEnd}`,
      cookies: { session: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: Array<{ date: string; income: number; expenses: number }>;
    };

    // Length = number of days in [start, end] inclusive
    const start = new Date(`${sixMonthStart}T00:00:00Z`);
    const end = new Date(`${sixMonthEnd}T00:00:00Z`);
    const expectedDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    expect(body.data).toHaveLength(expectedDays);

    // Days that should carry seeded transactions (day = 15 of each anchored month)
    const oldest = getMonthAnchor(-5); // 300 income, -100 expense
    const mid = getMonthAnchor(-2); //   -50 expense
    const current = getMonthAnchor(0); // 1000 income, -200 expense

    const byDate = new Map(body.data.map((r) => [r.date, r] as const));

    const oldestRow = byDate.get(
      `${oldest.year}-${String(oldest.month).padStart(2, "0")}-${String(oldest.day).padStart(2, "0")}`,
    );
    expect(oldestRow).toBeDefined();
    expect(oldestRow!.income).toBeCloseTo(300, 8);
    expect(oldestRow!.expenses).toBeCloseTo(100, 8);

    const midRow = byDate.get(
      `${mid.year}-${String(mid.month).padStart(2, "0")}-${String(mid.day).padStart(2, "0")}`,
    );
    expect(midRow).toBeDefined();
    expect(midRow!.income).toBeCloseTo(0, 8);
    expect(midRow!.expenses).toBeCloseTo(50, 8);

    const currentRow = byDate.get(
      `${current.year}-${String(current.month).padStart(2, "0")}-${String(current.day).padStart(2, "0")}`,
    );
    expect(currentRow).toBeDefined();
    expect(currentRow!.income).toBeCloseTo(1000, 8);
    expect(currentRow!.expenses).toBeCloseTo(200, 8);

    // Aggregated totals across the response match the sum of seeded data
    const totalIncome = body.data.reduce((acc, r) => acc + r.income, 0);
    const totalExpenses = body.data.reduce((acc, r) => acc + r.expenses, 0);
    expect(totalIncome).toBeCloseTo(1300, 8);
    expect(totalExpenses).toBeCloseTo(350, 8);
  });

  it("includes older in-range data in the 12-month window", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/dashboard/trends?startDate=${twelveMonthStart}&endDate=${twelveMonthEnd}`,
      cookies: { session: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: Array<{ date: string; income: number; expenses: number }>;
    };

    // The -7 month seed (75 expense) should show up on its anchor day.
    const target = getMonthAnchor(-7);
    const targetDate = `${target.year}-${String(target.month).padStart(2, "0")}-${String(target.day).padStart(2, "0")}`;
    const row = body.data.find((r) => r.date === targetDate);
    expect(row).toBeDefined();
    expect(row!.income).toBeCloseTo(0, 8);
    expect(row!.expenses).toBeCloseTo(75, 8);
  });

  it("returns all-zero data for a user with no transactions", async () => {
    const session2 = await loginUser(TEST_EMAIL_2, TEST_PASSWORD);

    // Delete user 2's seeded transaction so they have none
    await prisma.factTransactions.deleteMany({ where: { userId: testUserId2 } });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/dashboard/trends?startDate=${sixMonthStart}&endDate=${sixMonthEnd}`,
      cookies: { session: session2 },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: Array<{ date: string; income: number; expenses: number }>;
    };

    for (const row of body.data) {
      expect(row.income).toBe(0);
      expect(row.expenses).toBe(0);
    }
  });

  it("returns days in chronological order (oldest first)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/dashboard/trends?startDate=${sixMonthStart}&endDate=${sixMonthEnd}`,
      cookies: { session: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: Array<{ date: string; income: number; expenses: number }>;
    };

    for (let i = 1; i < body.data.length; i++) {
      const prev = body.data[i - 1];
      const curr = body.data[i];
      expect(curr!.date.localeCompare(prev!.date)).toBeGreaterThan(0);
    }
  });
});
