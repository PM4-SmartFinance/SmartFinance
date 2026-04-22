import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { SpendingTrendChart } from "./SpendingTrendChart";

const mockTrendData = {
  data: [
    { year: 2025, month: 12, income: 5000, expenses: 2150.25 },
    { year: 2026, month: 1, income: 6000, expenses: 2500.75 },
    { year: 2026, month: 2, income: 5500, expenses: 2800.0 },
  ],
};

vi.mock("../lib/api", () => ({
  api: {
    get: vi.fn((path) => {
      if (path.includes("/dashboard/trends")) {
        return Promise.resolve(mockTrendData);
      }
      return Promise.resolve({});
    }),
  },
}));

function renderWithQuery(component: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("SpendingTrendChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the chart heading", () => {
    renderWithQuery(<SpendingTrendChart />);
    expect(screen.getByText("Monthly Spending Trend")).toBeInTheDocument();
  });

  it("renders the heading while data is loading", async () => {
    renderWithQuery(<SpendingTrendChart />);

    await waitFor(
      () => {
        const heading = screen.getByText("Monthly Spending Trend");
        expect(heading).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("shows loading indicator before data arrives", () => {
    renderWithQuery(<SpendingTrendChart />);

    expect(screen.getByText("Loading chart…")).toBeInTheDocument();
  });

  it("displays error state when data fetch fails", async () => {
    // Mock API to return error
    const apiMock = await vi.importMock("../lib/api");
    apiMock.api.get.mockRejectedValueOnce(new Error("Failed to fetch"));

    renderWithQuery(<SpendingTrendChart />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load spending trend data. Please try again."),
      ).toBeInTheDocument();
    });
  });

  it("shows empty state when no data is available", async () => {
    const apiMock = await vi.importMock("../lib/api");
    apiMock.api.get.mockResolvedValueOnce({ data: [] });

    renderWithQuery(<SpendingTrendChart />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "No spending data available for the selected period. Import transactions to see your trends.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows single month indicator when only one month has data", async () => {
    const apiMock = await vi.importMock("../lib/api");
    apiMock.api.get.mockResolvedValueOnce({
      data: [{ year: 2026, month: 1, income: 5000, expenses: 2500.0 }],
    });

    renderWithQuery(<SpendingTrendChart />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Showing data for 1 month. Add more transactions to see trends over time.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows multi-month indicator when multiple months have data", async () => {
    renderWithQuery(<SpendingTrendChart />);

    await waitFor(() => {
      expect(screen.getByText(/Showing spending trend for 3 months/)).toBeInTheDocument();
    });
  });
});
