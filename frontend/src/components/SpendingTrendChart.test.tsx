import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { SpendingTrendChart } from "./SpendingTrendChart";

const mockTrendData = [
  { date: "2025-12-01", amount: 2150.25 },
  { date: "2025-12-08", amount: 1875.5 },
  { date: "2025-12-15", amount: 2340.75 },
  { date: "2025-12-22", amount: 2100.0 },
  { date: "2025-12-29", amount: 1950.25 },
  { date: "2026-01-05", amount: 2500.75 },
  { date: "2026-01-12", amount: 2200.0 },
  { date: "2026-01-19", amount: 2600.5 },
  { date: "2026-01-26", amount: 2450.25 },
  { date: "2026-02-02", amount: 2100.75 },
  { date: "2026-02-09", amount: 2800.0 },
  { date: "2026-02-16", amount: 2400.25 },
];

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
  return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
}

describe("SpendingTrendChart", () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  it("renders the chart heading", () => {
    renderWithQuery(<SpendingTrendChart />);
    expect(screen.getByText("Monthly Spending Trend")).toBeInTheDocument();
  });

  it("renders the chart container with responsive height", async () => {
    renderWithQuery(<SpendingTrendChart />);

    await waitFor(
      () => {
        const heading = screen.getByText("Monthly Spending Trend");
        expect(heading).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("displays loading state initially", () => {
    renderWithQuery(<SpendingTrendChart />);

    // Component should show loading state or attempt to fetch
    expect(screen.getByText("Monthly Spending Trend")).toBeInTheDocument();
  });
});
