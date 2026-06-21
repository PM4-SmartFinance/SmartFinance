import { describe, it, expect } from "vitest";
import { formatAmount, formatDate, FALLBACK } from "./format";

// Helper to swap non-breaking spaces (NBSP) into standard spaces for testing
const normalize = (str: string) => str.replace(/\u00A0/g, " ");

describe("formatAmount", () => {
  it("formats positive amounts with thousands separators", () => {
    // Expects the comma!
    expect(normalize(formatAmount("1250.00"))).toBe("CHF 1'250.00");
  });

  it("formats negative amounts with a standard minus sign", () => {
    // Expects the standard hyphen, and en-US places it before the currency
    expect(normalize(formatAmount("-42.50"))).toBe("CHF-42.50");
  });

  it("rounds to two decimals", () => {
    expect(normalize(formatAmount("3.1"))).toBe("CHF 3.10");
    expect(normalize(formatAmount("3.145"))).toBe("CHF 3.15");
  });

  it("returns the fallback for non-numeric input", () => {
    expect(formatAmount("not-a-number")).toBe(FALLBACK);
    expect(formatAmount("")).toBe(FALLBACK);
  });

  it("returns the fallback for non-finite values", () => {
    expect(formatAmount("Infinity")).toBe(FALLBACK);
    expect(formatAmount("NaN")).toBe(FALLBACK);
  });

  it("treats zero as positive (no sign)", () => {
    expect(normalize(formatAmount("0"))).toBe("CHF 0.00");
    expect(normalize(formatAmount("-0"))).toBe("CHF 0.00");
  });
});

describe("formatDate", () => {
  it("formats a valid ISO date without leaking the raw string", () => {
    const out = formatDate("2026-04-15");
    expect(out).not.toBe("2026-04-15");
    expect(out).not.toBe("Invalid Date");
    expect(out).not.toBe(FALLBACK);
  });

  it("returns the fallback for invalid input", () => {
    expect(formatDate("not-a-date")).toBe(FALLBACK);
    expect(formatDate("")).toBe(FALLBACK);
  });
});
