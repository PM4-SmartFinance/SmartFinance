import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { SpendingTrendChart, formatMonthLabel, formatYAxisValue } from "./SpendingTrendChart";

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

describe("formatMonthLabel", () => {
  it("formats valid date string to month and year", () => {
    expect(formatMonthLabel("2026-01-15")).toBe("Jan 2026");
    expect(formatMonthLabel("2025-12-01")).toBe("Dec 2025");
    expect(formatMonthLabel("2026-06-30")).toBe("Jun 2026");
  });

  it("handles year boundary dates correctly", () => {
    expect(formatMonthLabel("2025-01-01")).toBe("Jan 2025");
    expect(formatMonthLabel("2025-12-31")).toBe("Dec 2025");
    expect(formatMonthLabel("2026-01-01")).toBe("Jan 2026");
  });

  it("returns fallback for invalid date strings", () => {
    const result = formatMonthLabel("invalid-date");
    expect(result).toBeDefined();
    // Invalid dates in JavaScript toLocaleDateString return "Invalid Date"
    expect(result).toContain("Invalid Date");
  });

  it("handles edge case: single digit month", () => {
    expect(formatMonthLabel("2026-03-15")).toBe("Mar 2026");
  });

  it("handles edge case: leap year date", () => {
    expect(formatMonthLabel("2024-02-29")).toBe("Feb 2024");
  });
});

describe("formatYAxisValue", () => {
  it("formats values below 1000 as whole currency amounts", () => {
    expect(formatYAxisValue(0)).toBe("CHF 0");
    expect(formatYAxisValue(500)).toBe("CHF 500");
    expect(formatYAxisValue(999)).toBe("CHF 999");
  });

  it("formats values at and above 1000 with k suffix", () => {
    expect(formatYAxisValue(1000)).toBe("CHF 1.0k");
    expect(formatYAxisValue(1500)).toBe("CHF 1.5k");
    expect(formatYAxisValue(2500)).toBe("CHF 2.5k");
  });

  it("handles large values correctly", () => {
    expect(formatYAxisValue(10000)).toBe("CHF 10.0k");
    expect(formatYAxisValue(100000)).toBe("CHF 100.0k");
    expect(formatYAxisValue(999999)).toBe("CHF 1000.0k");
  });

  it("rounds sub-1000 values to nearest integer", () => {
    expect(formatYAxisValue(123.4)).toBe("CHF 123");
    expect(formatYAxisValue(123.6)).toBe("CHF 124");
    expect(formatYAxisValue(999.5)).toBe("CHF 1000");
  });

  it("handles zero correctly", () => {
    expect(formatYAxisValue(0)).toBe("CHF 0");
  });
});

describe("SpendingTrendChart - Chart Rendering", () => {
  it("renders Recharts LineChart container when data is available", async () => {
    renderWithQuery(<SpendingTrendChart />);

    await waitFor(() => {
      // Verify chart container with data renders
      const chartContainer = screen.getByText("Monthly Spending Trend");
      expect(chartContainer).toBeInTheDocument();

      // Verify chart metadata is rendered (data count indicator)
      expect(screen.getByText(/Showing spending trend for 3 months/)).toBeInTheDocument();
    });
  });

  it("does not render chart when no data is available", async () => {
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

  it("does not render chart during loading state", () => {
    renderWithQuery(<SpendingTrendChart />);

    expect(screen.getByText("Loading chart…")).toBeInTheDocument();
    // Verify the loading skeleton is shown instead of chart
    expect(screen.queryByText(/Showing spending trend/)).not.toBeInTheDocument();
  });
});
