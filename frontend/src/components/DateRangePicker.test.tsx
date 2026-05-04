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
});
