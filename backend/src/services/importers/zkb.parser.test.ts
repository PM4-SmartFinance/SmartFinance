import { describe, it, expect } from "vitest";
import { parseZKBCSV } from "./zkb.parser.js";
import { ServiceError } from "../../errors.js";

const VALID_HEADER = `"Date";"Booking text";"Curr";"Amount details";"ZKB reference";"Reference number";"Debit CHF";"Credit CHF";"Value date";"Balance CHF";"Payment purpose";"Details"`;

describe("parseZKBCSV", () => {
  it("parses a credit transaction correctly", () => {
    const csv = [
      VALID_HEADER,
      `"13.03.2026";"Credit TWINT: MAX MUSTER +41790000000";"";"";"L113P1119ZAQR68W-2";"";"";"25.00";"13.03.2026";"327.89";"";""`,
    ].join("\n");

    const result = parseZKBCSV(csv);

    expect(result).toHaveLength(1);
    expect(result[0]!.amount).toBe(25.0);
    expect(result[0]!.description).toBe("Credit TWINT: MAX MUSTER +41790000000");
    expect(result[0]!.date.toISOString()).toBe("2026-03-13T00:00:00.000Z");
    expect(result[0]!.subject).toBe("");
  });

  it("parses a debit transaction as a negative amount", () => {
    const csv = [
      VALID_HEADER,
      `"13.03.2026";"Purchase ZKB Visa Debit card no. xxxx 7900, Coop Pronto 5751 0862";"";"";"L115B1119Z9YM6HQ-1";"";"1.95";"";"11.03.2026";"302.89";"";""`,
    ].join("\n");

    const result = parseZKBCSV(csv);

    expect(result).toHaveLength(1);
    expect(result[0]!.amount).toBe(-1.95);
    expect(result[0]!.description).toBe(
      "Purchase ZKB Visa Debit card no. xxxx 7900, Coop Pronto 5751 0862",
    );
  });

  it("parses multiple rows and skips sub-rows (rows with empty date)", () => {
    const csv = [
      VALID_HEADER,
      `"09.03.2026";"Debit Mobile Banking (2)";"";"";"Z260688053425";"";"894.30";"";"09.03.2026";"789.94";"";""`,
      `"";"Krankenkasse AG, Zahlungsverkehr, 8004 Zürich, CH";"CHF";"804.30";"";"";"";"";"";"";"Prämie 01.01. - 31.12.2026 / Kundennummer 47.29361-5";""`,
      `"";"Verein Beispiel, Vereinsstrasse 25, 8000 Zürich, CH";"CHF";"90.00";"";"";"";"";"";"";"";""`,
      `"25.02.2026";"Credit originator: Max Muster, Musterstrasse 4, 8000 Zürich ZH";"";"";"Z260563278817";"";"";"4000.00";"25.02.2026";"3867.16";"Gesendet mit neon";"Max Muster, Musterstrasse 4, 8000 Zürich ZH, CH"`,
    ].join("\n");

    const result = parseZKBCSV(csv);

    expect(result).toHaveLength(2);
    expect(result[0]!.amount).toBe(-894.3);
    expect(result[0]!.description).toBe("Debit Mobile Banking (2)");
    expect(result[0]!.date.toISOString()).toBe("2026-03-09T00:00:00.000Z");
    expect(result[1]!.amount).toBe(4000.0);
    expect(result[1]!.description).toBe(
      "Credit originator: Max Muster, Musterstrasse 4, 8000 Zürich ZH",
    );
  });

  it("uses 'Unknown' when booking text is empty", () => {
    const csv = [
      VALID_HEADER,
      `"01.01.2026";"";"";"";"REF001";"";"";"10.00";"01.01.2026";"100.00";"";""`,
    ].join("\n");

    const result = parseZKBCSV(csv);
    expect(result[0]!.description).toBe("Unknown");
  });

  it("ignores trailing blank lines", () => {
    const csv = [
      VALID_HEADER,
      `"13.03.2026";"Credit TWINT: MAX MUSTER";"";"";"REF1";"";"";"25.00";"13.03.2026";"327.89";"";""`,
      "",
      "  ",
    ].join("\n");

    const result = parseZKBCSV(csv);
    expect(result).toHaveLength(1);
  });

  it("handles CRLF line endings", () => {
    const csv =
      VALID_HEADER +
      "\r\n" +
      `"13.03.2026";"Credit TWINT: MAX MUSTER";"";"";"REF1";"";"";"25.00";"13.03.2026";"327.89";"";""` +
      "\r\n";

    const result = parseZKBCSV(csv);
    expect(result).toHaveLength(1);
  });

  it("throws 422 when the CSV has no data rows (header only)", () => {
    expect(() => parseZKBCSV(VALID_HEADER)).toThrow(ServiceError);
    expect(() => parseZKBCSV(VALID_HEADER)).toThrow("no data rows");
  });

  it("throws 422 when the CSV is completely empty", () => {
    expect(() => parseZKBCSV("")).toThrow(ServiceError);
    expect(() => parseZKBCSV("  \n  \n")).toThrow(ServiceError);
  });

  it("throws 422 on wrong header format", () => {
    const wrongHeader = `"Date";"Amount";"Description"`;
    const csv = [wrongHeader, `"13.03.2026";"25.00";"Merchant"`].join("\n");

    expect(() => parseZKBCSV(csv)).toThrow(ServiceError);
    expect(() => parseZKBCSV(csv)).toThrow("Unrecognized CSV format");
  });

  it("throws 422 when a row has an invalid date format", () => {
    const csv = [
      VALID_HEADER,
      `"2026-03-13";"Credit TWINT";"";"";"REF1";"";"";"25.00";"2026-03-13";"327.89";"";""`,
    ].join("\n");

    expect(() => parseZKBCSV(csv)).toThrow(ServiceError);
    expect(() => parseZKBCSV(csv)).toThrow("invalid date format");
  });

  it("throws 422 when a row has an invalid credit amount", () => {
    const csv = [
      VALID_HEADER,
      `"13.03.2026";"Credit TWINT";"";"";"REF1";"";"";"";"13.03.2026";"327.89";"";""`,
    ].join("\n");

    expect(() => parseZKBCSV(csv)).toThrow(ServiceError);
    expect(() => parseZKBCSV(csv)).toThrow("missing amount");
  });

  it("throws 422 when credit amount is not a number", () => {
    const csv = [
      VALID_HEADER,
      `"13.03.2026";"Credit TWINT";"";"";"REF1";"";"";not-a-number;"13.03.2026";"327.89";"";""`,
    ].join("\n");

    expect(() => parseZKBCSV(csv)).toThrow(ServiceError);
    expect(() => parseZKBCSV(csv)).toThrow("invalid credit amount");
  });

  it("throws 422 when debit amount is not a number", () => {
    const csv = [
      VALID_HEADER,
      `"13.03.2026";"Purchase";"";"";"REF1";"";not-a-number;"";"13.03.2026";"302.89";"";""`,
    ].join("\n");

    expect(() => parseZKBCSV(csv)).toThrow(ServiceError);
    expect(() => parseZKBCSV(csv)).toThrow("invalid debit amount");
  });

  it("throws 422 when all rows are sub-rows (no transactions with dates)", () => {
    const csv = [
      VALID_HEADER,
      `"";"Krankenkasse AG";"CHF";"804.30";"";"";"";"";"";"";"Prämie";""`,
    ].join("\n");

    expect(() => parseZKBCSV(csv)).toThrow(ServiceError);
    expect(() => parseZKBCSV(csv)).toThrow("no data rows");
  });
});
