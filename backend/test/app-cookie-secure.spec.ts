import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { register as promRegister } from "prom-client";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

// KAN-160: the session cookie's Secure attribute must follow SESSION_COOKIE_SECURE
// (overriding the NODE_ENV default), and reject ambiguous values rather than
// silently downgrading — a non-Secure cookie on an HTTPS deployment is the exact
// "cookie silently dropped / login does nothing" class of bug this flag controls.

let app: FastifyInstance | undefined;

// Drives the secure-session plugin to emit a Set-Cookie and reports whether the
// cookie carries the Secure attribute, without touching the database.
async function sessionCookieIsSecure(instance: FastifyInstance): Promise<boolean> {
  instance.get("/__session_probe", async (request, reply) => {
    request.session.set("probe", "1");
    return reply.send({ ok: true });
  });
  await instance.ready();
  const res = await instance.inject({ method: "GET", url: "/__session_probe" });
  const setCookie = res.headers["set-cookie"];
  const header = Array.isArray(setCookie) ? setCookie.join("\n") : String(setCookie ?? "");
  return /;\s*Secure/i.test(header);
}

beforeEach(() => {
  // buildApp() registers Counters on the shared prom-client registry; clear it so
  // repeated builds in this file stay idempotent (mirrors module-bootstrap.spec).
  promRegister.clear();
  vi.stubEnv("SESSION_SECRET", "x".repeat(32));
});

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }
  vi.unstubAllEnvs();
});

describe("session cookie Secure flag (KAN-160)", () => {
  it("defaults to Secure in production when SESSION_COOKIE_SECURE is unset", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_COOKIE_SECURE", undefined as unknown as string);
    app = await buildApp();
    expect(await sessionCookieIsSecure(app)).toBe(true);
  });

  it("disables Secure when SESSION_COOKIE_SECURE=false (plain-HTTP self-host)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_COOKIE_SECURE", "false");
    app = await buildApp();
    expect(await sessionCookieIsSecure(app)).toBe(false);
  });

  it("enables Secure when SESSION_COOKIE_SECURE=true outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SESSION_COOKIE_SECURE", "true");
    app = await buildApp();
    expect(await sessionCookieIsSecure(app)).toBe(true);
  });

  it.each(["1", "TRUE", "yes", "False", ""])(
    "throws on the ambiguous SESSION_COOKIE_SECURE value %j instead of downgrading",
    async (value) => {
      vi.stubEnv("SESSION_COOKIE_SECURE", value);
      await expect(buildApp()).rejects.toThrow(/SESSION_COOKIE_SECURE/);
    },
  );
});
