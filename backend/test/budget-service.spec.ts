import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isBudgetActiveNow } from "../src/services/budget.service.js";

describe("isBudgetActiveNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Fix time to 2026-04-15 (month=4, year=2026)
    vi.setSystemTime(new Date(2026, 3, 15));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("DAILY is always active", () => {
    expect(isBudgetActiveNow("DAILY", 0, 0)).toBe(true);
  });

  it("MONTHLY is always active", () => {
    expect(isBudgetActiveNow("MONTHLY", 0, 0)).toBe(true);
  });

  it("YEARLY is always active", () => {
    expect(isBudgetActiveNow("YEARLY", 0, 0)).toBe(true);
  });

  it("SPECIFIC_MONTH is active when month matches current month", () => {
    expect(isBudgetActiveNow("SPECIFIC_MONTH", 4, 0)).toBe(true);
  });

  it("SPECIFIC_MONTH is inactive when month does not match", () => {
    expect(isBudgetActiveNow("SPECIFIC_MONTH", 3, 0)).toBe(false);
    expect(isBudgetActiveNow("SPECIFIC_MONTH", 12, 0)).toBe(false);
  });

  it("SPECIFIC_YEAR is active when year matches current year", () => {
    expect(isBudgetActiveNow("SPECIFIC_YEAR", 0, 2026)).toBe(true);
  });

  it("SPECIFIC_YEAR is inactive when year does not match", () => {
    expect(isBudgetActiveNow("SPECIFIC_YEAR", 0, 2025)).toBe(false);
    expect(isBudgetActiveNow("SPECIFIC_YEAR", 0, 2027)).toBe(false);
  });

  it("SPECIFIC_MONTH_YEAR is active when both month and year match", () => {
    expect(isBudgetActiveNow("SPECIFIC_MONTH_YEAR", 4, 2026)).toBe(true);
  });

  it("SPECIFIC_MONTH_YEAR is inactive when only month matches", () => {
    expect(isBudgetActiveNow("SPECIFIC_MONTH_YEAR", 4, 2025)).toBe(false);
  });

  it("SPECIFIC_MONTH_YEAR is inactive when only year matches", () => {
    expect(isBudgetActiveNow("SPECIFIC_MONTH_YEAR", 3, 2026)).toBe(false);
  });

  it("SPECIFIC_MONTH_YEAR is inactive when neither matches", () => {
    expect(isBudgetActiveNow("SPECIFIC_MONTH_YEAR", 6, 2025)).toBe(false);
  });
});
