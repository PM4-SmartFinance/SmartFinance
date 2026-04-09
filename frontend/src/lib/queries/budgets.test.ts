import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useBudgets, useCreateBudget, useUpdateBudget, useDeleteBudget, Budget } from "./budgets";

vi.mock("../api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from "../api";

const mockApi = {
  get: vi.mocked(api.get),
  post: vi.mocked(api.post),
  patch: vi.mocked(api.patch),
  delete: vi.mocked(api.delete),
};

const baseBudget: Budget = {
  id: "b-1",
  categoryId: "cat-1",
  month: 3,
  year: 2026,
  limitAmount: "500.00",
  active: true,
  currentSpending: "142.50",
  percentageUsed: 28.5,
  remainingAmount: "357.50",
  isOverBudget: false,
  createdAt: "2026-03-27T10:00:00.000Z",
  updatedAt: "2026-03-27T10:00:00.000Z",
};

const secondBudget: Budget = {
  ...baseBudget,
  id: "b-2",
  categoryId: "cat-2",
  limitAmount: "300.00",
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

describe("useBudgets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and unwraps budgets from the API", async () => {
    mockApi.get.mockResolvedValue({ budgets: [baseBudget, secondBudget] });

    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useBudgets(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([baseBudget, secondBudget]);
    expect(mockApi.get).toHaveBeenCalledWith("/budgets");
  });
});

describe("useCreateBudget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prepends new budget to cache on success", async () => {
    const newBudget: Budget = { ...baseBudget, id: "b-new", categoryId: "cat-3" };
    mockApi.post.mockResolvedValue({ budget: newBudget });

    const { queryClient, wrapper } = createTestWrapper();
    queryClient.setQueryData(["budgets"], [baseBudget]);

    const { result } = renderHook(() => useCreateBudget(), { wrapper });

    await result.current.mutateAsync({
      categoryId: "cat-3",
      month: 3,
      year: 2026,
      limitAmount: 500,
    });

    const cached = queryClient.getQueryData<Budget[]>(["budgets"]);
    expect(cached).toHaveLength(2);
    expect(cached![0].id).toBe("b-new");
    expect(cached![1].id).toBe("b-1");
  });

  it("invalidates cache on error", async () => {
    mockApi.post.mockRejectedValue(new Error("Server error"));
    mockApi.get.mockResolvedValue({ budgets: [baseBudget] });

    const { queryClient, wrapper } = createTestWrapper();
    queryClient.setQueryData(["budgets"], [baseBudget]);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateBudget(), { wrapper });

    try {
      await result.current.mutateAsync({
        categoryId: "cat-3",
        month: 3,
        year: 2026,
        limitAmount: 500,
      });
    } catch {
      // expected
    }

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["budgets"] }));
  });
});

describe("useUpdateBudget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces matching budget in cache on success", async () => {
    const updatedBudget: Budget = { ...baseBudget, limitAmount: "750.00" };
    mockApi.patch.mockResolvedValue({ budget: updatedBudget });

    const { queryClient, wrapper } = createTestWrapper();
    queryClient.setQueryData(["budgets"], [baseBudget, secondBudget]);

    const { result } = renderHook(() => useUpdateBudget(), { wrapper });

    await result.current.mutateAsync({ id: "b-1", input: { limitAmount: 750 } });

    const cached = queryClient.getQueryData<Budget[]>(["budgets"]);
    expect(cached).toHaveLength(2);
    expect(cached![0].limitAmount).toBe("750.00");
    expect(cached![1].id).toBe("b-2");
  });
});

describe("useDeleteBudget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes budget from cache on success", async () => {
    mockApi.delete.mockResolvedValue(undefined);

    const { queryClient, wrapper } = createTestWrapper();
    queryClient.setQueryData(["budgets"], [baseBudget, secondBudget]);

    const { result } = renderHook(() => useDeleteBudget(), { wrapper });

    await result.current.mutateAsync("b-1");

    const cached = queryClient.getQueryData<Budget[]>(["budgets"]);
    expect(cached).toHaveLength(1);
    expect(cached![0].id).toBe("b-2");
  });

  it("invalidates cache on error", async () => {
    mockApi.delete.mockRejectedValue(new Error("Server error"));
    mockApi.get.mockResolvedValue({ budgets: [baseBudget] });

    const { queryClient, wrapper } = createTestWrapper();
    queryClient.setQueryData(["budgets"], [baseBudget]);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteBudget(), { wrapper });

    try {
      await result.current.mutateAsync("b-1");
    } catch {
      // expected
    }

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["budgets"] }));
  });
});
