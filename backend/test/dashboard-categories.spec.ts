import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
let sessionCookie: string;
let testUserId: string;

const TEST_EMAIL = "dash-categories@example.com";
const TEST_PASSWORD = "Password123!";

beforeAll(async () => {
  // 1. Boot App & Clean DB
  app = await buildApp();
  await app.ready();
  await prisma.dimUser.deleteMany({ where: { email: TEST_EMAIL } });

  const currency = await prisma.dimCurrency.upsert({
    where: { code: "CHF" },
    create: { code: "CHF", name: "Swiss Franc", format: "CHF" },
    update: {},
  });

  // 2. Register & Login User
  await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  const loginRes = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });

  const cookies = (loginRes.cookies as Array<{ name: string; value: string }>) ?? [];
  sessionCookie = cookies.find((c) => c.name === "session")!.value;

  const user = await prisma.dimUser.findUnique({ where: { email: TEST_EMAIL } });
  testUserId = user!.id;

  // 3. Setup Dimension Data

  const account = await prisma.dimAccount.create({
    data: { name: "Cat Test Account", iban: "CH0011", currencyId: currency.id, userId: testUserId },
  });

  const merchant = await prisma.dimMerchant.create({ data: { name: "Cat Test Merchant" } });

  const cat1 = await prisma.dimCategory.create({
    data: { categoryName: "Groceries", userId: testUserId },
  });
  const cat2 = await prisma.dimCategory.create({
    data: { categoryName: "Transport", userId: testUserId },
  });

  // Ensure our date dimension exists
  await prisma.dimDate.upsert({
    where: { id: 20260515 },
    create: { id: 20260515, dayOfWeek: "Friday", month: 5, year: 2026 },
    update: {},
  });
  await prisma.dimDate.upsert({
    where: { id: 20260615 },
    create: { id: 20260615, dayOfWeek: "Monday", month: 6, year: 2026 },
    update: {},
  });

  // 4. Seed Transactions
  await prisma.factTransactions.createMany({
    data: [
      // Groceries in May
      {
        amount: -50,
        userId: testUserId,
        accountId: account.id,
        merchantId: merchant.id,
        categoryId: cat1.id,
        dateId: 20260515,
      },
      {
        amount: -100,
        userId: testUserId,
        accountId: account.id,
        merchantId: merchant.id,
        categoryId: cat1.id,
        dateId: 20260515,
      },
      // Income in May (Should be ignored!)
      {
        amount: 500,
        userId: testUserId,
        accountId: account.id,
        merchantId: merchant.id,
        categoryId: cat1.id,
        dateId: 20260515,
      },

      // Transport in May
      {
        amount: -30,
        userId: testUserId,
        accountId: account.id,
        merchantId: merchant.id,
        categoryId: cat2.id,
        dateId: 20260515,
      },

      // Groceries in June (Outside the test date range)
      {
        amount: -80,
        userId: testUserId,
        accountId: account.id,
        merchantId: merchant.id,
        categoryId: cat1.id,
        dateId: 20260615,
      },
    ],
  });
});

afterAll(async () => {
  await prisma.factTransactions.deleteMany({ where: { userId: testUserId } });
  await prisma.dimAccount.deleteMany({ where: { userId: testUserId } });
  await prisma.dimCategory.deleteMany({ where: { userId: testUserId } });
  await prisma.dimUser.deleteMany({ where: { email: TEST_EMAIL } });
  await app.close();
});

describe("GET /api/v1/dashboard/categories", () => {
  it("returns 401 without a valid session", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/categories?startDate=2026-05-01&endDate=2026-05-31",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns positive totals, grouped by category, sorted descending, and ignores income", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/categories?startDate=2026-05-01&endDate=2026-05-31",
      cookies: { session: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json();

    expect(data).toHaveLength(2);

    // Groceries should be first (|-50| + |-100| = 150) -> Note: the +500 is ignored!
    expect(data[0].categoryName).toBe("Groceries");
    expect(data[0].total).toBe(150);

    // Transport should be second (|-30| = 30)
    expect(data[1].categoryName).toBe("Transport");
    expect(data[1].total).toBe(30);
  });

  it("filters out transactions outside the date range", async () => {
    // Only query June
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/categories?startDate=2026-06-01&endDate=2026-06-30",
      cookies: { session: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json();

    // Should only see the one June transaction
    expect(data).toHaveLength(1);
    expect(data[0].categoryName).toBe("Groceries");
    expect(data[0].total).toBe(80);
  });
});
