import { describe, it, expect } from "vitest";
import { formatAmount, formatDate, FALLBACK } from "./format";

describe("formatAmount", () => {
  it("formats positive amounts without a sign", () => {
    expect(formatAmount("1250.00")).toBe("CHF 1250.00");
  });

  it("formats negative amounts with a unicode minus sign", () => {
    expect(formatAmount("-42.50")).toBe("−CHF 42.50");
  });

  it("rounds to two decimals", () => {
    expect(formatAmount("3.1")).toBe("CHF 3.10");
    expect(formatAmount("3.145")).toBe("CHF 3.15");
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
    expect(formatAmount("0")).toBe("CHF 0.00");
    expect(formatAmount("-0")).toBe("CHF 0.00");
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
