import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { DateRangePicker } from "../components/DateRangePicker";
import { SummaryMetricsWidget } from "../components/SummaryMetricsWidget";

// Comprehensive mock data
const mockSummaryData = {
  totalIncome: 6500.0,
  totalExpenses: -2840.5,
  netBalance: 3659.5,
  transactionCount: 42,
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
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
}

describe("Dashboard Date Filter Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the date range picker with preset buttons", () => {
    renderWithQuery(<DateRangePicker />);

    expect(screen.getByRole("button", { name: "Last 7 days" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Last 30 days" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Last 3 months" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Last year" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();

    // Date inputs are hidden until Custom is selected
    expect(screen.queryByLabelText("Start Date")).not.toBeInTheDocument();
  });

  it("updates date range when inputs change in custom mode", async () => {
    renderWithQuery(<DateRangePicker />);

    fireEvent.click(screen.getByRole("button", { name: "Custom" }));

    const startInput = screen.getByLabelText("Start Date") as HTMLInputElement;
    const endInput = screen.getByLabelText("End Date") as HTMLInputElement;

    fireEvent.change(startInput, { target: { value: "2025-02-01" } });
    fireEvent.change(endInput, { target: { value: "2025-03-15" } });

    await waitFor(() => {
      expect(startInput.value).toBe("2025-02-01");
      expect(endInput.value).toBe("2025-03-15");
    });
  });

  it("hides date inputs and resets range when a preset is clicked", async () => {
    renderWithQuery(<DateRangePicker />);

    // Enter custom mode
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    expect(screen.getByLabelText("Start Date")).toBeInTheDocument();

    // Click a preset — inputs should disappear
    fireEvent.click(screen.getByRole("button", { name: "Last 30 days" }));

    await waitFor(() => {
      expect(screen.queryByLabelText("Start Date")).not.toBeInTheDocument();
    });
  });

  it("enforces min/max date constraints in custom mode", () => {
    renderWithQuery(<DateRangePicker />);

    fireEvent.click(screen.getByRole("button", { name: "Custom" }));

    const startInput = screen.getByLabelText("Start Date") as HTMLInputElement;
    const endInput = screen.getByLabelText("End Date") as HTMLInputElement;

    expect(endInput.getAttribute("min")).toBe(startInput.value);
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
        expect(screen.getByText("CHF 3'659.50")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    expect(screen.getByText("Net Balance")).toBeInTheDocument();
    expect(screen.getByText("Total Expenses")).toBeInTheDocument();
    expect(screen.getByText("Total Income")).toBeInTheDocument();
  });

  it("formats currency values correctly", async () => {
    renderWithQuery(<SummaryMetricsWidget />);

    await waitFor(
      () => {
        expect(screen.getByText("CHF 3'659.50")).toBeInTheDocument();
        expect(screen.getByText("CHF 2'840.50")).toBeInTheDocument();
        expect(screen.getByText("CHF 6'500.00")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});
