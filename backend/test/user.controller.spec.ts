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
    // register admin and two users
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: ADMIN_EMAIL, password: "AdminPass1!" },
    });
    await prisma.dimUser.update({ where: { email: ADMIN_EMAIL }, data: { role: "ADMIN" } });

    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: USER_A_EMAIL, password: "UserPass1!" },
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: USER_B_EMAIL, password: "UserPass2!" },
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

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/users?limit=2&offset=0",
      cookies: { session: session!.value },
    });
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
  });
});
