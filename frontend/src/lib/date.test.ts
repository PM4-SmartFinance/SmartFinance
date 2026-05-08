import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  formatLocalDate,
  getDefaultStartDate,
  getDefaultEndDate,
  getDefaultDateRange,
  subDays,
  subMonths,
} from "./date";

describe("formatLocalDate", () => {
  it("formats a date as YYYY-MM-DD using local timezone components", () => {
    const d = new Date(2026, 3, 5); // April 5, 2026 in local time
    expect(formatLocalDate(d)).toBe("2026-04-05");
  });

  it("zero-pads single-digit months and days", () => {
    const d = new Date(2026, 0, 1); // January 1
    expect(formatLocalDate(d)).toBe("2026-01-01");
  });
});

describe("default date range helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 4)); // May 4, 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("getDefaultEndDate returns today", () => {
    expect(getDefaultEndDate()).toBe("2026-05-04");
  });

  it("getDefaultStartDate returns 30 days before today", () => {
    expect(getDefaultStartDate()).toBe("2026-04-04");
  });

  it("getDefaultDateRange wraps both ends", () => {
    expect(getDefaultDateRange()).toEqual({ start: "2026-04-04", end: "2026-05-04" });
  });
});

describe("subDays", () => {
  it("subtracts within the same month", () => {
    expect(formatLocalDate(subDays(new Date(2026, 4, 15), 5))).toBe("2026-05-10");
  });

  it("rolls back across a month boundary", () => {
    expect(formatLocalDate(subDays(new Date(2026, 2, 3), 5))).toBe("2026-02-26");
  });

  it("rolls back across a year boundary", () => {
    expect(formatLocalDate(subDays(new Date(2026, 0, 5), 10))).toBe("2025-12-26");
  });

  it("preserves Feb 29 logic on a leap year", () => {
    // Mar 5 2024 minus 5 days = Feb 29 2024 (2024 is a leap year)
    expect(formatLocalDate(subDays(new Date(2024, 2, 5), 5))).toBe("2024-02-29");
  });

  it("crosses a DST spring-forward boundary without drift", () => {
    // US DST starts 2026-03-08; subtract 7 days from 2026-03-15
    expect(formatLocalDate(subDays(new Date(2026, 2, 15), 7))).toBe("2026-03-08");
  });

  it("does not mutate the input date", () => {
    const input = new Date(2026, 4, 15);
    subDays(input, 30);
    expect(input.getDate()).toBe(15);
    expect(input.getMonth()).toBe(4);
  });
});

describe("subMonths", () => {
  it("subtracts within the same year", () => {
    expect(formatLocalDate(subMonths(new Date(2026, 4, 15), 2))).toBe("2026-03-15");
  });

  it("rolls back across a year boundary", () => {
    expect(formatLocalDate(subMonths(new Date(2026, 1, 10), 3))).toBe("2025-11-10");
  });

  it("clamps Mar 31 minus 1 month to Feb 28 (non-leap year)", () => {
    // Without clamping, Date.setMonth(2-1) on Mar 31 2026 yields Mar 3 2026
    expect(formatLocalDate(subMonths(new Date(2026, 2, 31), 1))).toBe("2026-02-28");
  });

  it("clamps Mar 29 minus 1 month to Feb 29 in a leap year", () => {
    expect(formatLocalDate(subMonths(new Date(2024, 2, 29), 1))).toBe("2024-02-29");
  });

  it("clamps May 31 minus 3 months to Feb 28 (non-leap year)", () => {
    expect(formatLocalDate(subMonths(new Date(2026, 4, 31), 3))).toBe("2026-02-28");
  });

  it("subtracting 12 months yields same day-of-month one year prior", () => {
    expect(formatLocalDate(subMonths(new Date(2026, 4, 4), 12))).toBe("2025-05-04");
  });

  it("does not mutate the input date", () => {
    const input = new Date(2026, 2, 31);
    subMonths(input, 1);
    expect(input.getDate()).toBe(31);
    expect(input.getMonth()).toBe(2);
  });
});
