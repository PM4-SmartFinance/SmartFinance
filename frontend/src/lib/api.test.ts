import { ApiError, api } from "./api";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("ApiError", () => {
  it("stores status, body, and message", () => {
    const error = new ApiError(404, { detail: "not found" }, "Not Found");

    expect(error.status).toBe(404);
    expect(error.body).toEqual({ detail: "not found" });
    expect(error.message).toBe("Not Found");
    expect(error.name).toBe("ApiError");
  });

  it("is an instance of Error", () => {
    const error = new ApiError(500, null, "Server Error");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("api.upload", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends a POST request with the FormData body", async () => {
    const mockResponse = { imported: 3 };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(mockResponse), { status: 200 }));

    const formData = new FormData();
    formData.append("file", new File(["data"], "test.csv"));

    const result = await api.upload<{ imported: number }>("/transactions/import", formData);

    expect(result).toEqual({ imported: 3 });
    expect(fetch).toHaveBeenCalledOnce();

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(formData);
  });

  it("does not set Content-Type header for FormData", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

    const formData = new FormData();
    await api.upload("/test", formData);

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.["Content-Type"]).toBeUndefined();
  });

  it("includes credentials", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

    await api.upload("/test", new FormData());

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.credentials).toBe("include");
  });

  it("throws ApiError on non-2xx response", async () => {
    const errorBody = { error: { message: "Invalid CSV" } };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(errorBody), { status: 422 }));

    const error = await api.upload("/test", new FormData()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(422);
    expect((error as ApiError).body).toEqual(errorBody);
  });
});
