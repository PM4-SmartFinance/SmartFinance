import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
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
    mockUseCategories.mockReturnValue({ data: [], isLoading: false, isSuccess: true, error: null });
  });

  it("shows loading state when any period is loading", () => {
    setPeriods({ DAILY: { isLoading: true, error: null, data: undefined } });
    renderWidget();
    expect(screen.getByText("Loading budget progress…")).toBeInTheDocument();
  });

  it("shows error state when the daily query fails", () => {
    setPeriods({ DAILY: { isLoading: false, error: new Error("Daily failed"), data: undefined } });
    renderWidget();
    expect(
      screen.getByText("Failed to load budget progress. Please try again."),
    ).toBeInTheDocument();
  });

  it("shows error state when the categories query fails", () => {
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

  it("shows empty state when no category has a budget", () => {
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

  it("shows the malformed-data message when all budgeted values are unparseable", () => {
    const broken = {
      budgets: [],
      categorySpending: [
        { categoryId: "cat-1", spending: "nope", scaledLimit: "bad", sourceBudgetType: "MONTHLY" },
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

  it("renders a bar for every budgeted category — including ones with no spending yet", () => {
    setPeriods({
      MONTHLY: {
        isLoading: false,
        error: null,
        data: {
          budgets: [],
          categorySpending: [
            {
              categoryId: "hobby",
              spending: "171.00",
              scaledLimit: "250.00",
              sourceBudgetType: "MONTHLY",
            },
            {
              categoryId: "groceries",
              spending: "0.00",
              scaledLimit: "750.00",
              sourceBudgetType: "MONTHLY",
            },
            {
              categoryId: "ent",
              spending: "0.00",
              scaledLimit: "500.00",
              sourceBudgetType: "MONTHLY",
            },
          ],
        },
      },
    });
    mockUseCategories.mockReturnValue({
      data: [
        { id: "hobby", categoryName: "Hobby" },
        { id: "groceries", categoryName: "Groceries" },
        { id: "ent", categoryName: "Entertainment" },
      ],
      isLoading: false,
      isSuccess: true,
      error: null,
    });

    renderWidget();

    // All three budgeted categories appear, not just the one with spending.
    expect(screen.getByText("Hobby")).toBeInTheDocument();
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("Entertainment")).toBeInTheDocument();
    // One bar per category (daily/yearly have no budgets → "No budgets for this period.").
    expect(screen.getAllByRole("progressbar")).toHaveLength(3);
    expect(screen.getByText("68%")).toBeInTheDocument();
    expect(screen.getAllByText("0%")).toHaveLength(2);
    expect(screen.getAllByText("No budgets for this period.")).toHaveLength(2);
  });

  it("flags an over-budget category with the over-budget label", () => {
    setPeriods({
      MONTHLY: {
        isLoading: false,
        error: null,
        data: {
          budgets: [],
          categorySpending: [
            {
              categoryId: "hobby",
              spending: "150.00",
              scaledLimit: "100.00",
              sourceBudgetType: "MONTHLY",
            },
          ],
        },
      },
    });
    mockUseCategories.mockReturnValue({
      data: [{ id: "hobby", categoryName: "Hobby" }],
      isLoading: false,
      isSuccess: true,
      error: null,
    });

    renderWidget();

    expect(screen.getByText("150%")).toBeInTheDocument();
    expect(screen.getByText(/over budget/)).toBeInTheDocument();
  });

  it("exposes an accessible progressbar label per category", () => {
    setPeriods({
      MONTHLY: {
        isLoading: false,
        error: null,
        data: {
          budgets: [],
          categorySpending: [
            {
              categoryId: "hobby",
              spending: "80.00",
              scaledLimit: "200.00",
              sourceBudgetType: "MONTHLY",
            },
          ],
        },
      },
    });
    mockUseCategories.mockReturnValue({
      data: [{ id: "hobby", categoryName: "Hobby" }],
      isLoading: false,
      isSuccess: true,
      error: null,
    });

    renderWidget();

    const bar = screen.getByRole("progressbar", { name: /Hobby: 40% of budget used/ });
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(within(bar.parentElement as HTMLElement).getByText("Hobby")).toBeInTheDocument();
  });
});
