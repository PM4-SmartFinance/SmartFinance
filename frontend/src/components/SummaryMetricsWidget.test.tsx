import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { SummaryMetricsWidget } from "./SummaryMetricsWidget";

const mockSummaryData = {
  accountBalance: 15250.75,
  monthlyExpenses: 2840.5,
  incomeThisMonth: 6500.0,
};

vi.mock("../lib/api", () => ({
  api: {
    get: vi.fn((path) => {
      if (path.includes("/dashboard/summary")) {
        return Promise.resolve(mockSummaryData);
      }
      return Promise.resolve({});
    }),
  },
}));

function renderWithQuery(component: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
}

describe("SummaryMetricsWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all three metric cards", () => {
    renderWithQuery(<SummaryMetricsWidget />);
    expect(screen.getByText("Account Balance")).toBeInTheDocument();
    expect(screen.getByText("Monthly Expenses")).toBeInTheDocument();
    expect(screen.getByText("Income This Month")).toBeInTheDocument();
  });

  it("shows loading indicators before data arrives", () => {
    renderWithQuery(<SummaryMetricsWidget />);

    const loadingMessages = screen.getAllByText("Loading\u2026");
    expect(loadingMessages.length).toBe(3);
  });

  it("displays formatted currency values after loading", async () => {
    renderWithQuery(<SummaryMetricsWidget />);

    await waitFor(() => {
      expect(screen.getByText("CHF 15'250.75")).toBeInTheDocument();
      expect(screen.getByText("CHF 2'840.50")).toBeInTheDocument();
      expect(screen.getByText("CHF 6'500.00")).toBeInTheDocument();
    });
  });

  it("displays error state when data fetch fails", async () => {
    const apiMock = await vi.importMock("../lib/api");
    apiMock.api.get.mockRejectedValueOnce(new Error("Failed to fetch"));

    renderWithQuery(<SummaryMetricsWidget />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load summary data. Please try again."),
      ).toBeInTheDocument();
    });
  });
});
