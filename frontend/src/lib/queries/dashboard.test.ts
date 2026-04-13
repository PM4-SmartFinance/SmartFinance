import { describe, it, expect } from "vitest";
import { toTrendDataPoints } from "./dashboard";

describe("toTrendDataPoints", () => {
  it("maps MonthlyTrendPoint array to TrendDataPoint array", () => {
    const input = [
      { year: 2026, month: 1, income: 5000, expenses: 2500 },
      { year: 2026, month: 12, income: 6000, expenses: 3000 },
    ];
    expect(toTrendDataPoints(input)).toEqual([
      { date: "2026-01-01", amount: 2500 },
      { date: "2026-12-01", amount: 3000 },
    ]);
  });

  it("pads single-digit months with leading zero", () => {
    const input = [{ year: 2026, month: 3, income: 0, expenses: 150 }];
    expect(toTrendDataPoints(input)).toEqual([{ date: "2026-03-01", amount: 150 }]);
  });

  it("returns empty array for empty input", () => {
    expect(toTrendDataPoints([])).toEqual([]);
  });

  it("uses expenses as amount, ignoring income", () => {
    const input = [{ year: 2026, month: 6, income: 9999, expenses: 42 }];
    expect(toTrendDataPoints(input)).toEqual([{ date: "2026-06-01", amount: 42 }]);
  });
});
