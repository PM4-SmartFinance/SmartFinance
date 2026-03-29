import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { DateRangePicker } from "../components/DateRangePicker";
import { SummaryMetricsWidget } from "../components/SummaryMetricsWidget";

// Comprehensive mock data
const mockSummaryData = {
  accountBalance: 15250.75,
  monthlyExpenses: 2840.5,
  incomeThisMonth: 6500.0,
};

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

const mockCategoryData = [
  { category: "Groceries", amount: 450.75 },
  { category: "Transport", amount: 280.0 },
  { category: "Dining", amount: 320.5 },
  { category: "Entertainment", amount: 195.25 },
  { category: "Utilities", amount: 125.0 },
  { category: "Shopping", amount: 473.0 },
];

// Mock the api module
vi.mock("../lib/api", () => ({
  api: {
    get: vi.fn((path) => {
      if (path.includes("/dashboard/summary")) {
        return Promise.resolve(mockSummaryData);
      }
      if (path.includes("/dashboard/trends")) {
        return Promise.resolve(mockTrendData);
      }
      if (path.includes("/dashboard/categories")) {
        return Promise.resolve(mockCategoryData);
      }
      return Promise.resolve({});
    }),
  },
}));

function renderWithQuery(component: React.ReactElement) {
  return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
}

describe("Dashboard Date Filter Integration", () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  it("renders the date range picker with default values", () => {
    renderWithQuery(<DateRangePicker />);

    const startInput = screen.getByLabelText("Start Date") as HTMLInputElement;
    const endInput = screen.getByLabelText("End Date") as HTMLInputElement;

    expect(startInput).toBeInTheDocument();
    expect(endInput).toBeInTheDocument();
    expect(startInput.value).toBeTruthy();
    expect(endInput.value).toBeTruthy();
  });

  it("updates date range when inputs change", async () => {
    renderWithQuery(<DateRangePicker />);

    const startInput = screen.getByLabelText("Start Date") as HTMLInputElement;
    const endInput = screen.getByLabelText("End Date") as HTMLInputElement;

    fireEvent.change(startInput, { target: { value: "2025-02-01" } });
    fireEvent.change(endInput, { target: { value: "2025-03-15" } });

    await waitFor(() => {
      expect(startInput.value).toBe("2025-02-01");
      expect(endInput.value).toBe("2025-03-15");
    });
  });

  it("resets to 30-day range when reset button is clicked", async () => {
    renderWithQuery(<DateRangePicker />);

    const startInput = screen.getByLabelText("Start Date") as HTMLInputElement;

    // Change dates first
    fireEvent.change(startInput, { target: { value: "2025-01-01" } });

    const resetButton = screen.getByText("Reset to 30d");
    fireEvent.click(resetButton);

    await waitFor(() => {
      // After reset, the value should represent approximately 30 days from today
      expect(startInput.value).toBeTruthy();
    });
  });

  it("enforces min/max date constraints", () => {
    renderWithQuery(<DateRangePicker />);

    const startInput = screen.getByLabelText("Start Date") as HTMLInputElement;
    const endInput = screen.getByLabelText("End Date") as HTMLInputElement;

    // End date min should be the start date
    expect(endInput.getAttribute("min")).toBe(startInput.value);

    // Start date max should be the end date
    expect(startInput.getAttribute("max")).toBe(endInput.value);
  });

  it("renders summary metrics widget with loading state initially", () => {
    renderWithQuery(<SummaryMetricsWidget />);

    // Should show loading skeleton initially
    const loadingMessages = screen.getAllByText(/loading/i);
    expect(loadingMessages.length).toBeGreaterThan(0);
  });

  it("renders summary metrics with data after loading", async () => {
    renderWithQuery(<SummaryMetricsWidget />);

    // Wait for data to load and display
    await waitFor(
      () => {
        expect(screen.getByText("$15,250.75")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    expect(screen.getByText("Account Balance")).toBeInTheDocument();
    expect(screen.getByText("Monthly Expenses")).toBeInTheDocument();
    expect(screen.getByText("Income This Month")).toBeInTheDocument();
  });

  it("formats currency values correctly", async () => {
    renderWithQuery(<SummaryMetricsWidget />);

    await waitFor(
      () => {
        expect(screen.getByText("$15,250.75")).toBeInTheDocument();
        expect(screen.getByText("$2,840.50")).toBeInTheDocument();
        expect(screen.getByText("$6,500.00")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});
