import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import type { FastifyInstance } from "fastify";

type SessionCookie = { name: string; value: string; httpOnly?: boolean };

let app: FastifyInstance;
let sessionCookie: string;
let testUserId: string;
let coopRuleId: string;
let migrosRuleId: string;
let categoryId: string;

const TEST_EMAIL = "rules-overlap@example.com";
const TEST_PASSWORD = "Password123!";

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
  // Wipe so first registration becomes ADMIN. fileParallelism: false in vitest
  // config keeps sibling specs serial.
  await prisma.dimUser.deleteMany();

  await prisma.dimCurrency.upsert({
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

  const category = await prisma.dimCategory.create({
    data: { categoryName: "Test_Overlap_Cat", userId: testUserId },
  });
  categoryId = category.id;

  const coop = await prisma.categoryRule.create({
    data: {
      userId: testUserId,
      categoryId,
      pattern: "coop",
      matchType: "contains",
      priority: 5,
    },
  });
  coopRuleId = coop.id;

  const migros = await prisma.categoryRule.create({
    data: {
      userId: testUserId,
      categoryId,
      pattern: "migros",
      matchType: "exact",
      priority: 1,
    },
  });
  migrosRuleId = migros.id;
});

afterAll(async () => {
  await prisma.categoryRule.deleteMany({ where: { userId: testUserId } });
  await prisma.dimCategory.deleteMany({ where: { userId: testUserId } });
  await prisma.dimUser.deleteMany({ where: { email: TEST_EMAIL } });
  await app.close();
});

describe("GET /api/v1/category-rules/overlap", () => {
  it("returns 401 without a valid session", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/category-rules/overlap?pattern=coop&matchType=contains",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 when matchType is missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/category-rules/overlap?pattern=coop",
      cookies: { session: sessionCookie },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when matchType is not in the enum", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/category-rules/overlap?pattern=coop&matchType=regex",
      cookies: { session: sessionCookie },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 200 with empty conflicts array when no rule overlaps", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/category-rules/overlap?pattern=spotify&matchType=contains",
      cookies: { session: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ conflicts: [] });
  });

  it("returns 200 with the overlapping rule when the candidate is a contains-substring of a stored contains pattern", async () => {
    // Stored "coop" (contains) overlaps with candidate "coop migros" (contains)
    // because "coop migros".includes("coop") is true. The stored "migros"
    // (exact) does NOT overlap — candidate is a longer string and the stored
    // exact pattern is not a substring of the candidate name.
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/category-rules/overlap?pattern=coop%20migros&matchType=contains",
      cookies: { session: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { conflicts: Array<{ id: string; pattern: string }> };
    const ids = body.conflicts.map((c) => c.id);
    expect(ids).toContain(coopRuleId);
    expect(ids).not.toContain(migrosRuleId);
  });

  it("returns 200 with the exact rule when an exact candidate equals a stored exact pattern", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/category-rules/overlap?pattern=migros&matchType=exact",
      cookies: { session: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { conflicts: Array<{ id: string }> };
    expect(body.conflicts.map((c) => c.id)).toContain(migrosRuleId);
  });

  it("excludes the rule referenced by excludeRuleId", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/category-rules/overlap?pattern=coop&matchType=contains&excludeRuleId=${coopRuleId}`,
      cookies: { session: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { conflicts: Array<{ id: string }> };
    expect(body.conflicts.map((c) => c.id)).not.toContain(coopRuleId);
  });

  it("returns 400 when excludeRuleId is not a UUID", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/category-rules/overlap?pattern=coop&matchType=contains&excludeRuleId=not-a-uuid",
      cookies: { session: sessionCookie },
    });
    expect(res.statusCode).toBe(400);
  });
});
