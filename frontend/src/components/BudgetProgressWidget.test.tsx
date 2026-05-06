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

type Period = "DAILY" | "MONTHLY" | "YEARLY";
type PeriodResult = {
  isLoading: boolean;
  error: Error | null;
  data: { budgets: unknown[]; categorySpending: unknown[] } | undefined;
};

function setPeriods(map: Partial<Record<Period, PeriodResult>>) {
  const fallback: PeriodResult = {
    isLoading: false,
    error: null,
    data: { budgets: [], categorySpending: [] },
  };
  mockUseBudgets.mockImplementation(({ period }: { period: Period }) => map[period] ?? fallback);
}

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
    mockUseCategories.mockReturnValue({
      data: [],
      isLoading: false,
      isSuccess: true,
      error: null,
    });
  });

  it("shows loading state when any period is loading", () => {
    setPeriods({
      DAILY: { isLoading: true, error: null, data: undefined },
    });
    renderWidget();
    expect(screen.getByText("Loading budget progress...")).toBeInTheDocument();
  });

  it("shows error state when the daily query fails", () => {
    setPeriods({
      DAILY: { isLoading: false, error: new Error("Daily failed"), data: undefined },
    });
    renderWidget();
    expect(
      screen.getByText("Failed to load budget progress. Please try again."),
    ).toBeInTheDocument();
  });

  it("shows error state when only the monthly query fails", () => {
    setPeriods({
      MONTHLY: { isLoading: false, error: new Error("Monthly failed"), data: undefined },
    });
    renderWidget();
    expect(
      screen.getByText("Failed to load budget progress. Please try again."),
    ).toBeInTheDocument();
  });

  it("shows error state when only the yearly query fails", () => {
    setPeriods({
      YEARLY: { isLoading: false, error: new Error("Yearly failed"), data: undefined },
    });
    renderWidget();
    expect(
      screen.getByText("Failed to load budget progress. Please try again."),
    ).toBeInTheDocument();
  });

  it("prefers a categoriesQuery error when no period query has failed", () => {
    setPeriods({});
    mockUseCategories.mockReturnValue({
      data: undefined,
      isLoading: false,
      isSuccess: false,
      error: new Error("categories failed"),
    });
    renderWidget();
    expect(
      screen.getByText("Failed to load budget progress. Please try again."),
    ).toBeInTheDocument();
  });

  it("shows empty state when no tracked totals exist", () => {
    setPeriods({});
    renderWidget();
    expect(
      screen.getByText(
        "No tracked budget totals yet. Create budgets and import transactions to populate these charts.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all budgets" })).toHaveAttribute(
      "href",
      "/budgets",
    );
  });

  it("shows the malformed-data message in the empty state when all values are unparseable", () => {
    const broken = {
      budgets: [],
      categorySpending: [
        {
          categoryId: "cat-1",
          spending: "not-a-number",
          scaledLimit: "also-bad",
          sourceBudgetType: "MONTHLY",
        },
      ],
    };
    setPeriods({
      DAILY: { isLoading: false, error: null, data: broken },
      MONTHLY: { isLoading: false, error: null, data: broken },
      YEARLY: { isLoading: false, error: null, data: broken },
    });
    renderWidget();
    expect(
      screen.getByText(
        "Some budget values could not be parsed. Please refresh — if the problem persists, contact support.",
      ),
    ).toBeInTheDocument();
  });

  it("renders an inline alert when some values are malformed but tracked totals still exist", () => {
    const valid = {
      budgets: [],
      categorySpending: [
        {
          categoryId: "cat-1",
          spending: "10.00",
          scaledLimit: "100.00",
          sourceBudgetType: "MONTHLY",
        },
        {
          categoryId: "cat-2",
          spending: "garbage",
          scaledLimit: "50.00",
          sourceBudgetType: "MONTHLY",
        },
      ],
    };
    setPeriods({
      DAILY: { isLoading: false, error: null, data: valid },
      MONTHLY: { isLoading: false, error: null, data: valid },
      YEARLY: { isLoading: false, error: null, data: valid },
    });
    mockUseCategories.mockReturnValue({
      data: [
        { id: "cat-1", categoryName: "Food" },
        { id: "cat-2", categoryName: "Transit" },
      ],
      isLoading: false,
      isSuccess: true,
      error: null,
    });
    renderWidget();
    expect(
      screen.getByText(
        "Some budget values could not be parsed and were excluded from the totals below.",
      ),
    ).toBeInTheDocument();
  });

  it("renders daily, monthly and yearly pies with totals", () => {
    setPeriods({
      DAILY: {
        isLoading: false,
        error: null,
        data: {
          budgets: [],
          categorySpending: [
            {
              categoryId: "cat-1",
              spending: "120.00",
              scaledLimit: "100.00",
              sourceBudgetType: "DAILY",
            },
          ],
        },
      },
      MONTHLY: {
        isLoading: false,
        error: null,
        data: {
          budgets: [],
          categorySpending: [
            {
              categoryId: "cat-1",
              spending: "85.50",
              scaledLimit: "1500.00",
              sourceBudgetType: "MONTHLY",
            },
          ],
        },
      },
      YEARLY: {
        isLoading: false,
        error: null,
        data: {
          budgets: [],
          categorySpending: [
            {
              categoryId: "cat-1",
              spending: "2200.00",
              scaledLimit: "12000.00",
              sourceBudgetType: "YEARLY",
            },
          ],
        },
      },
    });
    mockUseCategories.mockReturnValue({
      data: [{ id: "cat-1", categoryName: "Hobby" }],
      isLoading: false,
      isSuccess: true,
      error: null,
    });

    renderWidget();

    expect(screen.getByText("Budget Progress")).toBeInTheDocument();
    expect(screen.getByText("Daily")).toBeInTheDocument();
    expect(screen.getByText("Monthly")).toBeInTheDocument();
    expect(screen.getByText("Yearly")).toBeInTheDocument();
    expect(screen.getAllByText("Tracked total").length).toBe(3);
    expect(screen.getAllByText("Hobby").length).toBeGreaterThan(0);
    expect(screen.getByText("Over budget")).toBeInTheDocument();
  });

  it("renders the negative over-budget amount with currency formatting", () => {
    setPeriods({
      MONTHLY: {
        isLoading: false,
        error: null,
        data: {
          budgets: [],
          categorySpending: [
            {
              categoryId: "cat-1",
              spending: "150.00",
              scaledLimit: "100.00",
              sourceBudgetType: "MONTHLY",
            },
          ],
        },
      },
    });
    mockUseCategories.mockReturnValue({
      data: [{ id: "cat-1", categoryName: "Food" }],
      isLoading: false,
      isSuccess: true,
      error: null,
    });

    renderWidget();

    const overLabel = screen.getByText("Over budget");
    const overValue = overLabel.parentElement?.querySelector("span:last-child");
    expect(overValue?.textContent).toMatch(/^-/);
    expect(overValue?.textContent).toContain("50");
  });

  it("renders 'Unknown' for category ids missing from categories data", () => {
    setPeriods({
      MONTHLY: {
        isLoading: false,
        error: null,
        data: {
          budgets: [],
          categorySpending: [
            {
              categoryId: "ghost",
              spending: "20.00",
              scaledLimit: "100.00",
              sourceBudgetType: "MONTHLY",
            },
          ],
        },
      },
    });
    mockUseCategories.mockReturnValue({
      data: [],
      isLoading: false,
      isSuccess: true,
      error: null,
    });
    renderWidget();
    expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0);
  });
});
