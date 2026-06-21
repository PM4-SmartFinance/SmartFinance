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
    data: { categoryName: "Test_Groceries", userId: testUserId },
  });
  const cat2 = await prisma.dimCategory.create({
    data: { categoryName: "Test_Transport", userId: testUserId },
  });
  const otherCat = await prisma.dimCategory.create({
    data: { categoryName: "Test_Groceries", userId: otherUserId },
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

  // Helpers — narrow each response to the rows seeded by this spec so
  // user-bootstrap default categories (DEFAULT_CATEGORIES from
  // user.service.ts) do not couple this spec's assertions to that list.
  type Row = {
    categoryId: string | null;
    categoryName: string;
    total: number;
    isUncategorized?: boolean;
  };
  const isTestRow = (r: Row) => r.categoryName.startsWith("Test_") || r.isUncategorized === true;

  it("returns spent test categories sorted desc, then Uncategorized last, and ignores income", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/categories?startDate=2026-05-01&endDate=2026-05-31",
      cookies: { session: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const data = (res.json() as Row[]).filter(isTestRow);

    // Test_Groceries (150), Test_Transport (30), Uncategorized (999). The
    // synthetic Uncategorized row is pinned to the end despite its higher
    // total.
    expect(data).toHaveLength(3);

    expect(data[0].categoryName).toBe("Test_Groceries");
    expect(data[0].total).toBe(150);
    expect(data[0].isUncategorized).toBeFalsy();

    expect(data[1].categoryName).toBe("Test_Transport");
    expect(data[1].total).toBe(30);
    expect(data[1].isUncategorized).toBeFalsy();

    expect(data[2].categoryName).toBe("Uncategorized");
    expect(data[2].categoryId).toBeNull();
    expect(data[2].total).toBe(999);
    expect(data[2].isUncategorized).toBe(true);
  });

  it("includes zero-spend categories with total = 0 inside the date range", async () => {
    // June has only a Test_Groceries expense; Test_Transport is zero-spend
    // and must still appear so the user can see the category exists. Default
    // categories created at user bootstrap should also appear with total 0.
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/categories?startDate=2026-06-01&endDate=2026-06-30",
      cookies: { session: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json() as Row[];

    const groceries = data.find((r) => r.categoryName === "Test_Groceries");
    const transport = data.find((r) => r.categoryName === "Test_Transport");
    expect(groceries?.total).toBe(80);
    expect(transport?.total).toBe(0);
    // Bootstrap defaults are present too — pick one as a witness.
    expect(data.some((r) => r.categoryName === "Housing" && r.total === 0)).toBe(true);
    // No uncategorized expense in June, so no synthetic row.
    expect(data.some((r) => r.isUncategorized)).toBe(false);
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
    const data = res.json() as Row[];

    const totals = data.map((row) => row.total);
    expect(totals).not.toContain(12345);
  });

  it("scopes the same query to the other user (confirms both directions)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/categories?startDate=2026-05-01&endDate=2026-05-31",
      cookies: { session: otherSessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json() as Row[];
    // Only the other user's Test_Groceries has spend; their bootstrap defaults
    // are zero-spend and there is no uncategorized expense for them.
    const spent = data.filter((r) => r.total > 0);
    expect(spent).toHaveLength(1);
    expect(spent[0]!.categoryName).toBe("Test_Groceries");
    expect(spent[0]!.total).toBe(12345);
    expect(data.some((r) => r.isUncategorized)).toBe(false);
  });

  it("includes the Uncategorized bucket only when categoryId IS NULL expenses exist in range", async () => {
    // May has a -999 uncategorized expense → bucket present.
    const may = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/categories?startDate=2026-05-01&endDate=2026-05-31",
      cookies: { session: sessionCookie },
    });
    expect(may.statusCode).toBe(200);
    const mayData = may.json() as Row[];
    const mayUncat = mayData.find((r) => r.isUncategorized);
    expect(mayUncat).toBeDefined();
    expect(mayUncat?.total).toBe(999);
    expect(mayUncat?.categoryId).toBeNull();

    // June has no uncategorized expenses → no bucket.
    const june = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/categories?startDate=2026-06-01&endDate=2026-06-30",
      cookies: { session: sessionCookie },
    });
    expect(june.statusCode).toBe(200);
    const juneData = june.json() as Row[];
    expect(juneData.some((r) => r.isUncategorized)).toBe(false);
  });

  it("returns the user's categories with total = 0 when no transactions match", async () => {
    // 2030 has no seeded transactions. The seeded test categories must still
    // appear with total 0 (alongside any bootstrap defaults).
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard/categories?startDate=2030-01-01&endDate=2030-01-31",
      cookies: { session: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json() as Row[];
    expect(data.length).toBeGreaterThanOrEqual(2);
    expect(data.every((r) => r.total === 0)).toBe(true);
    expect(data.some((r) => r.categoryName === "Test_Groceries")).toBe(true);
    expect(data.some((r) => r.categoryName === "Test_Transport")).toBe(true);
    expect(data.some((r) => r.isUncategorized)).toBe(false);
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
