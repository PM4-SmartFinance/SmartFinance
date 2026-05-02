import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import {
  useBudgets,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
  getBudgetTypeLabel,
  getMostSpecificActiveBudget,
  Budget,
} from "./budgets";

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
  type: "MONTHLY",
  month: 0,
  year: 0,
  limitAmount: "500.00",
  active: true,
  isActive: true,
  priority: 1,
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
    const { result } = renderHook(() => useBudgets({ period: "MONTHLY" }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ budgets: [baseBudget, secondBudget] });
    expect(mockApi.get).toHaveBeenCalledWith("/budgets?period=MONTHLY");
  });
});

describe("useCreateBudget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates budgets cache on success", async () => {
    const newBudget: Budget = { ...baseBudget, id: "b-new", categoryId: "cat-3" };
    mockApi.post.mockResolvedValue({ budget: newBudget });

    const { queryClient, wrapper } = createTestWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateBudget(), { wrapper });

    await result.current.mutateAsync({
      categoryId: "cat-3",
      type: "MONTHLY",
      limitAmount: 500,
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["budgets"] });
  });

  it("calls api.post with correct input", async () => {
    const newBudget: Budget = { ...baseBudget, id: "b-new", categoryId: "cat-3" };
    mockApi.post.mockResolvedValue({ budget: newBudget });

    const { wrapper } = createTestWrapper();
    const { result } = renderHook(() => useCreateBudget(), { wrapper });

    await result.current.mutateAsync({
      categoryId: "cat-3",
      type: "MONTHLY",
      limitAmount: 500,
    });

    expect(mockApi.post).toHaveBeenCalledWith("/budgets", {
      categoryId: "cat-3",
      type: "MONTHLY",
      limitAmount: 500,
    });
  });
});

describe("useUpdateBudget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates budgets cache on success", async () => {
    const updatedBudget: Budget = { ...baseBudget, limitAmount: "750.00" };
    mockApi.patch.mockResolvedValue({ budget: updatedBudget });

    const { queryClient, wrapper } = createTestWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateBudget(), { wrapper });

    await result.current.mutateAsync({ id: "b-1", input: { limitAmount: 750 } });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["budgets"] });
  });
});

describe("useDeleteBudget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates budgets cache on success", async () => {
    mockApi.delete.mockResolvedValue(undefined);

    const { queryClient, wrapper } = createTestWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteBudget(), { wrapper });

    await result.current.mutateAsync("b-1");

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["budgets"] });
  });
});

describe("getBudgetTypeLabel", () => {
  it("returns 'Daily Budget' for DAILY", () => {
    expect(getBudgetTypeLabel("DAILY", 0, 0)).toBe("Daily Budget");
  });

  it("returns 'Monthly Budget' for MONTHLY", () => {
    expect(getBudgetTypeLabel("MONTHLY", 0, 0)).toBe("Monthly Budget");
  });

  it("returns 'Yearly Budget' for YEARLY", () => {
    expect(getBudgetTypeLabel("YEARLY", 0, 0)).toBe("Yearly Budget");
  });

  it("returns month name (recurring) for SPECIFIC_MONTH", () => {
    expect(getBudgetTypeLabel("SPECIFIC_MONTH", 3, 0)).toBe("March (recurring)");
    expect(getBudgetTypeLabel("SPECIFIC_MONTH", 12, 0)).toBe("December (recurring)");
  });

  it("returns year string for SPECIFIC_YEAR", () => {
    expect(getBudgetTypeLabel("SPECIFIC_YEAR", 0, 2026)).toBe("2026");
  });

  it("returns month + year for SPECIFIC_MONTH_YEAR", () => {
    expect(getBudgetTypeLabel("SPECIFIC_MONTH_YEAR", 6, 2026)).toBe("June 2026");
    expect(getBudgetTypeLabel("SPECIFIC_MONTH_YEAR", 1, 2025)).toBe("January 2025");
  });
});

describe("getMostSpecificActiveBudget", () => {
  const makeBudget = (overrides: Partial<Budget>): Budget => ({
    ...baseBudget,
    ...overrides,
  });

  it("returns null for empty array", () => {
    expect(getMostSpecificActiveBudget([])).toBeNull();
  });

  it("returns null when all budgets are inactive", () => {
    const budgets = [
      makeBudget({ id: "b-1", isActive: false, priority: 3 }),
      makeBudget({ id: "b-2", isActive: false, priority: 1 }),
    ];
    expect(getMostSpecificActiveBudget(budgets)).toBeNull();
  });

  it("returns the single active budget", () => {
    const budgets = [
      makeBudget({ id: "b-1", isActive: false, priority: 3 }),
      makeBudget({ id: "b-2", isActive: true, priority: 1 }),
    ];
    expect(getMostSpecificActiveBudget(budgets)!.id).toBe("b-2");
  });

  it("returns highest-priority active budget", () => {
    const budgets = [
      makeBudget({ id: "b-daily", isActive: true, priority: 0 }),
      makeBudget({ id: "b-monthly", isActive: true, priority: 1 }),
      makeBudget({ id: "b-specific", isActive: true, priority: 3 }),
    ];
    expect(getMostSpecificActiveBudget(budgets)!.id).toBe("b-specific");
  });

  it("skips inactive budgets even if they have higher priority", () => {
    const budgets = [
      makeBudget({ id: "b-inactive-high", isActive: false, priority: 3 }),
      makeBudget({ id: "b-active-low", isActive: true, priority: 0 }),
    ];
    expect(getMostSpecificActiveBudget(budgets)!.id).toBe("b-active-low");
  });
});
