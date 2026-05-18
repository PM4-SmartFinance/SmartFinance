import { describe, it, expect, afterEach } from "vitest";
import i18n from "./i18n";
import { formatAmount, formatDate, formatDateId, getSwissLocale } from "./format";

describe("Swiss Locale Formatting", () => {
  const testAmount = 1234.56;
  const testDate = new Date("2026-05-14T12:00:00Z");

  const locales = ["en", "de", "fr", "it", "rm"];

  describe("formatAmount", () => {
    it.each(locales)("formats currency correctly for %s", (lng) => {
      const result = formatAmount(testAmount, lng);
      const expected = new Intl.NumberFormat(getSwissLocale(lng), {
        style: "currency",
        currency: "CHF",
      }).format(testAmount);
      expect(result).toBe(expected);
    });

    it("uses an apostrophe as thousands separator for German Swiss formatting", () => {
      // ICU emits a straight ASCII apostrophe for de-CH; accept either the
      // typographic curly variant or the straight one to stay tolerant of
      // ICU/locale-data versioning.
      expect(formatAmount(1234.56, "de")).toMatch(/['’]234/);
    });

    it("uses a NBSP-class thousands separator for French Swiss formatting", () => {
      // fr-CH uses a non-breaking space (U+00A0) or narrow NBSP (U+202F).
      // Accept either to stay tolerant of ICU locale-data versioning.
      const out = formatAmount(1234.56, "fr");
      expect(out).toMatch(/[\u00a0\u202f]234/);
    });

    it("produces distinct outputs across locales", () => {
      const outputs = locales.map((lng) => formatAmount(testAmount, lng));
      // Not all locales need differ, but at least one pair must — guards against
      // every locale collapsing to en-CH because of a typo in getSwissLocale.
      expect(new Set(outputs).size).toBeGreaterThan(1);
    });

    it("returns FALLBACK em-dash for non-finite values", () => {
      expect(formatAmount("not-a-number", "en")).toBe("—");
      expect(formatAmount(Number.NaN, "en")).toBe("—");
    });
  });

  describe("formatDate", () => {
    it.each(locales)("formats dates correctly for %s", (lng) => {
      const result = formatDate(testDate, lng);
      const expected = new Intl.DateTimeFormat(getSwissLocale(lng), {
        dateStyle: "medium",
      }).format(testDate);
      expect(result).toBe(expected);
    });

    it("uses a numeric date format for de-CH (dd.mm.yyyy)", () => {
      // de-CH dateStyle:medium is fully numeric (e.g. "14.05.2026"), not
      // month-name. Asserting the numeric shape catches a silent collapse to
      // a non-Swiss locale (where the same call would emit "May 14, 2026").
      expect(formatDate(testDate, "de")).toMatch(/^\d{1,2}\.\d{2}\.\d{4}$/);
    });

    it("uses the Italian month abbreviation 'mag' for May in it-CH", () => {
      // ICU emits "mag" (lowercase, no trailing period in medium style).
      expect(formatDate(testDate, "it").toLowerCase()).toContain("mag");
    });

    it("uses the French month abbreviation 'mai' for May in fr-CH", () => {
      expect(formatDate(testDate, "fr").toLowerCase()).toContain("mai");
    });

    it("returns FALLBACK em-dash for invalid input", () => {
      expect(formatDate("not-a-date", "en")).toBe("—");
    });
  });

  describe("formatDateId", () => {
    it("converts YYYYMMDD into the same output as formatDate on the equivalent UTC date", () => {
      expect(formatDateId(20260514, "en")).toBe(formatDate(new Date(Date.UTC(2026, 4, 14)), "en"));
    });

    it("handles year boundaries (Jan 1 and Dec 31)", () => {
      expect(formatDateId(20260101, "en")).toBe(formatDate(new Date(Date.UTC(2026, 0, 1)), "en"));
      expect(formatDateId(20261231, "en")).toBe(formatDate(new Date(Date.UTC(2026, 11, 31)), "en"));
    });

    it("handles a leap-day correctly", () => {
      expect(formatDateId(20240229, "en")).toBe(formatDate(new Date(Date.UTC(2024, 1, 29)), "en"));
    });

    it("falls back to en-CH when given an unsupported locale", () => {
      expect(formatDateId(20260514, "xx")).toBe(formatDateId(20260514, "en"));
    });
  });

  describe("getSwissLocale", () => {
    it.each([
      ["en", "en-CH"],
      ["de", "de-CH"],
      ["fr", "fr-CH"],
      ["it", "it-CH"],
      ["rm", "rm-CH"],
    ])("maps %s to %s", (input, expected) => {
      expect(getSwissLocale(input)).toBe(expected);
    });

    it("strips region suffixes before mapping (e.g. en-US → en-CH)", () => {
      expect(getSwissLocale("en-US")).toBe("en-CH");
    });

    it("falls back to en-CH for unknown languages", () => {
      expect(getSwissLocale("xx")).toBe("en-CH");
      expect(getSwissLocale(undefined)).toBe("en-CH");
    });
  });

  describe("plural rules", () => {
    afterEach(async () => {
      if (i18n.resolvedLanguage !== "en") {
        await i18n.changeLanguage("en");
      }
    });

    it("renders the _one variant when count is 1 (en)", () => {
      const out = i18n.t("components.csvImportCard.resultSuccess", { count: 1 });
      expect(out).toContain("1");
      expect(out).toMatch(/\b1 transaction\b/);
    });

    it("renders the _other variant when count is 0 (en)", () => {
      const out = i18n.t("components.csvImportCard.resultSuccess", { count: 0 });
      expect(out).toMatch(/\b0 transactions\b/);
    });

    it("renders the _other variant when count is 2 (en)", () => {
      const out = i18n.t("components.csvImportCard.resultSuccess", { count: 2 });
      expect(out).toMatch(/\b2 transactions\b/);
    });

    it("renders the _one variant when count is 0 in French (CLDR 0 → one)", async () => {
      await i18n.changeLanguage("fr");
      const out = i18n.t("components.csvImportCard.resultSuccess", { count: 0 });
      // French JSON: "{{count}} transaction importée avec succès." (singular form)
      expect(out).toMatch(/\b0 transaction importée\b/);
    });

    it("renders the _other variant when count is 2 in French", async () => {
      await i18n.changeLanguage("fr");
      const out = i18n.t("components.csvImportCard.resultSuccess", { count: 2 });
      expect(out).toMatch(/\b2 transactions importées\b/);
    });
  });
});
