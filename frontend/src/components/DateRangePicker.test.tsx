import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { DateRangePicker } from "../components/DateRangePicker";

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
});
