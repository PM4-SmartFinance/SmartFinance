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
  // Default to a benign 200/empty JSON response so tests don't fail with network errors.
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
  })) as unknown as typeof fetch;
}
