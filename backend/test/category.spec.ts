import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import * as argon2 from "argon2";
import { prisma } from "../src/prisma.js";
import type { FastifyInstance } from "fastify";

type SessionCookie = { name: string; value: string; httpOnly?: boolean };

let app: FastifyInstance;

const TEST_USERS = {
  userA: "cat.user.a@example.com",
  userB: "cat.user.b@example.com",
};

let userACookie: string;
let userBCookie: string;
let userAId: string;
let testMerchantId: string;

beforeAll(async () => {
  // 1. Cleanup old test data
  await prisma.userMerchantMapping.deleteMany({
    where: { user: { email: { in: Object.values(TEST_USERS) } } },
  });
  await prisma.dimCategory.deleteMany({ where: { categoryName: { startsWith: "Test_" } } });
  await prisma.dimUser.deleteMany({ where: { email: { in: Object.values(TEST_USERS) } } });
  await prisma.dimMerchant.deleteMany({ where: { name: "Test_Merchant" } });

  await prisma.dimCurrency.upsert({
    where: { code: "CHF" },
    create: { code: "CHF", name: "Swiss Franc", format: "CHF 1'234.56" },
    update: {},
  });

  app = await buildApp();
  await app.ready();

  // 2. Helper to register and login a test user
  const setupUser = async (email: string) => {
    const hashedPassword = await argon2.hash("Password123!");
    const currency = await prisma.dimCurrency.findUnique({ where: { code: "CHF" } });
    await prisma.dimUser.create({
      data: {
        email,
        password: hashedPassword,
        defaultCurrencyId: currency!.id,
      },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: "Password123!" },
    });
    const cookies = (res.cookies as SessionCookie[] | undefined) ?? [];
    const sessionCookie = cookies.find((c) => c.name === "session");
    if (!sessionCookie) {
      throw new Error("Test Setup Failed: Session cookie is missing after login.");
    }
    return sessionCookie.value;
  };

  // 3. Setup Users, Cookies, and IDs
  userACookie = await setupUser(TEST_USERS.userA);
  userBCookie = await setupUser(TEST_USERS.userB);

  const userA = await prisma.dimUser.findUnique({ where: { email: TEST_USERS.userA } });
  if (!userA) {
    throw new Error("Test Setup Failed: userA was not saved to the database.");
  }
  userAId = userA.id;

  // 4. Create a test merchant for the 409 Conflict test
  const merchant = await prisma.dimMerchant.create({
    data: { name: "Test_Merchant" },
  });
  testMerchantId = merchant.id;
});

afterAll(async () => {
  // Cleanup everything we created
  await prisma.userMerchantMapping.deleteMany({
    where: { user: { email: { in: Object.values(TEST_USERS) } } },
  });
  await prisma.dimCategory.deleteMany({ where: { categoryName: { startsWith: "Test_" } } });
  await prisma.dimUser.deleteMany({ where: { email: { in: Object.values(TEST_USERS) } } });
  await prisma.dimMerchant.deleteMany({ where: { name: "Test_Merchant" } });
  await app.close();
});

describe("Category CRUD and Authorization Tests", () => {
  let customCatId: string;

  it("POST: creates a new custom category for the user", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/categories",
      cookies: { session: userACookie },
      payload: { categoryName: "Test_Tennis" },
    });

    expect(res.statusCode).toBe(201);
    const { category } = res.json();
    expect(category).toHaveProperty("id");
    expect(category.categoryName).toBe("Test_Tennis");
    expect(category.userId).toBe(userAId);

    customCatId = category.id; // Save for later tests
  });

  it("POST: fails if payload is invalid (400)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/categories",
      cookies: { session: userACookie },
      payload: { wrongField: "Oops" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET: returns user's custom categories", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/categories",
      cookies: { session: userACookie },
    });

    expect(res.statusCode).toBe(200);
    const { categories } = res.json();

    type CategoryResponse = { categoryName: string; userId: string };

    const hasCustom = categories.some(
      (c: CategoryResponse) => c.categoryName === "Test_Tennis" && c.userId === userAId,
    );

    expect(hasCustom).toBe(true);
  });

  it("PATCH: updates the user's own category successfully", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/categories/${customCatId}`,
      cookies: { session: userACookie },
      payload: { categoryName: "Test_Squash" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().category.categoryName).toBe("Test_Squash");
  });

  it("PATCH: prevents user from editing another user's category (403)", async () => {
    // User B trying to edit User A's category
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/categories/${customCatId}`,
      cookies: { session: userBCookie },
      payload: { categoryName: "Test_Hacked" },
    });

    expect(res.statusCode).toBe(403);
  });

  it("DELETE: prevents deletion if category is in use (409 Conflict)", async () => {
    // 1. Manually link the category to a merchant to simulate usage
    await prisma.userMerchantMapping.create({
      data: {
        userId: userAId,
        merchantId: testMerchantId,
        categoryId: customCatId,
      },
    });

    // 2. Attempt delete
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/categories/${customCatId}`,
      cookies: { session: userACookie },
    });

    expect(res.statusCode).toBe(409);

    // 3. Clean up the mapping so the next test can delete it
    await prisma.userMerchantMapping.deleteMany({
      where: { categoryId: customCatId },
    });
  });

  it("DELETE: successfully removes an unused custom category (204)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/categories/${customCatId}`,
      cookies: { session: userACookie },
    });

    expect(res.statusCode).toBe(204);

    // Verify it's gone
    const check = await prisma.dimCategory.findUnique({ where: { id: customCatId } });
    expect(check).toBeNull();
  });
});
