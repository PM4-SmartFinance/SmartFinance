import { describe, it, expect } from "vitest";
import { formatAmount, formatDate } from "./format";

describe("Swiss Locale Formatting", () => {
  const testAmount = 1234.56;
  const testDate = new Date("2026-05-14T12:00:00Z");

  const locales = ["en", "de", "fr", "it", "rm"];

  describe("formatAmount", () => {
    it.each(locales)("formats currency correctly for %s", (lng) => {
      const result = formatAmount(testAmount, lng);

      expect(result).toContain("1");
      expect(result).toContain("234");
      expect(result).toContain("CHF");
    });
  });

  describe("formatDate", () => {
    it.each(locales)("formats dates correctly for %s", (lng) => {
      const result = formatDate(testDate, lng);

      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toBe("—");
    });
  });
});
