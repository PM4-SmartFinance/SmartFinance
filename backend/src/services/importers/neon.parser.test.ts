import { describe, it, expect } from "vitest";
import { parseNeonCSV } from "./neon.parser.js";
import { ServiceError } from "../../errors.js";

const VALID_HEADER = `"Date";"Amount";"Original amount";"Original currency";"Exchange rate";"Description";"Subject";"Category";"Tags";"Wise";"Spaces"`;

describe("parseNeonCSV", () => {
  it("parses a valid single-row CSV correctly", () => {
    const csv = [
      VALID_HEADER,
      `"2025-12-22";"-5303.70";"";"";"";"Max Muster ZKB";"Gesendet mit neon";"uncategorized";"";"no";"no"`,
    ].join("\n");

    const result = parseNeonCSV(csv);

    expect(result).toHaveLength(1);
    expect(result[0]!.amount).toBe(-5303.7);
    expect(result[0]!.description).toBe("Max Muster ZKB");
    expect(result[0]!.subject).toBe("Gesendet mit neon");
    expect(result[0]!.date.toISOString()).toBe("2025-12-22T00:00:00.000Z");
  });

  it("parses multiple rows from the sample export", () => {
    const csv = [
      VALID_HEADER,
      `"2025-12-22";"-5303.70";"";"";"";"Max Muster ZKB";"Gesendet mit neon";"uncategorized";"";"no";"no"`,
      `"2025-12-19";"3113.70";"";"";"";"Arbeitgeber AG";"";"income";"";"no";"no"`,
      `"2025-08-24";"-138.55";"-146.76";"EUR";"1.05926";"wizzair.com DL1FRJ";;"uncategorized";"";"no";"no"`,
    ].join("\n");

    const result = parseNeonCSV(csv);

    expect(result).toHaveLength(3);
    expect(result[1]!.amount).toBe(3113.7);
    expect(result[1]!.description).toBe("Arbeitgeber AG");
    expect(result[1]!.subject).toBe("");
    expect(result[2]!.amount).toBe(-138.55);
    expect(result[2]!.description).toBe("wizzair.com DL1FRJ");
  });

  it("uses 'Unknown' as description when the Description field is empty", () => {
    const csv = [
      VALID_HEADER,
      `"2025-01-01";"10.00";"";"";"";"";"some subject";"income";"";"no";"no"`,
    ].join("\n");

    const result = parseNeonCSV(csv);
    expect(result[0]!.description).toBe("Unknown");
  });

  it("handles unquoted empty fields (inconsistent quoting edge case)", () => {
    const csv = [VALID_HEADER, `"2025-01-20";"1536.00";;;;"Krankenkasse AG";;;"";;"no"`].join("\n");

    const result = parseNeonCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0]!.amount).toBe(1536.0);
  });

  it("ignores trailing blank lines", () => {
    const csv = [
      VALID_HEADER,
      `"2025-01-01";"10.00";"";"";"";"Merchant";"";"income";"";"no";"no"`,
      "",
      "  ",
    ].join("\n");

    const result = parseNeonCSV(csv);
    expect(result).toHaveLength(1);
  });

  it("throws 422 when the CSV has no data rows (header only)", () => {
    expect(() => parseNeonCSV(VALID_HEADER)).toThrow(ServiceError);
    expect(() => parseNeonCSV(VALID_HEADER)).toThrow("no data rows");
  });

  it("throws 422 when the CSV is completely empty", () => {
    expect(() => parseNeonCSV("")).toThrow(ServiceError);
    expect(() => parseNeonCSV("  \n  \n")).toThrow(ServiceError);
  });

  it("throws 422 on wrong header format", () => {
    const wrongHeader = `"TransactionDate";"Value";"Memo"`;
    const csv = [wrongHeader, `"2025-01-01";"10.00";"Merchant"`].join("\n");

    expect(() => parseNeonCSV(csv)).toThrow(ServiceError);
    expect(() => parseNeonCSV(csv)).toThrow("Unrecognized CSV format");
  });

  it("throws 422 when a row has an invalid date format", () => {
    const csv = [
      VALID_HEADER,
      `"22.12.2025";"-100.00";"";"";"";"Merchant";"";"uncategorized";"";"no";"no"`,
    ].join("\n");

    expect(() => parseNeonCSV(csv)).toThrow(ServiceError);
    expect(() => parseNeonCSV(csv)).toThrow("invalid date format");
  });

  it("throws 422 when a row has an invalid amount", () => {
    const csv = [
      VALID_HEADER,
      `"2025-01-01";"not-a-number";"";"";"";"Merchant";"";"uncategorized";"";"no";"no"`,
    ].join("\n");

    expect(() => parseNeonCSV(csv)).toThrow(ServiceError);
    expect(() => parseNeonCSV(csv)).toThrow("invalid amount");
  });

  it("throws 422 when a row is missing the date field", () => {
    const csv = [
      VALID_HEADER,
      `"";"-100.00";"";"";"";"Merchant";"";"uncategorized";"";"no";"no"`,
    ].join("\n");

    expect(() => parseNeonCSV(csv)).toThrow(ServiceError);
    expect(() => parseNeonCSV(csv)).toThrow("missing date");
  });

  it("throws 422 when a row is missing the amount field", () => {
    const csv = [
      VALID_HEADER,
      `"2025-01-01";"";"";"";"";"Merchant";"";"uncategorized";"";"no";"no"`,
    ].join("\n");

    expect(() => parseNeonCSV(csv)).toThrow(ServiceError);
    expect(() => parseNeonCSV(csv)).toThrow("missing amount");
  });

  it("correctly handles CRLF line endings", () => {
    const csv =
      VALID_HEADER +
      "\r\n" +
      `"2025-12-22";"-5303.70";"";"";"";"Max Muster ZKB";"Gesendet mit neon";"uncategorized";"";"no";"no"\r\n`;

    const result = parseNeonCSV(csv);
    expect(result).toHaveLength(1);
  });
});
