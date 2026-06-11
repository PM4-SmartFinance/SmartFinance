import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetProgressWidget } from "./BudgetProgressWidget";

const { mockUseBudgets } = vi.hoisted(() => ({
  mockUseBudgets: vi.fn(),
}));

vi.mock("../lib/queries/budgets", () => ({
  useBudgets: mockUseBudgets,
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
  });

  it("shows loading state when any period is loading", () => {
    setPeriods({
      DAILY: { isLoading: true, error: null, data: undefined },
    });
    renderWidget();
    expect(screen.getByText("Loading budget progress…")).toBeInTheDocument();
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
    renderWidget();
    expect(
      screen.getByText(
        "Some budget values could not be parsed and were excluded from the totals below.",
      ),
    ).toBeInTheDocument();
  });

  it("renders daily, monthly and yearly donuts with spent/remaining legend and tracked totals", () => {
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

    renderWidget();

    expect(screen.getByText("Budget Progress")).toBeInTheDocument();
    expect(screen.getByText("Daily")).toBeInTheDocument();
    expect(screen.getByText("Monthly")).toBeInTheDocument();
    expect(screen.getByText("Yearly")).toBeInTheDocument();
    // Single-ring legend: every period lists Spent and Remaining, plus a tracked total.
    expect(screen.getAllByText("Spent").length).toBe(3);
    expect(screen.getAllByText("Remaining").length).toBe(3);
    expect(screen.getAllByText("Tracked total").length).toBe(3);
    // Only the daily period is over budget.
    expect(screen.getByText("Over")).toBeInTheDocument();
  });

  it("renders the over-budget amount with a negative sign and currency formatting", () => {
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

    renderWidget();

    const overValue = screen.getByText("Over").closest("li")?.lastElementChild;
    expect(overValue?.textContent).toMatch(/^-/);
    expect(overValue?.textContent).toContain("50");
  });

  it("exposes an accessible label on each donut describing spent of the tracked total", () => {
    setPeriods({
      MONTHLY: {
        isLoading: false,
        error: null,
        data: {
          budgets: [],
          categorySpending: [
            {
              categoryId: "cat-1",
              spending: "80.00",
              scaledLimit: "200.00",
              sourceBudgetType: "MONTHLY",
            },
          ],
        },
      },
    });

    renderWidget();

    const donut = screen.getByRole("img", { name: /Monthly budget: spent/ });
    const label = donut.getAttribute("aria-label") ?? "";
    expect(label).toContain("80");
    expect(label).toContain("200");
  });
});
