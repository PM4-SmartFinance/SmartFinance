/// <reference types="vitest/globals" />

// TODO: Re-enable when CI/CD has a test database (separate Jira issue)
import { buildApp } from "../app.js";

describe.skip("GET /api/v1/health", () => {
  it("returns status ok", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });

    await app.close();
  });
});
