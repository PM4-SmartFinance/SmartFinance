import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import type { FastifyInstance } from "fastify";

type SessionCookie = { name: string; value: string; httpOnly?: boolean };

let app: FastifyInstance;
let sessionCookie: string;
let testUserId: string;
let categoryGroceriesId: string;
let categoryHobbyId: string;
let merchantId: string;
let accountId: string;

const TEST_EMAIL = "tx-recategorize@example.com";
const TEST_PASSWORD = "Password123!";
const DATE_IDS = [20260710, 20260711, 20260712] as const;

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
  // Wipe all users so the bootstrap flow (first POST /users → ADMIN) is
  // reproducible. Sibling specs cannot race because `fileParallelism: false`.
  await prisma.dimUser.deleteMany();

  const currency = await prisma.dimCurrency.upsert({
    where: { code: "CHF" },
    create: { code: "CHF", name: "Swiss Franc", format: "CHF" },
    update: {},
  });

  app = await buildApp();
  await app.ready();

  const register = await app.inject({
    method: "POST",
    url: "/api/v1/users",
    payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  expect(register.statusCode).toBe(201);
  testUserId = register.json().user.id;

  sessionCookie = await loginUser(TEST_EMAIL, TEST_PASSWORD);

  const account = await prisma.dimAccount.create({
    data: {
      name: "Recategorize Test Account",
      iban: "CH0033",
      currencyId: currency.id,
      userId: testUserId,
    },
  });
  accountId = account.id;

  const merchant = await prisma.dimMerchant.create({ data: { name: "Coop" } });
  merchantId = merchant.id;

  const groceries = await prisma.dimCategory.create({
    data: { categoryName: "Test_Recat_Groceries", userId: testUserId },
  });
  categoryGroceriesId = groceries.id;
  const hobby = await prisma.dimCategory.create({
    data: { categoryName: "Test_Recat_Hobby", userId: testUserId },
  });
  categoryHobbyId = hobby.id;

  for (const id of DATE_IDS) {
    await prisma.dimDate.upsert({
      where: { id },
      create: {
        id,
        dayOfWeek: "Friday",
        month: Math.floor((id % 10000) / 100),
        year: Math.floor(id / 10000),
      },
      update: {},
    });
  }

  // A "Coop" rule pointing to Groceries — the rule engine should reclassify
  // the seeded Hobby-tagged transaction into Groceries when recategorize
  // runs.
  await prisma.categoryRule.create({
    data: {
      userId: testUserId,
      categoryId: categoryGroceriesId,
      pattern: "coop",
      matchType: "contains",
      priority: 10,
    },
  });

  await prisma.factTransactions.createMany({
    data: [
      // In range, currently Hobby — should be moved to Groceries.
      {
        amount: -50,
        userId: testUserId,
        accountId,
        merchantId,
        categoryId: categoryHobbyId,
        dateId: 20260710,
      },
      // In range, manualOverride true — must NOT be touched.
      {
        amount: -77,
        userId: testUserId,
        accountId,
        merchantId,
        categoryId: categoryHobbyId,
        dateId: 20260711,
        manualOverride: true,
      },
      // Outside range — must NOT be touched.
      {
        amount: -33,
        userId: testUserId,
        accountId,
        merchantId,
        categoryId: categoryHobbyId,
        dateId: 20260712,
      },
    ],
  });
});

afterAll(async () => {
  await prisma.factTransactions.deleteMany({ where: { userId: testUserId } });
  await prisma.categoryRule.deleteMany({ where: { userId: testUserId } });
  await prisma.dimCategory.deleteMany({ where: { userId: testUserId } });
  await prisma.dimAccount.deleteMany({ where: { userId: testUserId } });
  await prisma.dimMerchant.deleteMany({ where: { id: merchantId } });
  await prisma.dimUser.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.dimDate.deleteMany({ where: { id: { in: [...DATE_IDS] } } });
  await app.close();
});

describe("POST /api/v1/transactions/recategorize", () => {
  it("returns 401 without a valid session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/recategorize",
      payload: { startDate: "2026-07-01", endDate: "2026-07-31" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 when startDate is after endDate", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/recategorize",
      cookies: { session: sessionCookie },
      payload: { startDate: "2026-07-31", endDate: "2026-07-01" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when a date is malformed", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/recategorize",
      cookies: { session: sessionCookie },
      payload: { startDate: "not-a-date", endDate: "2026-07-31" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when the body is missing required fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/recategorize",
      cookies: { session: sessionCookie },
      payload: { startDate: "2026-07-01" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 200 with recategorized count and rewrites only in-range non-override rows", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/recategorize",
      cookies: { session: sessionCookie },
      payload: { startDate: "2026-07-10", endDate: "2026-07-11" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ recategorized: 1 });

    // Verify the actual DB state matches the optimistic count.
    const inRangeChanged = await prisma.factTransactions.findFirst({
      where: { userId: testUserId, dateId: 20260710 },
      select: { categoryId: true },
    });
    expect(inRangeChanged?.categoryId).toBe(categoryGroceriesId);

    const overridden = await prisma.factTransactions.findFirst({
      where: { userId: testUserId, dateId: 20260711 },
      select: { categoryId: true, manualOverride: true },
    });
    expect(overridden?.manualOverride).toBe(true);
    expect(overridden?.categoryId).toBe(categoryHobbyId);

    const outOfRange = await prisma.factTransactions.findFirst({
      where: { userId: testUserId, dateId: 20260712 },
      select: { categoryId: true },
    });
    expect(outOfRange?.categoryId).toBe(categoryHobbyId);
  });

  it("returns 200 with recategorized: 0 on a no-op rerun (already in matched category)", async () => {
    // Previous test already moved 20260710 to Groceries. Running again should
    // be a no-op because the row is already in the matched category.
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/recategorize",
      cookies: { session: sessionCookie },
      payload: { startDate: "2026-07-10", endDate: "2026-07-11" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ recategorized: 0 });
  });
});
