# Testing Guide

## Tech Stack

- **Framework:** Vitest 4 with `globals: true`
- **Coverage:** V8 provider, 70% threshold on lines/functions/branches/statements
- **HTTP testing:** Fastify's `app.inject()` (no real HTTP server needed)
- **Runtime:** Bun

## Scripts

| Scope   | Command                 | Description           |
| ------- | ----------------------- | --------------------- |
| Root    | `bun run test`          | Run all backend tests |
| Root    | `bun run test:coverage` | Run with coverage     |
| Backend | `bun run test`          | Run backend tests     |
| Backend | `bun run test:coverage` | Run with coverage     |
| Backend | `bun run test:ui`       | Vitest UI             |

## File Structure

Tests are **colocated** next to the source file they test, using the `.test.ts` suffix.

```
backend/src/
├── controllers/
│   ├── health.controller.ts
│   └── health.controller.test.ts      # functional test
├── services/
│   ├── category.service.ts
│   └── category.service.test.ts       # unit test
├── repositories/
│   ├── transaction.repository.ts
│   └── transaction.repository.test.ts # integration test
├── app.ts
└── index.ts
```

## Test Types

### Unit Tests (services)

Test business logic in isolation. Mock repository dependencies.

```ts
/// <reference types="vitest/globals" />

import { vi } from "vitest";
import { categorize } from "./category.service.js";

describe("categorize", () => {
  it("assigns grocery category for known merchant", () => {
    const mockRepo = { findByMerchant: vi.fn().mockReturnValue({ id: 1, name: "Groceries" }) };

    const result = categorize(mockRepo, "Migros Zürich");

    expect(result).toEqual({ id: 1, name: "Groceries" });
    expect(mockRepo.findByMerchant).toHaveBeenCalledWith("Migros Zürich");
  });
});
```

**Rules:**

- Services are framework-agnostic — no Fastify imports in tests.
- Mock the repository layer, never the service under test.
- One behavior per `it` block.

### Functional Tests (controllers / routes)

Test HTTP behavior through the full Fastify stack using `app.inject()`. No real server, no network.

```ts
/// <reference types="vitest/globals" />

import { buildApp } from "../app.js";

describe("GET /api/v1/health", () => {
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
```

**Rules:**

- Use `buildApp()` from `app.ts` to get a configured Fastify instance.
- Always call `app.close()` after the test.
- Assert on status codes, response bodies, and headers.
- Mock services when testing controller behavior in isolation.

### End-to-End Tests (E2E)

Test full request flows against a real database. These verify that controllers, services, repositories, and the database work together.

```ts
/// <reference types="vitest/globals" />

import { buildApp } from "../app.js";

describe("POST /api/v1/transactions/import", () => {
  it("imports CSV and persists transactions", async () => {
    const app = await buildApp(); // connected to test DB

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/transactions/import",
      payload: {
        /* CSV data */
      },
    });

    expect(response.statusCode).toBe(201);

    // Verify data was actually persisted
    const list = await app.inject({ method: "GET", url: "/api/v1/transactions" });
    expect(list.json().data).toHaveLength(5);

    await app.close();
  });
});
```

**Rules:**

- Run against a dedicated test database, never production.
- Clean up test data after each test (use `beforeEach`/`afterEach`).
- Keep E2E tests focused on critical paths — prefer unit/functional tests for edge cases.

## Conventions

### General

- Every test file starts with `/// <reference types="vitest/globals" />`.
- Use `describe` for grouping by function/endpoint, `it` for individual behaviors.
- Test names describe the expected behavior: `it("returns 404 when user not found")`.
- One assertion per concept — multiple `expect` calls are fine if they assert the same logical outcome.

### Mocking

- Import `vi` from `vitest` for mocks: `import { vi } from "vitest"`.
- Prefer dependency injection over module mocking (`vi.mock`).
- Reset mocks between tests with `beforeEach(() => { vi.clearAllMocks() })`.

### Setup / Teardown

- Use `beforeEach` / `afterEach` for per-test setup — not `beforeAll` unless sharing state is intentional and safe.
- Build a fresh `app` instance per test to avoid state leakage between tests.

### What to Test

| Layer        | What to test                                   | What to mock          |
| ------------ | ---------------------------------------------- | --------------------- |
| Services     | Business logic, edge cases, error conditions   | Repositories          |
| Controllers  | HTTP status codes, response shape, validation  | Services              |
| Repositories | Queries return correct data, transactions work | Nothing (use test DB) |
| E2E          | Critical user flows across all layers          | Nothing               |

### What NOT to Test

- Fastify internals (routing, serialization) — the framework is tested.
- Type correctness — TypeScript handles that.
- Private implementation details — test behavior through public interfaces.
