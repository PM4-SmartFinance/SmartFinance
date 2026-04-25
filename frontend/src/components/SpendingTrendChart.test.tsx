import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { SpendingTrendChart, formatMonthLabel, formatYAxisValue } from "./SpendingTrendChart";

// Allow the LineChart and its children to render in jsdom without a real layout engine.
vi.mock("recharts", async () => {
  const Recharts = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...Recharts,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 400 }}>{children}</div>
    ),
  };
});

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

// ── formatMonthLabel ──────────────────────────────────────────────────────────

describe("formatMonthLabel", () => {
  it("formats a mid-year date as short month + full year", () => {
    expect(formatMonthLabel("2026-06-15")).toBe("Jun 2026");
  });

  it("formats a year-boundary date (Dec → Jan) correctly", () => {
    expect(formatMonthLabel("2025-12-01")).toBe("Dec 2025");
    expect(formatMonthLabel("2026-01-01")).toBe("Jan 2026");
  });

  it("uses UTC so dates near midnight do not shift to a different month", () => {
    // Without the T00:00:00Z suffix, new Date("2026-03-01") in some environments
    // would be interpreted as local midnight, potentially shifting to Feb 28.
    expect(formatMonthLabel("2026-03-01")).toBe("Mar 2026");
  });

  it("handles a leap year date correctly", () => {
    expect(formatMonthLabel("2024-02-29")).toBe("Feb 2024");
  });

  it("returns 'Invalid Date' for an empty string", () => {
    expect(formatMonthLabel("")).toBe("Invalid Date");
  });
});

// ── formatYAxisValue ──────────────────────────────────────────────────────────

describe("formatYAxisValue", () => {
  it("formats values below 1000 as CHF + rounded integer", () => {
    expect(formatYAxisValue(0)).toBe("CHF 0");
    expect(formatYAxisValue(500)).toBe("CHF 500");
    expect(formatYAxisValue(999)).toBe("CHF 999");
  });

  it("formats values at exactly 1000 using the compact k suffix", () => {
    expect(formatYAxisValue(1000)).toBe("CHF 1.0k");
  });

  it("formats values above 1000 with one decimal place", () => {
    expect(formatYAxisValue(1500)).toBe("CHF 1.5k");
    expect(formatYAxisValue(2800)).toBe("CHF 2.8k");
    expect(formatYAxisValue(12345)).toBe("CHF 12.3k");
  });

  it("rounds sub-1000 decimal values to nearest integer", () => {
    expect(formatYAxisValue(123.4)).toBe("CHF 123");
    expect(formatYAxisValue(123.6)).toBe("CHF 124");
  });
});

// ── SpendingTrendChart component ──────────────────────────────────────────────

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
    expect(screen.queryByText(/Showing spending trend/)).not.toBeInTheDocument();
  });

  it("displays error state when data fetch fails", async () => {
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

  it("renders the Recharts chart container when data is available", async () => {
    renderWithQuery(<SpendingTrendChart />);

    await waitFor(() => {
      expect(document.querySelector(".recharts-wrapper")).toBeInTheDocument();
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
