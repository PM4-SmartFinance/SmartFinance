import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as argon2 from "argon2";
import { buildServer } from "../src/server";
import { prisma } from "../src/prisma";
import type { FastifyInstance } from "fastify";
import { requireRole } from "../src/middleware/rbac";

type SessionCookie = { name: string; value: string; httpOnly?: boolean };

let server: FastifyInstance;

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
  server = buildServer();
  // Add an admin-only route specifically for testing RBAC logic
  server.get("/api/v1/admin", { preHandler: requireRole("ADMIN") }, async (_request, reply) => {
    return reply.send({ admin: true });
  });
  await server.ready();
});

afterAll(async () => {
  const emailsToRemove = [...Object.values(TEST_USERS), ...EXTRA_CLEANUP];
  await prisma.user.deleteMany({
    where: {
      email: {
        in: emailsToRemove,
      },
    },
  });
  await server.close();
});

describe("Auth acceptance tests", () => {
  it("assigns ADMIN role to first registered user", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: TEST_USERS.firstAdmin,
        password: "Password123!",
      },
    });
    expect(res.statusCode).toBe(201);

    const user = await prisma.user.findUnique({ where: { email: TEST_USERS.firstAdmin } });
    expect(user).toBeTruthy();
    expect(user?.role).toBe("ADMIN");
  });

  it("assigns USER role to second registered user", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: TEST_USERS.secondUser,
        password: "Password123!",
      },
    });
    expect(res.statusCode).toBe(201);

    const user = await prisma.user.findUnique({ where: { email: TEST_USERS.secondUser } });
    expect(user).toBeTruthy();
    expect(user?.role).toBe("USER");
  });

  it("stores password hashed with Argon2", async () => {
    const plain = "MySecretPass!23";
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: TEST_USERS.hashCheck,
        password: plain,
      },
    });
    expect(res.statusCode).toBe(201);

    const user = await prisma.user.findUnique({ where: { email: TEST_USERS.hashCheck } });
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
    const r = await server.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password },
    });
    expect(r.statusCode).toBe(201);

    // login
    const resLogin = await server.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(resLogin.statusCode).toBe(200);

    const cookies = (resLogin.cookies as SessionCookie[] | undefined) ?? [];
    const sessionCookie = cookies.find((c) => c.name === "session");
    expect(sessionCookie).toBeDefined();
    // cookie should be httpOnly
    expect(sessionCookie?.httpOnly).toBeTruthy();

    // GET /me with cookie
    const resMe = await server.inject({
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
    const r = await server.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password },
    });
    expect(r.statusCode).toBe(201);

    // login
    const resLogin = await server.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(resLogin.statusCode).toBe(200);
    const loginCookies = (resLogin.cookies as SessionCookie[] | undefined) ?? [];
    const sessionCookie = loginCookies.find((c) => c.name === "session");
    expect(sessionCookie).toBeDefined();

    // logout
    const resLogout = await server.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      cookies: { session: sessionCookie!.value },
    });
    expect(resLogout.statusCode).toBe(200);
    expect(resLogout.json()).toEqual({ ok: true });

    // attempt protected route without cookie to simulate browser after logout -> should be unauthorized
    const resProtected = await server.inject({
      method: "GET",
      url: "/api/v1/protected",
    });
    expect(resProtected.statusCode).toBe(401);
  });

  it("prevents registration with an already existing email (409)", async () => {
    const email = "duplicate@example.com";
    const password = "Password123!";

    // First registration
    const r1 = await server.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password },
    });
    expect(r1.statusCode).toBe(201);

    // Second registration with same email
    const r2 = await server.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password },
    });
    expect(r2.statusCode).toBe(409);
    expect(r2.json()).toHaveProperty("error", "User exists");
  });

  it("prevents login with a non-existent user (401)", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "nonexistent@example.com", password: "Password123!" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toHaveProperty("error", "Invalid credentials");
  });

  it("prevents login with wrong password (401)", async () => {
    const email = "wrongpass@example.com";
    const password = "Password123!";

    // Register
    await server.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password },
    });

    // Login with wrong password
    const res = await server.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: "WrongPassword!" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toHaveProperty("error", "Invalid credentials");
  });

  it("requires session for GET /api/v1/auth/me (401)", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/auth/me",
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toHaveProperty("error", "Unauthorized");
  });

  it("enforces RBAC logic and missing session on protected routes (401)", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/protected",
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toHaveProperty("error", "Unauthorized");
  });

  it("enforces RBAC: non-admin user cannot access admin-only endpoint (403)", async () => {
    const email = TEST_USERS.rbacUser;
    const password = "RbacPass!1";

    const r = await server.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password },
    });
    expect(r.statusCode).toBe(201);

    // login as non-admin
    const resLogin = await server.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(resLogin.statusCode).toBe(200);
    const loginCookies = (resLogin.cookies as SessionCookie[] | undefined) ?? [];
    const sessionCookie = loginCookies.find((c) => c.name === "session");
    expect(sessionCookie).toBeDefined();

    // Attempt to access admin-only route
    const resAdmin = await server.inject({
      method: "GET",
      url: "/api/v1/admin",
      cookies: { session: sessionCookie!.value },
    });

    expect(resAdmin.statusCode).toBe(403);
    expect(resAdmin.json()).toHaveProperty("error", "Forbidden");
  });

  it("enforces RBAC: admin user can access admin-only endpoint (200)", async () => {
    const email = "admin.rbac@example.com";
    const password = "AdminRbacPass!1";

    // Since first admin is already created, if we want an admin we need to either
    // use TEST_USERS.firstAdmin or make a test user admin manually in the DB.
    // Let's use Prisma to update the role to ADMIN
    const r = await server.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password },
    });
    expect(r.statusCode).toBe(201);

    await prisma.user.update({
      where: { email },
      data: { role: "ADMIN" },
    });

    // login as admin
    const resLogin = await server.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(resLogin.statusCode).toBe(200);
    const loginCookies = (resLogin.cookies as SessionCookie[] | undefined) ?? [];
    const sessionCookie = loginCookies.find((c) => c.name === "session");

    // Attempt to access admin-only route
    const resAdmin = await server.inject({
      method: "GET",
      url: "/api/v1/admin",
      cookies: { session: sessionCookie!.value },
    });

    expect(resAdmin.statusCode).toBe(200);
    expect(resAdmin.json()).toHaveProperty("admin", true);
  });
});
