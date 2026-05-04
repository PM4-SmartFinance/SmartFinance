import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  formatLocalDate,
  getDefaultStartDate,
  getDefaultEndDate,
  getDefaultDateRange,
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
