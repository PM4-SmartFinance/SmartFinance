import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

describe("GET /metrics", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // No register.clear() here — the prom-client default registry is already
    // cleared once per test file by `test/setup-prom-registry.ts`, and the
    // smartfinance_* Counters re-register on module load via
    // src/metrics/business-metrics.ts (imported transitively by buildApp).
    // Clearing again here would drop those Counters before /metrics is scraped.
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves Prometheus exposition format with the smartfinance_* business series", async () => {
    const res = await app.inject({ method: "GET", url: "/metrics" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/plain/);
    expect(res.body).toContain("smartfinance_login_attempts_total");
    expect(res.body).toContain("smartfinance_import_operations_total");
    expect(res.body).toContain("smartfinance_transactions_imported_total");
  });
});
