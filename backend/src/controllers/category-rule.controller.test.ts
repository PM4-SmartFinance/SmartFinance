/// <reference types="vitest/globals" />

import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { prisma } from "../prisma.js";

let app: FastifyInstance;
let sessionCookie: string;
let userId: string;
let categoryId: string;

const testEmail = `catrule-${Date.now()}@test.com`;
const testPassword = "TestPassword123!";

beforeAll(async () => {
  app = await buildApp();

  const registerRes = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { email: testEmail, password: testPassword },
  });
  userId = registerRes.json().user.id;
  sessionCookie = registerRes.headers["set-cookie"] as string;

  const category = await prisma.dimCategory.create({
    data: { categoryName: `TestCat-${Date.now()}`, userId },
  });
  categoryId = category.id;
});

afterAll(async () => {
  await prisma.categoryRule.deleteMany({ where: { userId } });
  await prisma.dimCategory.deleteMany({ where: { userId } });
  await prisma.dimUser.deleteMany({ where: { id: userId } });
  await app.close();
});

describe("Category Rule Controller", () => {
  let ruleId: string;

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
      ruleId = body.rule.id;
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
          pattern: "Migros",
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
  });

  describe("DELETE /api/v1/category-rules/:id", () => {
    it("deletes a rule and returns 204", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/category-rules/${ruleId}`,
        headers: { cookie: sessionCookie },
      });

      expect(res.statusCode).toBe(204);
    });

    it("returns 404 for already-deleted rule", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/category-rules/${ruleId}`,
        headers: { cookie: sessionCookie },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 401 without session", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/category-rules/${ruleId}`,
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
