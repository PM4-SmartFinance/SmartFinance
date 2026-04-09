/// <reference types="vitest/globals" />

import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import * as argon2 from "argon2";
import { prisma } from "../prisma.js";

let app: FastifyInstance;
let sessionCookie: string;
let userId: string;
let categoryId: string;

const testEmail = `catrule-${Date.now()}@test.com`;
const testPassword = "TestPassword123!";

let secondSessionCookie: string;
let secondUserId: string;
const secondEmail = `catrule2-${Date.now()}@test.com`;

beforeAll(async () => {
  await prisma.dimCurrency.upsert({
    where: { code: "CHF" },
    create: { code: "CHF", name: "Swiss Franc", format: "CHF 1'234.56" },
    update: {},
  });

  app = await buildApp();

  const hashedPassword = await argon2.hash(testPassword);
  const currency = await prisma.dimCurrency.findUnique({ where: { code: "CHF" } });

  const user = await prisma.dimUser.create({
    data: { email: testEmail, password: hashedPassword, defaultCurrencyId: currency!.id },
  });
  userId = user.id;

  const loginRes = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email: testEmail, password: testPassword },
  });
  sessionCookie = loginRes.headers["set-cookie"] as string;

  const category = await prisma.dimCategory.create({
    data: { categoryName: `TestCat-${Date.now()}`, userId },
  });
  categoryId = category.id;

  const user2 = await prisma.dimUser.create({
    data: { email: secondEmail, password: hashedPassword, defaultCurrencyId: currency!.id },
  });
  secondUserId = user2.id;

  const loginRes2 = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email: secondEmail, password: testPassword },
  });
  secondSessionCookie = loginRes2.headers["set-cookie"] as string;
});

afterAll(async () => {
  const ids = [userId, secondUserId].filter(Boolean);
  if (ids.length > 0) {
    await prisma.categoryRule.deleteMany({ where: { userId: { in: ids } } });
    await prisma.dimCategory.deleteMany({ where: { userId: { in: ids } } });
    await prisma.dimUser.deleteMany({ where: { id: { in: ids } } });
  }
  await app.close();
});

describe("Category Rule Controller", () => {
  let ruleId: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/category-rules",
      headers: { cookie: sessionCookie },
      payload: {
        pattern: "SharedRule",
        matchType: "contains",
        categoryId,
        priority: 10,
      },
    });
    ruleId = res.json().rule.id;
  });

  describe("POST /api/v1/category-rules", () => {
    it("creates a rule and returns 201", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/category-rules",
        headers: { cookie: sessionCookie },
        payload: {
          pattern: "Migros",
          matchType: "contains",
          categoryId,
          priority: 10,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.rule).toMatchObject({
        pattern: "Migros",
        matchType: "contains",
        priority: 10,
        categoryId,
      });
      expect(body.rule.category.categoryName).toBeDefined();
    });

    it("returns 400 for invalid body", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/category-rules",
        headers: { cookie: sessionCookie },
        payload: { pattern: "", matchType: "invalid" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("strips extra properties from request body", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/category-rules",
        headers: { cookie: sessionCookie },
        payload: {
          pattern: "ExtraFieldTest",
          matchType: "exact",
          categoryId,
          priority: 1,
          extraField: "should be stripped",
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().rule).not.toHaveProperty("extraField");
    });

    it("returns 400 for non-UUID categoryId", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/category-rules",
        headers: { cookie: sessionCookie },
        payload: {
          pattern: "Test",
          matchType: "exact",
          categoryId: "not-a-uuid",
          priority: 1,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 404 for non-existent category", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/category-rules",
        headers: { cookie: sessionCookie },
        payload: {
          pattern: "Test",
          matchType: "exact",
          categoryId: "00000000-0000-0000-0000-000000000000",
          priority: 1,
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 409 for duplicate rule", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/category-rules",
        headers: { cookie: sessionCookie },
        payload: {
          pattern: "SharedRule",
          matchType: "contains",
          categoryId,
          priority: 5,
        },
      });

      expect(res.statusCode).toBe(409);
    });

    it("returns 401 without session", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/category-rules",
        payload: {
          pattern: "Test",
          matchType: "exact",
          categoryId,
          priority: 1,
        },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/category-rules", () => {
    it("returns all rules for the user", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/category-rules",
        headers: { cookie: sessionCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.rules).toBeInstanceOf(Array);
      expect(body.rules.length).toBeGreaterThanOrEqual(1);
    });

    it("returns 401 without session", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/category-rules",
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/category-rules/:id", () => {
    it("returns a specific rule", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/category-rules/${ruleId}`,
        headers: { cookie: sessionCookie },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().rule.id).toBe(ruleId);
    });

    it("returns 404 for non-existent rule", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/category-rules/00000000-0000-0000-0000-000000000000",
        headers: { cookie: sessionCookie },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 for invalid UUID param", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/category-rules/not-a-uuid",
        headers: { cookie: sessionCookie },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("PATCH /api/v1/category-rules/:id", () => {
    it("updates a rule and returns 200", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/category-rules/${ruleId}`,
        headers: { cookie: sessionCookie },
        payload: { priority: 20 },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().rule.priority).toBe(20);
    });

    it("returns 404 for non-existent rule", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/category-rules/00000000-0000-0000-0000-000000000000",
        headers: { cookie: sessionCookie },
        payload: { priority: 5 },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 for empty body", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/category-rules/${ruleId}`,
        headers: { cookie: sessionCookie },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 409 when update causes duplicate", async () => {
      await app.inject({
        method: "POST",
        url: "/api/v1/category-rules",
        headers: { cookie: sessionCookie },
        payload: {
          pattern: "DuplicateTarget",
          matchType: "exact",
          categoryId,
          priority: 1,
        },
      });

      const secondRes = await app.inject({
        method: "POST",
        url: "/api/v1/category-rules",
        headers: { cookie: sessionCookie },
        payload: {
          pattern: "WillConflict",
          matchType: "exact",
          categoryId,
          priority: 2,
        },
      });
      const conflictRuleId = secondRes.json().rule.id;

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/category-rules/${conflictRuleId}`,
        headers: { cookie: sessionCookie },
        payload: { pattern: "DuplicateTarget" },
      });

      expect(res.statusCode).toBe(409);
    });

    it("returns 401 without session", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/category-rules/${ruleId}`,
        payload: { priority: 5 },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("DELETE /api/v1/category-rules/:id", () => {
    let deleteRuleId: string;

    beforeAll(async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/category-rules",
        headers: { cookie: sessionCookie },
        payload: {
          pattern: "ToDelete",
          matchType: "exact",
          categoryId,
          priority: 0,
        },
      });
      deleteRuleId = res.json().rule.id;
    });

    it("deletes a rule and returns 204", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/category-rules/${deleteRuleId}`,
        headers: { cookie: sessionCookie },
      });

      expect(res.statusCode).toBe(204);
    });

    it("returns 404 for already-deleted rule", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/category-rules/${deleteRuleId}`,
        headers: { cookie: sessionCookie },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 401 without session", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/category-rules/${deleteRuleId}`,
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("cross-user isolation", () => {
    it("returns 404 when another user tries to GET a rule", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/category-rules/${ruleId}`,
        headers: { cookie: secondSessionCookie },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 404 when another user tries to PATCH a rule", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/category-rules/${ruleId}`,
        headers: { cookie: secondSessionCookie },
        payload: { priority: 99 },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 404 when another user tries to DELETE a rule", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/category-rules/${ruleId}`,
        headers: { cookie: secondSessionCookie },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
