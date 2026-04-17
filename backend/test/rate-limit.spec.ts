import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import type { FastifyInstance } from "fastify";

/**
 * `buildApp` disables the global rate limiter under Vitest so normal
 * integration suites don't trip 429s. These tests opt back in via
 * `forceRateLimit: true` to verify the per-route limits on
 * `POST /auth/login` and `POST /users`.
 *
 * Each describe builds its own app so the in-memory buckets stay
 * isolated.
 */

type InjectCookie = { name: string; value: string };

const TEST_PASSWORD = "Password123!";
const LOGIN_EMAIL = "rate-limit-login@example.com";
const USERS_ADMIN_EMAIL = "rate-limit-users-admin@example.com";

async function ensureCurrency(): Promise<void> {
  await prisma.dimCurrency.upsert({
    where: { code: "CHF" },
    create: { code: "CHF", name: "Swiss Franc", format: "CHF 1'234.56" },
    update: {},
  });
}

async function bootstrapAdmin(
  app: FastifyInstance,
  email: string,
  password: string,
): Promise<void> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/users",
    payload: { email, password },
  });
  if (res.statusCode !== 201) {
    throw new Error(`Bootstrap failed: ${res.statusCode} ${res.body}`);
  }
}

async function loginAs(app: FastifyInstance, email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Login failed: ${res.statusCode} ${res.body}`);
  }
  const cookies = (res.cookies as InjectCookie[] | undefined) ?? [];
  const session = cookies.find((c) => c.name === "session");
  if (!session) throw new Error("Login succeeded but no session cookie was issued");
  return session.value;
}

describe("Rate limit — POST /api/v1/auth/login (max 10 / minute)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await prisma.dimUser.deleteMany();
    await ensureCurrency();
    app = await buildApp({ forceRateLimit: true });
    await app.ready();
    await bootstrapAdmin(app, LOGIN_EMAIL, TEST_PASSWORD);
  });

  afterAll(async () => {
    await prisma.dimUser.deleteMany({ where: { email: LOGIN_EMAIL } });
    await app.close();
  });

  it("allows requests 1 through 10 and returns 429 on request 11", async () => {
    for (let attempt = 1; attempt <= 10; attempt++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: LOGIN_EMAIL, password: TEST_PASSWORD },
      });
      expect(res.statusCode, `login attempt ${attempt} should succeed`).toBe(200);
    }

    const blocked = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: LOGIN_EMAIL, password: TEST_PASSWORD },
    });
    expect(blocked.statusCode).toBe(429);
  });
});

describe("Rate limit — POST /api/v1/auth/login counts failed attempts (wrong password)", () => {
  let app: FastifyInstance;
  const INVALID_LOGIN_EMAIL = "rate-limit-invalid@example.com";

  beforeAll(async () => {
    await prisma.dimUser.deleteMany();
    await ensureCurrency();
    app = await buildApp({ forceRateLimit: true });
    await app.ready();
    await bootstrapAdmin(app, INVALID_LOGIN_EMAIL, TEST_PASSWORD);
  });

  afterAll(async () => {
    await prisma.dimUser.deleteMany({ where: { email: INVALID_LOGIN_EMAIL } });
    await app.close();
  });

  it("counts wrong-password attempts against the rate-limit bucket and blocks at request 11", async () => {
    for (let attempt = 1; attempt <= 10; attempt++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: INVALID_LOGIN_EMAIL, password: "WrongPassword123!" },
      });
      // Failed logins must still count — this is the actual brute-force threat model
      expect(res.statusCode, `failed login attempt ${attempt} should return 401`).toBe(401);
    }

    const blocked = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: INVALID_LOGIN_EMAIL, password: "WrongPassword123!" },
    });
    expect(blocked.statusCode).toBe(429);
  });
});

describe("Rate limit — POST /api/v1/users (max 10 / minute, admin creation path)", () => {
  let app: FastifyInstance;
  let adminSession: string;
  const createdEmails: string[] = [USERS_ADMIN_EMAIL];

  beforeAll(async () => {
    await prisma.dimUser.deleteMany();
    await ensureCurrency();
    app = await buildApp({ forceRateLimit: true });
    await app.ready();
    // Bootstrap counts as request #1 on the /users bucket; the remaining
    // 9 successful creates happen in the test body to reach the cap.
    await bootstrapAdmin(app, USERS_ADMIN_EMAIL, TEST_PASSWORD);
    adminSession = await loginAs(app, USERS_ADMIN_EMAIL, TEST_PASSWORD);
  });

  afterAll(async () => {
    await prisma.dimUser.deleteMany({ where: { email: { in: createdEmails } } });
    await app.close();
  });

  it("allows requests 1 through 10 (bootstrap + 9 admin creates) and returns 429 on request 11", async () => {
    for (let attempt = 2; attempt <= 10; attempt++) {
      const email = `rate-limit-user-${attempt}@example.com`;
      createdEmails.push(email);
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/users",
        payload: { email, password: TEST_PASSWORD },
        cookies: { session: adminSession },
      });
      expect(res.statusCode, `POST /users attempt ${attempt} should succeed`).toBe(201);
    }

    const blockedEmail = "rate-limit-user-11@example.com";
    createdEmails.push(blockedEmail);
    const blocked = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      payload: { email: blockedEmail, password: TEST_PASSWORD },
      cookies: { session: adminSession },
    });
    expect(blocked.statusCode).toBe(429);
  });
});
