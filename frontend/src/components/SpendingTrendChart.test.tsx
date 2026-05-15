import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

import {
  SpendingTrendChart,
  formatMonthLabel,
  formatDateLabel,
  daysBetween,
  formatYAxisValue,
  buildChartAriaLabel,
  computeTickInterval,
  pickGranularity,
  bucketize,
  LABEL_COUNT_OPTIONS,
} from "./SpendingTrendChart";
import { useAppStore } from "../store/appStore";

// Allow LineChart and its children to render in jsdom without a real layout engine.
vi.mock("recharts", async () => {
  const Recharts = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...Recharts,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 400 }}>{children}</div>
    ),
  };
});

// Pin the appStore date range to a deterministic 3-day window aligned with the mock data.
beforeEach(() => {
  useAppStore.setState({ startDate: "2026-01-01", endDate: "2026-01-03" });
});

const mockTrendData = {
  data: [
    { date: "2026-01-01", income: 100, expenses: 50 },
    { date: "2026-01-02", income: 200, expenses: 80 },
    { date: "2026-01-03", income: 150, expenses: 60 },
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
    expect(formatMonthLabel("2026-03-01")).toBe("Mar 2026");
  });

  it("handles a leap year date correctly", () => {
    expect(formatMonthLabel("2024-02-29")).toBe("Feb 2024");
  });

  it("returns empty string for an empty input", () => {
    expect(formatMonthLabel("")).toBe("");
  });

  it("returns empty string for an unparseable date input", () => {
    expect(formatMonthLabel("not-a-date")).toBe("");
  });
});

// ── formatDateLabel ───────────────────────────────────────────────────────────

describe("formatDateLabel", () => {
  it("formats a date with day, short month, year", () => {
    const out = formatDateLabel("2026-01-15");
    expect(out).toContain("15");
    expect(out).toContain("Jan");
    expect(out).toContain("2026");
  });

  it("returns empty string for empty or unparseable input", () => {
    expect(formatDateLabel("")).toBe("");
    expect(formatDateLabel("not-a-date")).toBe("");
  });
});

// ── daysBetween ───────────────────────────────────────────────────────────────

describe("daysBetween", () => {
  it("returns the day span (inclusive of endpoints) for valid dates", () => {
    expect(daysBetween("2026-01-01", "2026-01-31")).toBe(30);
    expect(daysBetween("2025-12-01", "2026-02-28")).toBe(89);
  });

  it("returns 0 when end is before start", () => {
    expect(daysBetween("2026-06-01", "2026-01-01")).toBe(0);
  });

  it("returns 0 for unparseable input", () => {
    expect(daysBetween("not-a-date", "2026-01-01")).toBe(0);
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

  it("returns empty string for non-finite values (NaN, Infinity)", () => {
    expect(formatYAxisValue(NaN)).toBe("");
    expect(formatYAxisValue(Infinity)).toBe("");
    expect(formatYAxisValue(-Infinity)).toBe("");
  });

  it("formats negative values with leading minus sign", () => {
    expect(formatYAxisValue(-500)).toBe("-CHF 500");
    expect(formatYAxisValue(-1500)).toBe("-CHF 1.5k");
    expect(formatYAxisValue(-12345)).toBe("-CHF 12.3k");
  });
});

// ── buildChartAriaLabel ───────────────────────────────────────────────────────

describe("buildChartAriaLabel", () => {
  it("describes empty data", () => {
    expect(buildChartAriaLabel([])).toBe("Income and expenses chart, no data.");
  });

  it("summarizes each data point with both series", () => {
    const label = buildChartAriaLabel([
      { date: "2026-01-01", income: 5000, expenses: 2500 },
      { date: "2026-02-01", income: 6000, expenses: 3000 },
    ]);
    expect(label).toContain("Jan 2026");
    expect(label).toContain("Feb 2026");
    expect(label).toContain("income");
    expect(label).toContain("expenses");
  });

  it("caps the description with a head + tail summary for long ranges", () => {
    // 30 daily points → exceeds the 12-bucket cap.
    const longRange = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      income: i,
      expenses: i,
    }));
    const label = buildChartAriaLabel(longRange);
    expect(label).toContain("30 periods");
    expect(label).toContain("periods omitted");
    // Head and tail should be present.
    expect(label).toMatch(/2026-01-01|Jan 2026/);
    expect(label).toMatch(/2026-01-30|Jan 2026/);
  });
});

// ── pickGranularity ───────────────────────────────────────────────────────────

describe("pickGranularity", () => {
  it("picks day for ranges ≤ 90 days", () => {
    expect(pickGranularity(1)).toBe("day");
    expect(pickGranularity(90)).toBe("day");
  });

  it("picks week for ranges 91 days to 2 years", () => {
    expect(pickGranularity(91)).toBe("week");
    expect(pickGranularity(365 * 2)).toBe("week");
  });

  it("picks month for ranges 2 to 6 years", () => {
    expect(pickGranularity(365 * 2 + 1)).toBe("month");
    expect(pickGranularity(365 * 6)).toBe("month");
  });

  it("picks quarter for ranges 6 to 20 years", () => {
    expect(pickGranularity(365 * 6 + 1)).toBe("quarter");
    expect(pickGranularity(365 * 20)).toBe("quarter"); // exact upper boundary
  });

  it("picks year for ranges over 20 years", () => {
    expect(pickGranularity(365 * 20 + 1)).toBe("year"); // exact upper-bound + 1
    expect(pickGranularity(365 * 25)).toBe("year");
  });
});

// ── bucketize ─────────────────────────────────────────────────────────────────

describe("bucketize", () => {
  const sampleDays = [
    { date: "2026-01-05", income: 100, expenses: 50 }, // Mon
    { date: "2026-01-06", income: 100, expenses: 50 }, // Tue
    { date: "2026-01-07", income: 100, expenses: 50 }, // Wed
    { date: "2026-02-15", income: 200, expenses: 80 }, // Sun
    { date: "2026-02-16", income: 200, expenses: 80 }, // Mon
  ];

  it("returns the same array for day granularity", () => {
    expect(bucketize(sampleDays, "day")).toEqual(sampleDays);
  });

  it("groups days into ISO weeks (week starts Monday)", () => {
    const result = bucketize(sampleDays, "week");
    // Mon Jan 5 starts a week containing Jan 5-7
    // Sun Feb 15 belongs to week starting Mon Feb 9
    // Mon Feb 16 starts a new week
    expect(result.map((p) => p.date)).toEqual(["2026-01-05", "2026-02-09", "2026-02-16"]);
    expect(result[0]).toMatchObject({ income: 300, expenses: 150 });
    expect(result[1]).toMatchObject({ income: 200, expenses: 80 });
    expect(result[2]).toMatchObject({ income: 200, expenses: 80 });
  });

  it("groups days into months", () => {
    const result = bucketize(sampleDays, "month");
    expect(result).toEqual([
      { date: "2026-01-01", income: 300, expenses: 150 },
      { date: "2026-02-01", income: 400, expenses: 160 },
    ]);
  });

  it("groups days into quarters", () => {
    const result = bucketize(sampleDays, "quarter");
    expect(result).toEqual([{ date: "2026-01-01", income: 700, expenses: 310 }]);
  });

  it("groups days into years", () => {
    const result = bucketize(sampleDays, "year");
    expect(result).toEqual([{ date: "2026-01-01", income: 700, expenses: 310 }]);
  });

  it("returns empty array for empty input", () => {
    expect(bucketize([], "week")).toEqual([]);
  });

  it("groups a week spanning a year boundary into a single bucket anchored on the Monday", () => {
    // Mon Dec 28 2026 — Sun Jan 3 2027 is one ISO week, Monday-anchored at 2026-12-28.
    const yearBoundary = [
      { date: "2026-12-28", income: 10, expenses: 5 }, // Mon
      { date: "2026-12-30", income: 20, expenses: 10 }, // Wed
      { date: "2027-01-01", income: 30, expenses: 15 }, // Fri
      { date: "2027-01-03", income: 40, expenses: 20 }, // Sun
    ];
    const result = bucketize(yearBoundary, "week");
    expect(result).toEqual([{ date: "2026-12-28", income: 100, expenses: 50 }]);
  });

  it("skips points with unparseable dates and warns in dev", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = bucketize(
      [
        { date: "2026-01-05", income: 10, expenses: 5 },
        { date: "not-a-date", income: 99, expenses: 99 },
      ],
      "week",
    );
    expect(result).toEqual([{ date: "2026-01-05", income: 10, expenses: 5 }]);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("not-a-date"));
    errorSpy.mockRestore();
  });
});

// ── computeTickInterval ───────────────────────────────────────────────────────

describe("computeTickInterval", () => {
  it("returns 0 when point count ≤ maxLabels", () => {
    expect(computeTickInterval(5, 15)).toBe(0);
    expect(computeTickInterval(15, 15)).toBe(0);
  });

  it("returns a positive interval when point count exceeds maxLabels", () => {
    expect(computeTickInterval(30, 15)).toBe(1);
    expect(computeTickInterval(60, 15)).toBe(3);
    expect(computeTickInterval(150, 15)).toBe(9);
  });
});

// ── SpendingTrendChart component ──────────────────────────────────────────────

describe("SpendingTrendChart", () => {
  it("renders the chart heading", () => {
    renderWithQuery(<SpendingTrendChart />);
    expect(screen.getByText("Monthly Income vs. Expenses")).toBeInTheDocument();
  });

  it("shows loading indicator before data arrives", () => {
    renderWithQuery(<SpendingTrendChart />);
    expect(screen.getByText("Loading chart…")).toBeInTheDocument();
  });

  it("displays error state when data fetch fails", async () => {
    const apiMock = await vi.importMock<typeof import("../lib/api")>("../lib/api");
    vi.mocked(apiMock.api.get).mockRejectedValueOnce(new Error("Failed to fetch"));

    renderWithQuery(<SpendingTrendChart />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load spending trend data. Please try again."),
      ).toBeInTheDocument();
    });
  });

  it("error state has role=alert and renders no link", async () => {
    const apiMock = await vi.importMock<typeof import("../lib/api")>("../lib/api");
    vi.mocked(apiMock.api.get).mockRejectedValueOnce(new Error("Failed to fetch"));

    renderWithQuery(<SpendingTrendChart />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows empty state when no data is available within the range", async () => {
    const apiMock = await vi.importMock<typeof import("../lib/api")>("../lib/api");
    // Range with no months: end before start so toTrendDataPoints returns []
    useAppStore.setState({ startDate: "2026-06-01", endDate: "2026-01-01" });
    vi.mocked(apiMock.api.get).mockResolvedValueOnce({ data: [] });

    renderWithQuery(<SpendingTrendChart />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "No spending data for the selected period. Adjust the date range or import transactions.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("renders the Recharts chart container when multi-month data is available", async () => {
    renderWithQuery(<SpendingTrendChart />);

    await waitFor(() => {
      expect(document.querySelector(".recharts-wrapper")).toBeInTheDocument();
    });
  });

  it("renders a stat card (no chart) when bucketing collapses to a single point", async () => {
    const apiMock = await vi.importMock<typeof import("../lib/api")>("../lib/api");
    useAppStore.setState({ startDate: "2026-01-01", endDate: "2026-01-01" });
    vi.mocked(apiMock.api.get).mockResolvedValueOnce({
      data: [{ date: "2026-01-01", income: 5000, expenses: 2500 }],
    });

    renderWithQuery(<SpendingTrendChart />);

    await waitFor(() => {
      expect(
        screen.getByText("Adjust the date range or pick a finer granularity to see a trend."),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Income")).toBeInTheDocument();
    expect(screen.getByText("Expenses")).toBeInTheDocument();
    expect(document.querySelector(".recharts-wrapper")).not.toBeInTheDocument();
  });

  it("shows a bucket-count caption for multi-point data", async () => {
    renderWithQuery(<SpendingTrendChart />);

    await waitFor(() => {
      expect(screen.getByText(/Showing 3 days of income and expenses\./)).toBeInTheDocument();
    });
  });

  it("renders the chart with role=img and a descriptive aria-label", async () => {
    renderWithQuery(<SpendingTrendChart />);

    await waitFor(() => {
      const img = screen.getByRole("img", { name: /Income and expenses chart/i });
      expect(img).toBeInTheDocument();
    });
  });

  it("link to /transactions preserves the selected date range", async () => {
    renderWithQuery(<SpendingTrendChart />);
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /view transactions/i });
      expect(link).toHaveAttribute("href", "/transactions?startDate=2026-01-01&endDate=2026-01-03");
    });
  });

  it("supports keyboard focus on the transactions link", async () => {
    const user = userEvent.setup();
    renderWithQuery(<SpendingTrendChart />);

    const link = await screen.findByRole("link", { name: /view transactions/i });
    expect(link).not.toHaveFocus();
    link.focus();
    expect(link).toHaveFocus();
    await user.keyboard("{Enter}");
  });

  it("renders Income and Expenses toggle buttons with aria-pressed=true by default", async () => {
    renderWithQuery(<SpendingTrendChart />);

    const incomeBtn = await screen.findByRole("button", { name: /income/i, pressed: true });
    const expensesBtn = await screen.findByRole("button", { name: /expenses/i, pressed: true });
    expect(incomeBtn).toBeInTheDocument();
    expect(expensesBtn).toBeInTheDocument();
  });

  it("clicking a toggle flips its aria-pressed state", async () => {
    const user = userEvent.setup();
    renderWithQuery(<SpendingTrendChart />);

    const incomeBtn = await screen.findByRole("button", { name: /income/i });
    expect(incomeBtn).toHaveAttribute("aria-pressed", "true");

    await user.click(incomeBtn);
    expect(incomeBtn).toHaveAttribute("aria-pressed", "false");

    await user.click(incomeBtn);
    expect(incomeBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("renders a Granularity selector defaulting to Auto", async () => {
    renderWithQuery(<SpendingTrendChart />);
    const select = await screen.findByLabelText(/^Granularity$/i);
    expect(select).toHaveValue("auto");
  });

  it("changing granularity to Month collapses 3 daily points into 1 monthly bucket", async () => {
    const user = userEvent.setup();
    renderWithQuery(<SpendingTrendChart />);

    // Initial: 3 days as buckets
    await screen.findByText(/Showing 3 days of income and expenses\./);

    const select = screen.getByLabelText(/^Granularity$/i);
    await user.selectOptions(select, "month");

    // Bucketed: 3 days in same month → 1 bucket → stat card
    await waitFor(() => {
      expect(
        screen.getByText("Adjust the date range or pick a finer granularity to see a trend."),
      ).toBeInTheDocument();
    });
  });

  it("renders an axis-label-count selector defaulting to 15", async () => {
    renderWithQuery(<SpendingTrendChart />);
    const select = await screen.findByLabelText(/Number of axis labels/i);
    expect(select).toHaveValue("15");
  });

  it("offers 5/10/15/20/30 as label-count options", async () => {
    renderWithQuery(<SpendingTrendChart />);
    const select = await screen.findByLabelText(/Number of axis labels/i);
    const optionValues = Array.from(select.querySelectorAll("option")).map((o) => o.value);
    expect(optionValues).toEqual(LABEL_COUNT_OPTIONS.map(String));
  });

  it("selecting a different label count updates the selector value", async () => {
    const user = userEvent.setup();
    renderWithQuery(<SpendingTrendChart />);

    const select = await screen.findByLabelText(/Number of axis labels/i);
    await user.selectOptions(select, "5");
    expect(select).toHaveValue("5");
  });

  it("renders Line/Bar style radio group with Line selected by default", async () => {
    renderWithQuery(<SpendingTrendChart />);

    const lineOption = await screen.findByRole("radio", { name: "Line" });
    const barOption = await screen.findByRole("radio", { name: "Bar" });
    expect(lineOption).toBeChecked();
    expect(barOption).not.toBeChecked();
  });

  it("clicking Bar style flips selection", async () => {
    const user = userEvent.setup();
    renderWithQuery(<SpendingTrendChart />);

    const lineOption = await screen.findByRole("radio", { name: "Line" });
    const barOption = await screen.findByRole("radio", { name: "Bar" });

    await user.click(barOption);
    expect(barOption).toBeChecked();
    expect(lineOption).not.toBeChecked();

    await user.click(lineOption);
    expect(lineOption).toBeChecked();
    expect(barOption).not.toBeChecked();
  });

  it("supports keyboard arrow-key navigation across the chart-style radio group", async () => {
    const user = userEvent.setup();
    renderWithQuery(<SpendingTrendChart />);

    const lineOption = await screen.findByRole("radio", { name: "Line" });
    const barOption = await screen.findByRole("radio", { name: "Bar" });

    lineOption.focus();
    expect(lineOption).toHaveFocus();

    // Native radios respond to ArrowRight by moving selection (and focus) forward.
    await user.keyboard("{ArrowRight}");
    expect(barOption).toBeChecked();
    expect(lineOption).not.toBeChecked();

    await user.keyboard("{ArrowLeft}");
    expect(lineOption).toBeChecked();
    expect(barOption).not.toBeChecked();
  });

  it("prevents hiding both series — clicking the last visible toggle is a no-op", async () => {
    const user = userEvent.setup();
    renderWithQuery(<SpendingTrendChart />);

    const incomeBtn = await screen.findByRole("button", { name: /income/i });
    const expensesBtn = await screen.findByRole("button", { name: /expenses/i });

    await user.click(incomeBtn);
    expect(incomeBtn).toHaveAttribute("aria-pressed", "false");
    expect(expensesBtn).toHaveAttribute("aria-pressed", "true");

    // Try to also hide expenses — should be ignored
    await user.click(expensesBtn);
    expect(expensesBtn).toHaveAttribute("aria-pressed", "true");
  });
});
