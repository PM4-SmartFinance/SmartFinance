import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import type { FastifyInstance } from "fastify";

type SessionCookie = { name: string; value: string; httpOnly?: boolean };

let app: FastifyInstance;
let sessionCookie: string;
let otherSessionCookie: string;
let testUserId: string;
let otherUserId: string;

const TEST_EMAIL = "dash-categories@example.com";
const OTHER_EMAIL = "dash-categories-other@example.com";
const TEST_PASSWORD = "Password123!";
const DATE_IDS = [20260515, 20260615] as const;

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
  // 1. Full user wipe so the bootstrap flow (first POST /users is
  //    unauthenticated and becomes ADMIN) is reproducible. `fileParallelism`
  //    is disabled in vitest.config.ts, so sibling specs cannot race.
  await prisma.dimUser.deleteMany();

  const currency = await prisma.dimCurrency.upsert({
    where: { code: "CHF" },
    create: { code: "CHF", name: "Swiss Franc", format: "CHF" },
    update: {},
  });

  app = await buildApp();
  await app.ready();

  // 2. Bootstrap the first user — automatically becomes ADMIN.
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
    payload: { email: OTHER_EMAIL, password: TEST_PASSWORD },
  });
  expect(registerTwo.statusCode).toBe(201);
  otherUserId = registerTwo.json().user.id;
  otherSessionCookie = await loginUser(OTHER_EMAIL, TEST_PASSWORD);

  // 3. Setup Dimension Data

  const account = await prisma.dimAccount.create({
    data: { name: "Cat Test Account", iban: "CH0011", currencyId: currency.id, userId: testUserId },
  });

  const otherAccount = await prisma.dimAccount.create({
    data: {
      name: "Other Cat Test Account",
      iban: "CH0022",
      currencyId: currency.id,
      userId: otherUserId,
    },
  });

  const merchant = await prisma.dimMerchant.create({ data: { name: "Cat Test Merchant" } });

  const cat1 = await prisma.dimCategory.create({
    data: { categoryName: "Groceries", userId: testUserId },
  });
  const cat2 = await prisma.dimCategory.create({
    data: { categoryName: "Transport", userId: testUserId },
  });
  const otherCat = await prisma.dimCategory.create({
    data: { categoryName: "Groceries", userId: otherUserId },
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

      // Uncategorized expense in May — must be excluded by the INNER JOIN
      {
        amount: -999,
        userId: testUserId,
        accountId: account.id,
        merchantId: merchant.id,
        categoryId: null,
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

      // Other user's expense in May — must not leak into the first user's
      // response. Different category row but same name.
      {
        amount: -12345,
        userId: otherUserId,
        accountId: otherAccount.id,
        merchantId: merchant.id,
        categoryId: otherCat.id,
        dateId: 20260515,
      },
    ],
  });
});

afterAll(async () => {
  await prisma.factTransactions.deleteMany({
    where: { userId: { in: [testUserId, otherUserId] } },
  });
  await prisma.dimAccount.deleteMany({ where: { userId: { in: [testUserId, otherUserId] } } });
  await prisma.dimCategory.deleteMany({ where: { userId: { in: [testUserId, otherUserId] } } });
  await prisma.dimMerchant.deleteMany({ where: { name: "Cat Test Merchant" } });
  await prisma.dimUser.deleteMany({ where: { email: { in: [TEST_EMAIL, OTHER_EMAIL] } } });
  // Clean up the DimDate rows we inserted so repeated test runs do not
  // accumulate state and collisions with sibling specs cannot happen.
  await prisma.dimDate.deleteMany({ where: { id: { in: [...DATE_IDS] } } });
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

  it("does not leak another user's spending into the response", async () => {
    // The other user has a -12345 expense in May under a same-named category.
    // It must not appear in the first user's totals.
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/categories?startDate=2026-05-01&endDate=2026-05-31",
      cookies: { session: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json();

    // Only the first user's two categories show up (Groceries=150, Transport=30).
    expect(data).toHaveLength(2);
    const totals = data.map((row: { total: number }) => row.total);
    expect(totals).not.toContain(12345);
  });

  it("scopes the same query to the other user (confirms both directions)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/categories?startDate=2026-05-01&endDate=2026-05-31",
      cookies: { session: otherSessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data).toHaveLength(1);
    expect(data[0].total).toBe(12345);
  });

  it("excludes uncategorized transactions (INNER JOIN behaviour is intentional)", async () => {
    // The seeded -999 row has categoryId=null. Its absolute value must not
    // appear anywhere in the response for May.
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/categories?startDate=2026-05-01&endDate=2026-05-31",
      cookies: { session: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json();
    const totals = data.map((row: { total: number }) => row.total);
    expect(totals).not.toContain(999);
  });

  it("returns an empty array when there are no matching transactions", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/categories?startDate=2030-01-01&endDate=2030-01-31",
      cookies: { session: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("returns 400 when startDate is after endDate", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/categories?startDate=2026-05-31&endDate=2026-05-01",
      cookies: { session: sessionCookie },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when a date is malformed", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/categories?startDate=not-a-date&endDate=2026-05-31",
      cookies: { session: sessionCookie },
    });
    expect(res.statusCode).toBe(400);
  });
});
