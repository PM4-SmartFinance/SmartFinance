import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as argon2 from "argon2";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import type { FastifyInstance } from "fastify";
import { requireRole } from "../src/middleware/rbac.js";

type SessionCookie = { name: string; value: string; httpOnly?: boolean };

let app: FastifyInstance;

const TEST_USERS = {
  firstAdmin: "test.first.admin@example.com",
  secondUser: "test.second.user@example.com",
  hashCheck: "test.hash@example.com",
  loginUser: "test.login@example.com",
  rbacUser: "test.rbac.user@example.com",
};

const EXTRA_CLEANUP = [
  "test.logout@example.com",
  "duplicate@example.com",
  "wrongpass@example.com",
  "admin.rbac@example.com",
];

beforeAll(async () => {
  await prisma.dimUser.deleteMany();

  // Ensure default currency exists for registration
  await prisma.dimCurrency.upsert({
    where: { code: "CHF" },
    create: { code: "CHF", name: "Swiss Franc", format: "CHF 1'234.56" },
    update: {},
  });

  app = await buildApp();

  // Add test-only routes for RBAC testing
  app.get("/api/v1/admin", { preHandler: requireRole("ADMIN") }, async (_request, reply) => {
    return reply.send({ admin: true });
  });
  app.get("/api/v1/protected", { preHandler: requireRole("USER") }, async (_request, reply) => {
    return reply.send({ secret: "only for logged-in users" });
  });

  await app.ready();
});

afterAll(async () => {
  const emailsToRemove = [...Object.values(TEST_USERS), ...EXTRA_CLEANUP];
  await prisma.dimUser.deleteMany({
    where: { email: { in: emailsToRemove } },
  });
  await app.close();
});

describe("Auth and Onboarding acceptance tests", () => {
  let adminSessionCookie: string | undefined;

  it("assigns ADMIN role to first registered user and hashes password (Bootstrap)", async () => {
    const plain = "Password123!";
    const displayName = "Bootstrap Admin";
    // Intentionally request role USER to verify the bootstrap override — the
    // first user must become ADMIN regardless of the caller-supplied role.
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      payload: {
        email: TEST_USERS.firstAdmin,
        password: plain,
        displayName,
        role: "USER",
      },
    });
    expect(res.statusCode).toBe(201);
    // displayName must be persisted and surfaced in the response body.
    expect(res.json().user).toMatchObject({ email: TEST_USERS.firstAdmin, name: displayName });

    const user = await prisma.dimUser.findUnique({ where: { email: TEST_USERS.firstAdmin } });
    expect(user).toBeTruthy();
    // Override is enforced — caller asked for USER, bootstrap forces ADMIN.
    expect(user?.role).toBe("ADMIN");
    expect(user?.name).toBe(displayName);

    expect(user?.password).toBeDefined();
    expect(user?.password).not.toBe(plain);
    const ok = await argon2.verify(user!.password, plain);
    expect(ok).toBe(true);
  });

  it("rejects unauthenticated registration after bootstrap (401)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      payload: {
        email: TEST_USERS.secondUser,
        password: "Password123!",
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("allows authenticated ADMIN to create new users", async () => {
    const resLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: TEST_USERS.firstAdmin, password: "Password123!" },
    });
    expect(resLogin.statusCode).toBe(200);

    const cookies = (resLogin.cookies as SessionCookie[] | undefined) ?? [];
    adminSessionCookie = cookies.find((c) => c.name === "session")?.value;
    expect(adminSessionCookie).toBeDefined();

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      cookies: { session: adminSessionCookie! },
      payload: {
        email: TEST_USERS.secondUser,
        password: "Password123!",
      },
    });
    expect(res.statusCode).toBe(201);

    const user = await prisma.dimUser.findUnique({ where: { email: TEST_USERS.secondUser } });
    expect(user).toBeTruthy();
    expect(user?.role).toBe("USER");
  });

  it("login issues httpOnly session cookie and GET /api/v1/auth/me returns session user", async () => {
    const email = TEST_USERS.loginUser;
    const password = "LoginPass#1";

    const r = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      cookies: { session: adminSessionCookie! },
      payload: { email, password },
    });
    expect(r.statusCode).toBe(201);

    const resLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(resLogin.statusCode).toBe(200);

    const cookies = (resLogin.cookies as SessionCookie[] | undefined) ?? [];
    const sessionCookie = cookies.find((c) => c.name === "session");
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.httpOnly).toBeTruthy();

    const resMe = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      cookies: { session: sessionCookie!.value },
    });
    expect(resMe.statusCode).toBe(200);
    const body = resMe.json();
    expect(body).toHaveProperty("user");
    expect(body.user).toHaveProperty("email", email);
  });

  it("logout clears session and protected endpoint requires authentication afterwards", async () => {
    const email = "test.logout@example.com";
    const password = "LogoutPass!1";

    const r = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      cookies: { session: adminSessionCookie! },
      payload: { email, password },
    });
    expect(r.statusCode).toBe(201);

    const resLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(resLogin.statusCode).toBe(200);
    const loginCookies = (resLogin.cookies as SessionCookie[] | undefined) ?? [];
    const sessionCookie = loginCookies.find((c) => c.name === "session")!;

    const resLogout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      cookies: { session: sessionCookie.value },
    });
    expect(resLogout.statusCode).toBe(200);

    const resProtected = await app.inject({
      method: "GET",
      url: "/api/v1/protected",
    });
    expect(resProtected.statusCode).toBe(401);
  });

  it("prevents registration with an already existing email (409)", async () => {
    const email = "duplicate@example.com";
    const password = "Password123!";

    const r1 = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      cookies: { session: adminSessionCookie! },
      payload: { email, password },
    });
    expect(r1.statusCode).toBe(201);

    const r2 = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      cookies: { session: adminSessionCookie! },
      payload: { email, password },
    });
    expect(r2.statusCode).toBe(409);
    expect(r2.json().error).toHaveProperty("message", "Email already in use");
  });

  it("prevents login with a non-existent user (401)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "nonexistent@example.com", password: "Password123!" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("prevents login with wrong password (401)", async () => {
    const email = "wrongpass@example.com";
    const password = "Password123!";

    await app.inject({
      method: "POST",
      url: "/api/v1/users",
      cookies: { session: adminSessionCookie! },
      payload: { email, password },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: "WrongPassword!" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("enforces RBAC: non-admin user cannot access admin-only endpoint (403)", async () => {
    const email = TEST_USERS.rbacUser;
    const password = "RbacPass!1";

    const r = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      cookies: { session: adminSessionCookie! },
      payload: { email, password },
    });
    expect(r.statusCode).toBe(201);

    const resLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(resLogin.statusCode).toBe(200);
    const loginCookies = (resLogin.cookies as SessionCookie[] | undefined) ?? [];
    const sessionCookie = loginCookies.find((c) => c.name === "session");

    const resAdmin = await app.inject({
      method: "GET",
      url: "/api/v1/admin",
      cookies: { session: sessionCookie!.value },
    });
    expect(resAdmin.statusCode).toBe(403);
  });

  it("enforces RBAC: admin user can access admin-only endpoint (200)", async () => {
    const email = "admin.rbac@example.com";
    const password = "AdminRbacPass!1";

    const r = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      cookies: { session: adminSessionCookie! },
      payload: { email, password, role: "ADMIN" },
    });
    expect(r.statusCode).toBe(201);

    const resLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(resLogin.statusCode).toBe(200);
    const loginCookies = (resLogin.cookies as SessionCookie[] | undefined) ?? [];
    const sessionCookie = loginCookies.find((c) => c.name === "session")!;

    const resAdmin = await app.inject({
      method: "GET",
      url: "/api/v1/admin",
      cookies: { session: sessionCookie.value },
    });
    expect(resAdmin.statusCode).toBe(200);
    expect(resAdmin.json()).toHaveProperty("admin", true);
  });

  it("rejects registration with invalid email format (400)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      cookies: { session: adminSessionCookie! },
      payload: { email: "not-an-email", password: "Password123!" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects registration with short password (400)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      cookies: { session: adminSessionCookie! },
      payload: { email: "short@example.com", password: "short" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects authenticated non-admin from creating users via POST /users (403)", async () => {
    // Log in as the USER-role account created earlier in the RBAC test.
    const resLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: TEST_USERS.rbacUser, password: "RbacPass!1" },
    });
    expect(resLogin.statusCode).toBe(200);
    const cookies = (resLogin.cookies as SessionCookie[] | undefined) ?? [];
    const userSession = cookies.find((c) => c.name === "session");
    expect(userSession).toBeDefined();

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      cookies: { session: userSession!.value },
      payload: { email: "should-not-create@example.com", password: "Password123!" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects bootstrap-like registration after users exist with a short password (400)", async () => {
    // No session cookie: we still expect the schema to reject short passwords
    // before any auth decision is made.
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      payload: { email: "bootstrap-short@example.com", password: "short" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("requires session for GET /api/v1/auth/me (401)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
    });
    expect(res.statusCode).toBe(401);
  });

  it("protected routes reject requests without a session (401)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/protected",
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("Concurrent bootstrap race", () => {
  // This suite must run with a completely empty user table and is destructive.
  // It verifies that two concurrent unauthenticated bootstrap requests cannot
  // both succeed — exactly one must become ADMIN, the loser must be rejected
  // (401 Unauthorized once the serializable transaction sees count > 0, or
  // 409 if the DB unique constraint fires first on a duplicate email).
  const RACE_USERS = ["race.a@example.com", "race.b@example.com"];

  beforeAll(async () => {
    await prisma.dimUser.deleteMany();
    await prisma.dimCurrency.upsert({
      where: { code: "CHF" },
      create: { code: "CHF", name: "Swiss Franc", format: "CHF 1'234.56" },
      update: {},
    });
    await app.ready();
  });

  afterAll(async () => {
    await prisma.dimUser.deleteMany({ where: { email: { in: RACE_USERS } } });
  });

  it("allows exactly one concurrent unauthenticated bootstrap to succeed", async () => {
    const [r1, r2] = await Promise.all([
      app.inject({
        method: "POST",
        url: "/api/v1/users",
        payload: { email: RACE_USERS[0], password: "RacePass!1" },
      }),
      app.inject({
        method: "POST",
        url: "/api/v1/users",
        payload: { email: RACE_USERS[1], password: "RacePass!2" },
      }),
    ]);

    const statuses = [r1.statusCode, r2.statusCode].sort();
    // Exactly one success (201) and one rejection (401 post-bootstrap auth
    // gate inside the serializable transaction).
    expect(statuses).toEqual([201, 401]);

    // Exactly one ADMIN exists in the DB — the winner.
    const admins = await prisma.dimUser.findMany({ where: { role: "ADMIN" } });
    expect(admins).toHaveLength(1);
    expect(RACE_USERS).toContain(admins[0]!.email);
  });
});
