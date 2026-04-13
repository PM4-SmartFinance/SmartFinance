import { describe, it, expect, vi } from "vitest";
import { extractArray, toTrendDataPoints } from "./dashboard";

// Suppress dev-mode warnings during tests
vi.stubEnv("DEV", "");

describe("extractArray", () => {
  it("returns the input when it is already an array", () => {
    const input = [1, 2, 3];
    expect(extractArray(input)).toBe(input);
  });

  it("extracts the data array from a { data: [...] } wrapper", () => {
    const inner = [{ id: 1 }, { id: 2 }];
    expect(extractArray({ data: inner })).toBe(inner);
  });

  it("returns empty array for null", () => {
    expect(extractArray(null)).toEqual([]);
  });

  it("returns empty array for undefined", () => {
    expect(extractArray(undefined)).toEqual([]);
  });

  it("returns empty array for an object without a data key", () => {
    expect(extractArray({ items: [1, 2] })).toEqual([]);
  });

  it("returns empty array for an object where data is not an array", () => {
    expect(extractArray({ data: "not-an-array" })).toEqual([]);
  });

  it("returns empty array for a primitive string", () => {
    expect(extractArray("hello")).toEqual([]);
  });

  it("returns empty array for a number", () => {
    expect(extractArray(42)).toEqual([]);
  });
});

describe("toTrendDataPoints", () => {
  it("passes through TrendDataPoint shapes unchanged", () => {
    const input = [
      { date: "2026-01-01", amount: 100 },
      { date: "2026-02-01", amount: 200 },
    ];
    expect(toTrendDataPoints(input)).toEqual([
      { date: "2026-01-01", amount: 100 },
      { date: "2026-02-01", amount: 200 },
    ]);
  });

  it("transforms MonthlyTrendPoint shapes to TrendDataPoint", () => {
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

  it("handles mixed TrendDataPoint and MonthlyTrendPoint shapes", () => {
    const input = [
      { date: "2026-01-01", amount: 100 },
      { year: 2026, month: 2, income: 5000, expenses: 200 },
    ];
    expect(toTrendDataPoints(input)).toEqual([
      { date: "2026-01-01", amount: 100 },
      { date: "2026-02-01", amount: 200 },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(toTrendDataPoints([])).toEqual([]);
  });

  it("returns empty array for null input", () => {
    expect(toTrendDataPoints(null)).toEqual([]);
  });

  it("returns empty array for undefined input", () => {
    expect(toTrendDataPoints(undefined)).toEqual([]);
  });

  it("filters out unrecognized data point shapes", () => {
    const input = [
      { date: "2026-01-01", amount: 100 },
      { foo: "bar", baz: 123 },
      { year: 2026, month: 2, income: 5000, expenses: 200 },
    ];
    expect(toTrendDataPoints(input)).toEqual([
      { date: "2026-01-01", amount: 100 },
      { date: "2026-02-01", amount: 200 },
    ]);
  });

  it("coerces string amounts to numbers", () => {
    const input = [{ date: "2026-01-01", amount: "150.50" }];
    expect(toTrendDataPoints(input)).toEqual([{ date: "2026-01-01", amount: 150.5 }]);
  });

  it("unwraps { data: [...] } wrapper via extractArray", () => {
    const input = {
      data: [{ date: "2026-01-01", amount: 100 }],
    };
    expect(toTrendDataPoints(input)).toEqual([{ date: "2026-01-01", amount: 100 }]);
  });
});
