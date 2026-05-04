import { createElement } from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from "../api";
import { useCreateCategory, useDeleteCategory, useUpdateCategory } from "./categories";

const mockApi = {
  post: vi.mocked(api.post),
  patch: vi.mocked(api.patch),
  delete: vi.mocked(api.delete),
};

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

describe("category mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates dashboard queries after creating a category", async () => {
    mockApi.post.mockResolvedValue({ category: { id: "cat-1" } });

    const { queryClient, wrapper } = createTestWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateCategory(), { wrapper });

    await result.current.mutateAsync("Groceries");

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
  });

  it("invalidates dashboard queries after updating a category", async () => {
    mockApi.patch.mockResolvedValue({ category: { id: "cat-1" } });

    const { queryClient, wrapper } = createTestWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateCategory(), { wrapper });

    await result.current.mutateAsync({ id: "cat-1", categoryName: "Food" });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
  });

  it("invalidates dashboard queries after deleting a category", async () => {
    mockApi.delete.mockResolvedValue(undefined);

    const { queryClient, wrapper } = createTestWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteCategory(), { wrapper });

    await result.current.mutateAsync("cat-1");

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
  });
});
