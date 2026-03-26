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
  // Clean up any leftover test users from previous runs
  const emailsToRemove = [...Object.values(TEST_USERS), ...EXTRA_CLEANUP];
  await prisma.dimUser.deleteMany({
    where: { email: { in: emailsToRemove } },
  });

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

describe("Auth acceptance tests", () => {
  it("assigns ADMIN role to first registered user and logs the creation event", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: TEST_USERS.firstAdmin,
        password: "Password123!",
      },
    });
    expect(res.statusCode).toBe(201);

    const user = await prisma.dimUser.findUnique({ where: { email: TEST_USERS.firstAdmin } });
    expect(user).toBeTruthy();
    expect(user?.role).toBe("ADMIN");

    const auditLog = await prisma.auditLog.findFirst({
      where: { userId: user?.id, action: "USER_CREATED" },
    });
    expect(auditLog).toBeTruthy();
  });

  it("assigns USER role to second registered user", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
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

  it("stores password hashed with Argon2", async () => {
    const plain = "MySecretPass!23";
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: TEST_USERS.hashCheck,
        password: plain,
      },
    });
    expect(res.statusCode).toBe(201);

    const user = await prisma.dimUser.findUnique({ where: { email: TEST_USERS.hashCheck } });
    expect(user).toBeTruthy();
    expect(user?.password).toBeDefined();
    expect(user?.password).not.toBe(plain);

    // verify Argon2 hash
    const ok = await argon2.verify(user!.password, plain);
    expect(ok).toBe(true);
  });

  it("login issues httpOnly session cookie and GET /api/v1/auth/me returns session user", async () => {
    const email = TEST_USERS.loginUser;
    const password = "LoginPass#1";

    // register user first
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password },
    });
    expect(r.statusCode).toBe(201);

    // login
    const resLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(resLogin.statusCode).toBe(200);

    // audit: LOGIN_SUCCESS should be recorded
    const user = await prisma.dimUser.findUnique({ where: { email } });
    const loginAudit = await prisma.auditLog.findFirst({
      where: { userId: user?.id, action: "LOGIN_SUCCESS" },
    });
    expect(loginAudit).toBeTruthy();

    const cookies = (resLogin.cookies as SessionCookie[] | undefined) ?? [];
    const sessionCookie = cookies.find((c) => c.name === "session");
    expect(sessionCookie).toBeDefined();
    // cookie should be httpOnly
    expect(sessionCookie?.httpOnly).toBeTruthy();

    // GET /me with cookie
    const resMe = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      cookies: {
        session: sessionCookie!.value,
      },
    });
    expect(resMe.statusCode).toBe(200);
    const body = resMe.json();
    expect(body).toHaveProperty("user");
    expect(body.user).toHaveProperty("email", email);
  });

  it("logout clears session and protected endpoint requires authentication afterwards", async () => {
    const email = "test.logout@example.com";
    const password = "LogoutPass!1";

    // register
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password },
    });
    expect(r.statusCode).toBe(201);

    // login
    const resLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(resLogin.statusCode).toBe(200);
    const loginCookies = (resLogin.cookies as SessionCookie[] | undefined) ?? [];
    const sessionCookie = loginCookies.find((c) => c.name === "session");
    expect(sessionCookie).toBeDefined();

    // logout
    const resLogout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      cookies: { session: sessionCookie!.value },
    });
    expect(resLogout.statusCode).toBe(200);
    expect(resLogout.json()).toEqual({ ok: true });

    // audit: LOGOUT recorded
    const loggedOutUser = await prisma.dimUser.findUnique({ where: { email } });
    const logoutAudit = await prisma.auditLog.findFirst({
      where: { userId: loggedOutUser?.id, action: "LOGOUT" },
    });
    expect(logoutAudit).toBeTruthy();

    // attempt protected route without cookie -> should be unauthorized
    const resProtected = await app.inject({
      method: "GET",
      url: "/api/v1/protected",
    });
    expect(resProtected.statusCode).toBe(401);
  });

  it("prevents registration with an already existing email (409)", async () => {
    const email = "duplicate@example.com";
    const password = "Password123!";

    // First registration
    const r1 = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password },
    });
    expect(r1.statusCode).toBe(201);

    // Second registration with same email
    const r2 = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password },
    });
    expect(r2.statusCode).toBe(409);
    expect(r2.json().error).toHaveProperty("message", "User exists");
  });

  it("prevents login with a non-existent user (401)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "nonexistent@example.com", password: "Password123!" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toHaveProperty("message", "Invalid credentials");

    // audit: LOGIN_FAILED should be recorded
    const failedAudit = await prisma.auditLog.findFirst({
      where: {
        action: "LOGIN_FAILED",
        details: { contains: '"email":"nonexistent@example.com"' },
      } as never,
    });
    expect(failedAudit).toBeTruthy();
  });

  it("prevents login with wrong password (401)", async () => {
    const email = "wrongpass@example.com";
    const password = "Password123!";

    // Register
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password },
    });

    // Login with wrong password
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: "WrongPassword!" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toHaveProperty("message", "Invalid credentials");

    // audit: LOGIN_FAILED should be recorded for this email
    const failedAudit = await prisma.auditLog.findFirst({
      where: {
        action: "LOGIN_FAILED",
        details: { contains: '"email":"wrongpass@example.com"' },
      } as never,
    });
    expect(failedAudit).toBeTruthy();
  });

  it("requires session for GET /api/v1/auth/me (401)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toHaveProperty("message", "Unauthorized");
  });

  it("enforces RBAC logic and missing session on protected routes (401)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/protected",
    });
    expect(res.statusCode).toBe(401);
  });

  it("enforces RBAC: non-admin user cannot access admin-only endpoint (403)", async () => {
    const email = TEST_USERS.rbacUser;
    const password = "RbacPass!1";

    const r = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password },
    });
    expect(r.statusCode).toBe(201);

    // login as non-admin
    const resLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(resLogin.statusCode).toBe(200);
    const loginCookies = (resLogin.cookies as SessionCookie[] | undefined) ?? [];
    const sessionCookie = loginCookies.find((c) => c.name === "session");
    expect(sessionCookie).toBeDefined();

    // Attempt to access admin-only route
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
      url: "/api/v1/auth/register",
      payload: { email, password },
    });
    expect(r.statusCode).toBe(201);

    await prisma.dimUser.update({
      where: { email },
      data: { role: "ADMIN" },
    });

    // login as admin
    const resLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(resLogin.statusCode).toBe(200);
    const loginCookies = (resLogin.cookies as SessionCookie[] | undefined) ?? [];
    const sessionCookie = loginCookies.find((c) => c.name === "session");

    // Attempt to access admin-only route
    const resAdmin = await app.inject({
      method: "GET",
      url: "/api/v1/admin",
      cookies: { session: sessionCookie!.value },
    });

    expect(resAdmin.statusCode).toBe(200);
    expect(resAdmin.json()).toHaveProperty("admin", true);
  });

  it("rejects registration with invalid email format (400)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: "not-an-email", password: "Password123!" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects registration with short password (400)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: "short@example.com", password: "short" },
    });
    expect(res.statusCode).toBe(400);
  });
});
