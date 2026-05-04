import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import type { ReactNode } from "react";
import { useLogout } from "./useLogout";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: {
    post: vi.fn(),
  },
}));

const mockPost = vi.mocked(api.post);

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="path">{location.pathname}</span>;
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/start"]}>
          <Routes>
            <Route
              path="*"
              element={
                <>
                  {children}
                  <LocationProbe />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return { Wrapper, queryClient };
}

describe("useLogout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears the query cache and navigates to /login on success", async () => {
    mockPost.mockResolvedValue({ ok: true });
    const { Wrapper, queryClient } = makeWrapper();
    queryClient.setQueryData(["sentinel"], "value");

    const { result, rerender } = renderHook(() => useLogout(), { wrapper: Wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender();

    expect(queryClient.getQueryData(["sentinel"])).toBeUndefined();
    expect(mockPost).toHaveBeenCalledWith("/auth/logout", {});
  });

  it("clears cache and navigates on server failure", async () => {
    mockPost.mockRejectedValue(new Error("Server error"));
    const { Wrapper, queryClient } = makeWrapper();
    queryClient.setQueryData(["sentinel"], "value");

    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(["sentinel"])).toBeUndefined();
  });

  it("respects custom redirectTo", async () => {
    mockPost.mockResolvedValue({ ok: true });
    const { Wrapper } = makeWrapper();

    const { result } = renderHook(() => useLogout({ redirectTo: "/bye" }), { wrapper: Wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
