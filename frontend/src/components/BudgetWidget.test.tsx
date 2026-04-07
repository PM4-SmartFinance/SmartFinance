import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { BrowserRouter } from "react-router";
import { BudgetWidget } from "./BudgetWidget";
import { Budget } from "../lib/queries/dashboard";

const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear = now.getFullYear();

const mockBudgets: Budget[] = [
  {
    id: "budget-1",
    categoryId: "cat-1",
    month: currentMonth,
    year: currentYear,
    limitAmount: "500.00",
    currentSpending: "250.00",
    percentageUsed: 50,
    remainingAmount: "250.00",
    isOverBudget: false,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "budget-2",
    categoryId: "cat-2",
    month: currentMonth,
    year: currentYear,
    limitAmount: "300.00",
    currentSpending: "210.00",
    percentageUsed: 70,
    remainingAmount: "90.00",
    isOverBudget: false,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "budget-3",
    categoryId: "cat-3",
    month: currentMonth,
    year: currentYear,
    limitAmount: "200.00",
    currentSpending: "220.00",
    percentageUsed: 110,
    remainingAmount: "-20.00",
    isOverBudget: true,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

vi.mock("../lib/api", () => ({
  api: {
    get: vi.fn((path) => {
      if (path.includes("/budgets")) {
        return Promise.resolve({ budgets: mockBudgets });
      }
      return Promise.resolve({});
    }),
  },
}));

function renderWithRouter(component: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
    </BrowserRouter>,
  );
}

describe("BudgetWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders budget status title", () => {
    renderWithRouter(<BudgetWidget />);
    expect(screen.getByText("Budget Status")).toBeInTheDocument();
  });

  it("shows loading indicators before data arrives", () => {
    renderWithRouter(<BudgetWidget />);
    const animatePulse = document.querySelectorAll(".animate-pulse");
    expect(animatePulse.length).toBeGreaterThan(0);
  });

  it("displays budget status summary after loading", async () => {
    renderWithRouter(<BudgetWidget />);

    await waitFor(() => {
      // 1 on track (50%), 1 approaching (70%), 1 exceeded (110%)
      expect(screen.getByText(/1 on track, 1 approaching limit, 1 exceeded/)).toBeInTheDocument();
    });
  });

  it("displays current month and budget count", async () => {
    renderWithRouter(<BudgetWidget />);

    await waitFor(() => {
      expect(
        screen.getByText(new RegExp(`3 active budgets for ${currentMonth}/${currentYear}`)),
      ).toBeInTheDocument();
    });
  });

  it("shows empty state when no budgets exist for current month", async () => {
    const apiMock = await vi.importMock("../lib/api");
    apiMock.api.get.mockResolvedValueOnce({ budgets: [] });

    renderWithRouter(<BudgetWidget />);

    await waitFor(() => {
      expect(
        screen.getByText(
          new RegExp(`No budgets set for ${currentMonth}/${currentYear}. Click to create one.`),
        ),
      ).toBeInTheDocument();
    });
  });

  it("displays error state when data fetch fails", async () => {
    const apiMock = await vi.importMock("../lib/api");
    apiMock.api.get.mockRejectedValueOnce(new Error("Failed to fetch"));

    renderWithRouter(<BudgetWidget />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load budget data. Please try again.")).toBeInTheDocument();
    });
  });

  it("renders as a clickable link to /budgets", () => {
    renderWithRouter(<BudgetWidget />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/budgets");
  });

  it("correctly categorizes budgets by status", async () => {
    renderWithRouter(<BudgetWidget />);

    await waitFor(() => {
      // Verify exact counts: budget-1 (50%) = on-track, budget-2 (70%) = approaching,
      // budget-3 (110%) = exceeded
      const statusText = screen.getByText(/1 on track, 1 approaching limit, 1 exceeded/);
      expect(statusText).toBeInTheDocument();
    });
  });
});
