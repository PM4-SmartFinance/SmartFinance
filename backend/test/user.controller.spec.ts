import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { prisma } from "../src/prisma.js";
import { buildApp } from "../src/app.js";
import type { FastifyInstance } from "fastify";
import * as auditService from "../src/services/audit.service.js";

let app: FastifyInstance;

const ADMIN_EMAIL = "test.admin.user@example.com";
const USER_A_EMAIL = "test.user.a@example.com";
const USER_B_EMAIL = "test.user.b@example.com";

beforeAll(async () => {
  // cleanup
  await prisma.dimUser.deleteMany({
    where: { email: { in: [ADMIN_EMAIL, USER_A_EMAIL, USER_B_EMAIL] } },
  });

  // ensure default currency
  await prisma.dimCurrency.upsert({
    where: { code: "CHF" },
    create: { code: "CHF", name: "Swiss Franc", format: "CHF 1'234.56" },
    update: {},
  });

  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await prisma.dimUser.deleteMany({
    where: { email: { in: [ADMIN_EMAIL, USER_A_EMAIL, USER_B_EMAIL] } },
  });
  await app.close();
});

describe("User management endpoints", () => {
  it("admin can list users (paginated)", async () => {
    // register admin and two users using the new /users endpoint
    await app.inject({
      method: "POST",
      url: "/api/v1/users",
      payload: { email: ADMIN_EMAIL, password: "AdminPass1!", displayName: "Admin", role: "ADMIN" },
    });

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: ADMIN_EMAIL, password: "AdminPass1!" },
    });
    expect(login.statusCode).toBe(200);
    const cookies = login.cookies as unknown as Array<{
      name: string;
      value: string;
      httpOnly?: boolean;
    }>;
    const session = cookies.find((c) => c.name === "session");
    expect(session).toBeDefined();

    await app.inject({
      method: "POST",
      url: "/api/v1/users",
      payload: { email: USER_A_EMAIL, password: "UserPass1!", displayName: "User A", role: "USER" },
      cookies: { session: session!.value },
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/users",
      payload: { email: USER_B_EMAIL, password: "UserPass2!", displayName: "User B", role: "USER" },
      cookies: { session: session!.value },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/users?limit=2&offset=0",
      cookies: { session: session!.value },
    });
    console.log("LIST ERROR:", res.json());
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.limit).toBe(2);
  });

  it("non-admin cannot list all users (403)", async () => {
    // login as USER_A
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: USER_A_EMAIL, password: "UserPass1!" },
    });
    expect(login.statusCode).toBe(200);
    const cookies = login.cookies as unknown as Array<{
      name: string;
      value: string;
      httpOnly?: boolean;
    }>;
    const session = cookies.find((c) => c.name === "session");
    expect(session).toBeDefined();

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/users",
      cookies: { session: session!.value },
    });
    expect(res.statusCode).toBe(403);
  });

  it("non-admin cannot patch other user's profile (403)", async () => {
    // login as USER_A
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: USER_A_EMAIL, password: "UserPass1!" },
    });
    const cookies = login.cookies as unknown as Array<{
      name: string;
      value: string;
      httpOnly?: boolean;
    }>;
    const session = cookies.find((c) => c.name === "session");
    expect(session).toBeDefined();

    // find user B id
    const userB = await prisma.dimUser.findUnique({ where: { email: USER_B_EMAIL } });
    expect(userB).toBeTruthy();

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/users/${userB!.id}`,
      payload: { name: "Hacked" },
      cookies: { session: session!.value },
    });
    expect(res.statusCode).toBe(403);
  });

  it("regular user can fetch their own profile (200) and no password leak", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: USER_A_EMAIL, password: "UserPass1!" },
    });
    const cookies = login.cookies as unknown as Array<{ name: string; value: string }>;
    const session = cookies.find((c) => c.name === "session");

    const userA = await prisma.dimUser.findUnique({ where: { email: USER_A_EMAIL } });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/users/${userA!.id}`,
      cookies: { session: session!.value },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.email).toBe(USER_A_EMAIL);
    expect(body.user).not.toHaveProperty("password");
  });

  it("admin can fetch any user's profile (200) and no password leak", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: ADMIN_EMAIL, password: "AdminPass1!" },
    });
    const cookies = login.cookies as unknown as Array<{ name: string; value: string }>;
    const session = cookies.find((c) => c.name === "session");

    const userA = await prisma.dimUser.findUnique({ where: { email: USER_A_EMAIL } });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/users/${userA!.id}`,
      cookies: { session: session!.value },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.email).toBe(USER_A_EMAIL);
    expect(body.user).not.toHaveProperty("password");
  });

  it("regular user cannot fetch someone else's profile (403)", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: USER_A_EMAIL, password: "UserPass1!" },
    });
    const cookies = login.cookies as unknown as Array<{ name: string; value: string }>;
    const session = cookies.find((c) => c.name === "session");

    const userB = await prisma.dimUser.findUnique({ where: { email: USER_B_EMAIL } });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/users/${userB!.id}`,
      cookies: { session: session!.value },
    });
    console.log("DEBUG ERROR:", res.json());
    expect(res.statusCode).toBe(403);
  });

  it("fetching a non-existent user ID returns 404", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: ADMIN_EMAIL, password: "AdminPass1!" },
    });
    const cookies = login.cookies as unknown as Array<{ name: string; value: string }>;
    const session = cookies.find((c) => c.name === "session");

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/users/00000000-0000-0000-0000-000000000000`,
      cookies: { session: session!.value },
    });
    expect(res.statusCode).toBe(404);
  });

  it("admin can change role and ROLE_CHANGED audit is emitted", async () => {
    // spy on audit.logEvent
    const spy = vi.spyOn(auditService, "logEvent");

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: ADMIN_EMAIL, password: "AdminPass1!" },
    });
    const cookies = login.cookies as unknown as Array<{
      name: string;
      value: string;
      httpOnly?: boolean;
    }>;
    const session = cookies.find((c) => c.name === "session");

    const userB = await prisma.dimUser.findUnique({ where: { email: USER_B_EMAIL } });
    expect(userB).toBeTruthy();

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/users/${userB!.id}`,
      payload: { role: "ADMIN" },
      cookies: { session: session!.value },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user).not.toHaveProperty("password");

    expect(spy).toHaveBeenCalled();
    const calledWith = spy.mock.calls.find((c) => c[0] === "ROLE_CHANGED");
    expect(calledWith).toBeDefined();

    // cleanup spy
    spy.mockRestore();
  });

  it("admin can delete user and USER_DELETED audit is emitted", async () => {
    const spy = vi.spyOn(auditService, "logEvent");

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: ADMIN_EMAIL, password: "AdminPass1!" },
    });
    const cookies = login.cookies as unknown as Array<{
      name: string;
      value: string;
      httpOnly?: boolean;
    }>;
    const session = cookies.find((c) => c.name === "session");

    const userA = await prisma.dimUser.findUnique({ where: { email: USER_A_EMAIL } });
    expect(userA).toBeTruthy();

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/users/${userA!.id}`,
      cookies: { session: session!.value },
    });
    expect(res.statusCode).toBe(204);
    expect(spy).toHaveBeenCalled();
    const calledWith = spy.mock.calls.find((c) => c[0] === "USER_DELETED");
    expect(calledWith).toBeDefined();

    spy.mockRestore();

    // Verify logging in as deactivated (deleted) user returns 403
    const deactivatedLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: USER_A_EMAIL, password: "UserPass1!" },
    });
    expect(deactivatedLogin.statusCode).toBe(403);
  });
});
