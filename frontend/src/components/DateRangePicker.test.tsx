import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { DateRangePicker } from "../components/DateRangePicker";
import { useAppStore } from "../store/appStore";

vi.mock("../lib/queries/accounts", () => ({
  useAccounts: () => ({
    data: [
      { id: "acc-1", name: "Main", iban: "CH00 0001", accountNumber: null, active: true },
      { id: "acc-2", name: "Old Savings", iban: "CH00 0002", accountNumber: null, active: false },
    ],
    error: null,
  }),
}));

function renderWithQuery(component: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
}

describe("Dashboard Date Filter Integration", () => {
  beforeEach(() => {
    useAppStore.setState({
      startDate: "2026-04-04",
      endDate: "2026-05-04",
      activePresetKey: "30d",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("marks the active preset with aria-pressed=true and others false", async () => {
    renderWithQuery(<DateRangePicker />);

    expect(screen.getByRole("button", { name: "Last 30 days" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Last 7 days" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Last 7 days" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByRole("button", { name: "Last 30 days" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });
  });

  it("preset click writes correct dates and key to the store", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 4));
    renderWithQuery(<DateRangePicker />);

    fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));
    let state = useAppStore.getState();
    expect(state.startDate).toBe("2026-04-27");
    expect(state.endDate).toBe("2026-05-04");
    expect(state.activePresetKey).toBe("7d");

    fireEvent.click(screen.getByRole("button", { name: "Last 3 months" }));
    state = useAppStore.getState();
    expect(state.startDate).toBe("2026-02-04");
    expect(state.endDate).toBe("2026-05-04");
    expect(state.activePresetKey).toBe("3m");

    fireEvent.click(screen.getByRole("button", { name: "Last year" }));
    state = useAppStore.getState();
    expect(state.startDate).toBe("2025-05-04");
    expect(state.endDate).toBe("2026-05-04");
    expect(state.activePresetKey).toBe("1y");
  });

  it("3-month preset clamps day-of-month when source month is shorter", () => {
    // From May 31 2026, 3 months back would naively land on Mar 3; expect Feb 28 floor.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 31));
    renderWithQuery(<DateRangePicker />);

    fireEvent.click(screen.getByRole("button", { name: "Last 3 months" }));
    const state = useAppStore.getState();
    expect(state.startDate).toBe("2026-02-28");
    expect(state.endDate).toBe("2026-05-31");
    expect(state.activePresetKey).toBe("3m");
  });

  it("updates date range and store state when inputs change in custom mode", async () => {
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
    const state = useAppStore.getState();
    expect(state.startDate).toBe("2025-02-01");
    expect(state.endDate).toBe("2025-03-15");
    expect(state.activePresetKey).toBe("custom");
  });

  it("ignores empty-string input changes and keeps prior store state", () => {
    renderWithQuery(<DateRangePicker />);

    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    const startInput = screen.getByLabelText("Start Date") as HTMLInputElement;
    const endInput = screen.getByLabelText("End Date") as HTMLInputElement;

    const before = useAppStore.getState();
    fireEvent.change(startInput, { target: { value: "" } });
    fireEvent.change(endInput, { target: { value: "" } });

    const after = useAppStore.getState();
    expect(after.startDate).toBe(before.startDate);
    expect(after.endDate).toBe(before.endDate);
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

  it("offers only active accounts in the account filter and updates the store", () => {
    renderWithQuery(<DateRangePicker />);

    const select = screen.getByLabelText("Filter by Account") as HTMLSelectElement;
    // "All Accounts" + the single active account; the inactive one is excluded.
    expect(screen.getByRole("option", { name: "All Accounts" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Main" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Old Savings" })).not.toBeInTheDocument();

    fireEvent.change(select, { target: { value: "acc-1" } });
    expect(useAppStore.getState().accountId).toBe("acc-1");

    fireEvent.change(select, { target: { value: "" } });
    expect(useAppStore.getState().accountId).toBeNull();
  });
});
