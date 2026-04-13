import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import * as argon2 from "argon2";
import { prisma } from "../src/prisma.js";
import type { FastifyInstance } from "fastify";

type SessionCookie = { name: string; value: string; httpOnly?: boolean };

let app: FastifyInstance;

const TEST_USERS = {
  owner: "tx.owner@example.com",
  other: "tx.other@example.com",
};
const PASSWORD = "TestPass#123";

let ownerCookie: string;
let otherCookie: string;
let ownerId: string;
let categoryId: string;
let transactionId: string;

async function loginAs(email: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password: PASSWORD },
  });
  const cookies = (res.cookies as SessionCookie[]) ?? [];
  const session = cookies.find((c) => c.name === "session");
  if (!session) throw new Error(`No session cookie after login for ${email}`);
  return session.value;
}

async function registerAndLogin(email: string): Promise<string> {
  const hashedPassword = await argon2.hash(PASSWORD);
  const currency = await prisma.dimCurrency.findUnique({ where: { code: "CHF" } });
  await prisma.dimUser.create({
    data: {
      email,
      password: hashedPassword,
      defaultCurrencyId: currency!.id,
    },
  });
  return loginAs(email);
}

beforeAll(async () => {
  await prisma.dimUser.deleteMany({
    where: { email: { in: Object.values(TEST_USERS) } },
  });

  await prisma.dimCurrency.upsert({
    where: { code: "CHF" },
    create: { code: "CHF", name: "Swiss Franc", format: "CHF 1'234.56" },
    update: {},
  });

  app = await buildApp();
  await app.ready();

  ownerCookie = await registerAndLogin(TEST_USERS.owner);
  otherCookie = await registerAndLogin(TEST_USERS.other);

  const owner = await prisma.dimUser.findUniqueOrThrow({
    where: { email: TEST_USERS.owner },
  });
  ownerId = owner.id;

  // Create a category owned by the owner user
  const category = await prisma.dimCategory.create({
    data: { categoryName: "Test Category", userId: ownerId },
  });
  categoryId = category.id;

  // Seed a transaction for the owner
  const currency = await prisma.dimCurrency.findUniqueOrThrow({ where: { code: "CHF" } });

  const account = await prisma.dimAccount.create({
    data: {
      name: "Test Account",
      iban: "CH9300762011623852957",
      userId: ownerId,
      currencyId: currency.id,
    },
  });

  const merchant = await prisma.dimMerchant.create({
    data: { name: "Test Merchant" },
  });

  const date = await prisma.dimDate.upsert({
    where: { id: 20260326 },
    create: { id: 20260326, dayOfWeek: "Thursday", month: 3, year: 2026 },
    update: {},
  });

  const tx = await prisma.factTransactions.create({
    data: {
      amount: 42.5,
      userId: ownerId,
      accountId: account.id,
      merchantId: merchant.id,
      dateId: date.id,
    },
  });
  transactionId = tx.id;
});

afterAll(async () => {
  // Cascade deletes transactions, accounts, categories via userId FK
  await prisma.dimUser.deleteMany({
    where: { email: { in: Object.values(TEST_USERS) } },
  });
  await app.close();
});

describe("GET /api/v1/transactions/:id", () => {
  it("returns the transaction with category for the owner", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/transactions/${transactionId}`,
      cookies: { session: ownerCookie },
    });
    expect(res.statusCode).toBe(200);
    const { transaction } = res.json();
    expect(transaction.id).toBe(transactionId);
    expect(transaction.amount).toBeDefined();
    expect(transaction).toHaveProperty("merchant");
    expect(transaction).toHaveProperty("account");
    expect(transaction).toHaveProperty("date");
    expect(transaction.category).toBeNull();
    expect(transaction.manualOverride).toBe(false);
  });

  it("returns 404 for a non-existent transaction", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/transactions/00000000-0000-0000-0000-000000000000`,
      cookies: { session: ownerCookie },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.message).toBe("Transaction not found");
  });

  it("returns 404 when another user requests owner's transaction", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/transactions/${transactionId}`,
      cookies: { session: otherCookie },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.message).toBe("Transaction not found");
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/transactions/${transactionId}`,
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("PATCH /api/v1/transactions/:id", () => {
  it("updates notes without setting manualOverride", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/transactions/${transactionId}`,
      cookies: { session: ownerCookie },
      payload: { notes: "My personal note" },
    });
    expect(res.statusCode).toBe(200);
    const { transaction } = res.json();
    expect(transaction.notes).toBe("My personal note");
    expect(transaction.manualOverride).toBe(false);
  });

  it("updates categoryId and sets manualOverride to true", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/transactions/${transactionId}`,
      cookies: { session: ownerCookie },
      payload: { categoryId },
    });
    expect(res.statusCode).toBe(200);
    const { transaction } = res.json();
    expect(transaction.categoryId).toBe(categoryId);
    expect(transaction.category.categoryName).toBe("Test Category");
    expect(transaction.manualOverride).toBe(true);
  });

  it("returns 404 for a non-existent transaction", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/transactions/00000000-0000-0000-0000-000000000000`,
      cookies: { session: ownerCookie },
      payload: { notes: "won't work" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 404 when another user tries to update owner's transaction", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/transactions/${transactionId}`,
      cookies: { session: otherCookie },
      payload: { notes: "sneaky note" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/transactions/${transactionId}`,
      payload: { notes: "no session" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("DELETE /api/v1/transactions/:id", () => {
  it("returns 404 when another user tries to delete owner's transaction", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/transactions/${transactionId}`,
      cookies: { session: otherCookie },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/transactions/${transactionId}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("deletes the transaction and returns 204", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/transactions/${transactionId}`,
      cookies: { session: ownerCookie },
    });
    expect(res.statusCode).toBe(204);

    // Confirm it no longer exists
    const check = await app.inject({
      method: "GET",
      url: `/api/v1/transactions/${transactionId}`,
      cookies: { session: ownerCookie },
    });
    expect(check.statusCode).toBe(404);
  });

  it("returns 404 for an already-deleted transaction", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/transactions/${transactionId}`,
      cookies: { session: ownerCookie },
    });
    expect(res.statusCode).toBe(404);
  });
});
