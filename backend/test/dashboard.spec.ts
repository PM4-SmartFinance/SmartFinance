import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

type SessionCookie = { name: string; value: string; httpOnly?: boolean };

let app: FastifyInstance;
let sessionCookie: string;
let testUserId: string;

const TEST_EMAIL = "test.dashboard.user@example.com";
const TEST_PASSWORD = "DashboardPass!1";

async function loginUser(email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password },
  });
  const cookies = (res.cookies as SessionCookie[] | undefined) ?? [];
  const cookie = cookies.find((entry) => entry.name === "session");
  expect(cookie).toBeDefined();
  return cookie!.value;
}

beforeAll(async () => {
  await prisma.dimUser.deleteMany({
    where: { email: TEST_EMAIL },
  });

  await prisma.dimCurrency.upsert({
    where: { code: "CHF" },
    create: { code: "CHF", name: "Swiss Franc", format: "CHF 1'234.56" },
    update: {},
  });

  app = await buildApp();
  await app.ready();

  const registerResponse = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    },
  });
  expect(registerResponse.statusCode).toBe(201);
  testUserId = registerResponse.json().user.id;

  sessionCookie = await loginUser(TEST_EMAIL, TEST_PASSWORD);

  const currency = await prisma.dimCurrency.findFirstOrThrow({ where: { code: "CHF" } });
  const category = await prisma.dimCategory.create({
    data: {
      categoryName: "Groceries",
      userId: testUserId,
    },
  });
  const merchant = await prisma.dimMerchant.create({ data: { name: "Coop Dashboard Test" } });

  await prisma.userMerchantMapping.create({
    data: {
      userId: testUserId,
      merchantId: merchant.id,
      categoryId: category.id,
    },
  });

  await prisma.dimAccount.create({
    data: {
      name: "Dashboard Test Account",
      iban: "CH00 0000 0000 0000 0000 1",
      currencyId: currency.id,
      userId: testUserId,
    },
  });

  await prisma.dimDate.upsert({
    where: { id: 20260310 },
    create: { id: 20260310, dayOfWeek: "Tuesday", month: 3, year: 2026 },
    update: {},
  });
  await prisma.dimDate.upsert({
    where: { id: 20260412 },
    create: { id: 20260412, dayOfWeek: "Sunday", month: 4, year: 2026 },
    update: {},
  });
  await prisma.dimDate.upsert({
    where: { id: 20260415 },
    create: { id: 20260415, dayOfWeek: "Wednesday", month: 4, year: 2026 },
    update: {},
  });

  const account = await prisma.dimAccount.findFirstOrThrow({ where: { userId: testUserId } });

  await prisma.factTransactions.createMany({
    data: [
      {
        amount: -50,
        userId: testUserId,
        accountId: account.id,
        merchantId: merchant.id,
        dateId: 20260310,
      },
      {
        amount: 200,
        userId: testUserId,
        accountId: account.id,
        merchantId: merchant.id,
        dateId: 20260412,
      },
      {
        amount: -125,
        userId: testUserId,
        accountId: account.id,
        merchantId: merchant.id,
        dateId: 20260415,
      },
    ],
  });
});

afterAll(async () => {
  await prisma.dimUser.deleteMany({
    where: { email: TEST_EMAIL },
  });
  await app.close();
});

describe("Dashboard APIs", () => {
  it("returns summary data for the selected range", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/summary?startDate=2026-03-01&endDate=2026-04-30",
      cookies: { session: sessionCookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      accountBalance: 25,
      monthlyExpenses: 175,
      incomeThisMonth: 200,
    });
  });

  it("returns month buckets for trends", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/trends?startDate=2026-03-01&endDate=2026-04-30",
      cookies: { session: sessionCookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      { year: 2026, month: 3, income: 0, expenses: 50 },
      { year: 2026, month: 4, income: 200, expenses: 125 },
    ]);
  });

  it("returns category breakdown data", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/categories?startDate=2026-03-01&endDate=2026-04-30",
      cookies: { session: sessionCookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{ category: "Groceries", amount: 175 }]);
  });
});
