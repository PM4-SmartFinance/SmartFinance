import { vi } from "vitest";

// Default API mock used across tests. Individual tests can override with
// `vi.importMock("@/lib/api")` or `vi.mocked(api).api.get.mockResolvedValueOnce(...)`.
const defaultMock = {
  api: {
    get: vi.fn(() => Promise.resolve({})),
    post: vi.fn(() => Promise.resolve({})),
    patch: vi.fn(() => Promise.resolve({})),
    delete: vi.fn(() => Promise.resolve({})),
    upload: vi.fn(() => Promise.resolve({})),
  },
};

vi.mock("@/lib/api", () => defaultMock);

// Provide a minimal global fetch stub as a safety net. Tests should prefer
// mocking `@/lib/api` but some libraries may call `fetch` directly.
if (typeof globalThis.fetch === "undefined") {
  // Cast through unknown to avoid `any` lint rule while still stubbing fetch.
  globalThis.fetch = vi.fn(() =>
    Promise.reject(new Error("global fetch not mocked")),
  ) as unknown as typeof fetch;
}
