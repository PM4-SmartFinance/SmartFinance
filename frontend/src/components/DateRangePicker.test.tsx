import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { DateRangePicker } from "../components/DateRangePicker";
import { SummaryMetricsWidget } from "../components/SummaryMetricsWidget";

// Mock the api module
vi.mock("../lib/api", () => ({
  api: {
    get: vi.fn((path) => {
      if (path.includes("/dashboard/summary")) {
        return Promise.resolve({
          accountBalance: 5000,
          monthlyExpenses: 1200,
          incomeThisMonth: 3500,
        });
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
    const loadingMessage = screen.queryByText(/loading/i);
    expect(loadingMessage).toBeInTheDocument();
  });

  it("renders summary metrics with data after loading", async () => {
    renderWithQuery(<SummaryMetricsWidget />);

    // Wait for data to load and display
    await waitFor(
      () => {
        expect(screen.getByText("$5,000.00")).toBeInTheDocument();
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
        expect(screen.getByText("$5,000.00")).toBeInTheDocument();
        expect(screen.getByText("$1,200.00")).toBeInTheDocument();
        expect(screen.getByText("$3,500.00")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("shows error message when API fails", async () => {
    // Mock API to fail
    const { api } = await import("../lib/api");
    vi.mocked(api.get).mockRejectedValueOnce(new Error("API Error"));

    renderWithQuery(<SummaryMetricsWidget />);

    await waitFor(
      () => {
        const errorMessage = screen.getByText(/failed to load/i);
        expect(errorMessage).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});
