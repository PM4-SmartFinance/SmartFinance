import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetProgressWidget } from "./BudgetProgressWidget";

const { mockUseBudgets, mockUseCategories } = vi.hoisted(() => ({
  mockUseBudgets: vi.fn(),
  mockUseCategories: vi.fn(),
}));

vi.mock("../lib/queries/budgets", () => ({
  useBudgets: mockUseBudgets,
}));

vi.mock("../lib/queries/categories", () => ({
  useCategories: mockUseCategories,
}));

function renderWidget() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BudgetProgressWidget />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("BudgetProgressWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCategories.mockReturnValue({ data: [], isLoading: false, error: null });
  });

  it("shows loading state", () => {
    mockUseBudgets
      .mockReturnValueOnce({ isLoading: true, error: null, data: undefined })
      .mockReturnValueOnce({ isLoading: false, error: null, data: undefined })
      .mockReturnValueOnce({ isLoading: false, error: null, data: undefined });

    renderWidget();

    expect(screen.getByText("Loading budget progress...")).toBeInTheDocument();
  });

  it("shows empty state when no tracked totals exist", () => {
    const emptyData = { budgets: [], categorySpending: [] };
    mockUseBudgets
      .mockReturnValueOnce({ isLoading: false, error: null, data: emptyData })
      .mockReturnValueOnce({ isLoading: false, error: null, data: emptyData })
      .mockReturnValueOnce({ isLoading: false, error: null, data: emptyData });

    renderWidget();

    expect(
      screen.getByText(
        "No tracked budget totals yet. Create budgets and import transactions to populate these charts.",
      ),
    ).toBeInTheDocument();
  });

  it("renders daily, monthly and yearly pies with totals", () => {
    const dailyData = {
      budgets: [],
      categorySpending: [
        {
          categoryId: "cat-1",
          spending: "10.00",
          scaledLimit: "100.00",
          sourceBudgetType: "DAILY",
        },
      ],
    };
    const monthlyData = {
      budgets: [],
      categorySpending: [
        {
          categoryId: "cat-1",
          spending: "85.50",
          scaledLimit: "1500.00",
          sourceBudgetType: "MONTHLY",
        },
      ],
    };
    const yearlyData = {
      budgets: [],
      categorySpending: [
        {
          categoryId: "cat-1",
          spending: "2200.00",
          scaledLimit: "12000.00",
          sourceBudgetType: "YEARLY",
        },
      ],
    };

    mockUseBudgets
      .mockReturnValueOnce({ isLoading: false, error: null, data: dailyData })
      .mockReturnValueOnce({ isLoading: false, error: null, data: monthlyData })
      .mockReturnValueOnce({ isLoading: false, error: null, data: yearlyData });
    mockUseCategories.mockReturnValue({
      data: [{ id: "cat-1", categoryName: "Hobby" }],
      isLoading: false,
      error: null,
    });

    renderWidget();

    expect(screen.getByText("Budget Progress")).toBeInTheDocument();
    expect(screen.getByText("Daily")).toBeInTheDocument();
    expect(screen.getByText("Monthly")).toBeInTheDocument();
    expect(screen.getByText("Yearly")).toBeInTheDocument();
    expect(screen.getAllByText("Tracked total").length).toBe(3);
    expect(screen.getAllByText("Hobby").length).toBeGreaterThan(0);
  });
});
