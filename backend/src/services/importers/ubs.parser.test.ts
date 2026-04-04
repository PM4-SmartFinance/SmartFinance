import { describe, it, expect } from "vitest";
import { parseUBSCSV } from "./ubs.parser.js";
import { ServiceError } from "../../errors.js";

const SEP_LINE = "sep=;";
const VALID_HEADER = `"Kontonummer";"Kartennummer";"Konto-/Karteninhaber";"Einkaufsdatum";"Buchungstext";"Branche";"Betrag";"Originalw\u00e4hrung";"Kurs";"W\u00e4hrung";"Belastung";"Gutschrift";"Buchung"`;

describe("parseUBSCSV", () => {
  it("parses a debit transaction correctly", () => {
    const csv = [
      SEP_LINE,
      VALID_HEADER,
      `"1234 5678 9101";"9999 99XX XXXX 9999";"M. MUSTERMANN";"21.07.2025";"Laden6   Z\u00fcrich       CHE";"Lebensmittelgesch\u00e4ft";"1.7";"CHF";"";"CHF";"1.7";"";"23.07.2025"`,
    ].join("\n");

    const result = parseUBSCSV(csv);

    expect(result).toHaveLength(1);
    expect(result[0]!.amount).toBe(-1.7);
    expect(result[0]!.description).toBe("Laden6 Z\u00fcrich CHE");
    expect(result[0]!.date.toISOString()).toBe("2025-07-21T00:00:00.000Z");
    expect(result[0]!.subject).toBe("");
  });

  it("parses a credit transaction correctly", () => {
    const csv = [
      SEP_LINE,
      VALID_HEADER,
      `"1234 5678 9101";"";"M. MUSTERMANN";"16.07.2025";"2007 UEBERTRAG VON KONTO";"";"92.5";"CHF";"";"CHF";"";"100.5";"17.07.2025"`,
    ].join("\n");

    const result = parseUBSCSV(csv);

    expect(result).toHaveLength(1);
    expect(result[0]!.amount).toBe(100.5);
    expect(result[0]!.description).toBe("2007 UEBERTRAG VON KONTO");
  });

  it("parses multiple rows correctly", () => {
    const csv = [
      SEP_LINE,
      VALID_HEADER,
      `"1234 5678 9101";"9999 99XX XXXX 9999";"M. MUSTERMANN";"21.07.2025";"Laden6   Z\u00fcrich       CHE";"Lebensmittelgesch\u00e4ft";"1.7";"CHF";"";"CHF";"1.7";"";"23.07.2025"`,
      `"1234 5678 9101";"";"M. MUSTERMANN";"16.07.2025";"2007 UEBERTRAG VON KONTO";"";"92.5";"CHF";"";"CHF";"";"100.5";"17.07.2025"`,
    ].join("\n");

    const result = parseUBSCSV(csv);

    expect(result).toHaveLength(2);
    expect(result[0]!.amount).toBe(-1.7);
    expect(result[1]!.amount).toBe(100.5);
  });

  it("skips footer total rows", () => {
    const csv = [
      SEP_LINE,
      VALID_HEADER,
      `"1234 5678 9101";"9999 99XX XXXX 9999";"M. MUSTERMANN";"21.07.2025";"Laden6";"Lebensmittelgesch\u00e4ft";"1.7";"CHF";"";"CHF";"1.7";"";"23.07.2025"`,
      `;;;;"Total pro W\u00e4hrung";;;;;;;;Total`,
      `;;;;"Total Kartenbuchungen";;;;;"CHF";"500.99";"122.18";"-462.23"`,
    ].join("\n");

    const result = parseUBSCSV(csv);

    expect(result).toHaveLength(1);
    expect(result[0]!.amount).toBe(-1.7);
  });

  it("works without sep= prefix line", () => {
    const csv = [
      VALID_HEADER,
      `"1234 5678 9101";"9999 99XX XXXX 9999";"M. MUSTERMANN";"21.07.2025";"Laden6";"Shop";"1.7";"CHF";"";"CHF";"1.7";"";"23.07.2025"`,
    ].join("\n");

    const result = parseUBSCSV(csv);

    expect(result).toHaveLength(1);
    expect(result[0]!.amount).toBe(-1.7);
  });

  it("uses 'Unknown' when booking text is empty", () => {
    const csv = [
      SEP_LINE,
      VALID_HEADER,
      `"1234 5678 9101";"9999 99XX XXXX 9999";"M. MUSTERMANN";"21.07.2025";"";"Shop";"1.7";"CHF";"";"CHF";"1.7";"";"23.07.2025"`,
    ].join("\n");

    const result = parseUBSCSV(csv);
    expect(result[0]!.description).toBe("Unknown");
  });

  it("ignores trailing blank lines", () => {
    const csv = [
      SEP_LINE,
      VALID_HEADER,
      `"1234 5678 9101";"9999 99XX XXXX 9999";"M. MUSTERMANN";"21.07.2025";"Laden6";"Shop";"1.7";"CHF";"";"CHF";"1.7";"";"23.07.2025"`,
      "",
      "  ",
    ].join("\n");

    const result = parseUBSCSV(csv);
    expect(result).toHaveLength(1);
  });

  it("handles CRLF line endings", () => {
    const csv =
      SEP_LINE +
      "\r\n" +
      VALID_HEADER +
      "\r\n" +
      `"1234 5678 9101";"9999 99XX XXXX 9999";"M. MUSTERMANN";"21.07.2025";"Laden6";"Shop";"1.7";"CHF";"";"CHF";"1.7";"";"23.07.2025"` +
      "\r\n";

    const result = parseUBSCSV(csv);
    expect(result).toHaveLength(1);
  });

  it("throws 422 when the CSV has no data rows (header only)", () => {
    const csv = [SEP_LINE, VALID_HEADER].join("\n");
    expect(() => parseUBSCSV(csv)).toThrow(ServiceError);
    expect(() => parseUBSCSV(csv)).toThrow("no data rows");
  });

  it("throws 422 when the CSV is completely empty", () => {
    expect(() => parseUBSCSV("")).toThrow(ServiceError);
    expect(() => parseUBSCSV("  \n  \n")).toThrow(ServiceError);
  });

  it("throws 422 on wrong header format", () => {
    const wrongHeader = `"Date";"Amount";"Description"`;
    const csv = [wrongHeader, `"21.07.2025";"1.7";"Laden6"`].join("\n");

    expect(() => parseUBSCSV(csv)).toThrow(ServiceError);
    expect(() => parseUBSCSV(csv)).toThrow("Unrecognized CSV format");
  });

  it("throws 422 when a row has an invalid date format", () => {
    const csv = [
      SEP_LINE,
      VALID_HEADER,
      `"1234 5678 9101";"9999 99XX XXXX 9999";"M. MUSTERMANN";"2025-07-21";"Laden6";"Shop";"1.7";"CHF";"";"CHF";"1.7";"";"23.07.2025"`,
    ].join("\n");

    expect(() => parseUBSCSV(csv)).toThrow(ServiceError);
    expect(() => parseUBSCSV(csv)).toThrow("invalid date format");
  });

  it("reports the correct file row number when sep= line is present", () => {
    const csv = [
      SEP_LINE,
      VALID_HEADER,
      `"1234 5678 9101";"9999 99XX XXXX 9999";"M. MUSTERMANN";"2025-07-21";"Laden6";"Shop";"1.7";"CHF";"";"CHF";"1.7";"";"23.07.2025"`,
    ].join("\n");

    // sep= is row 1, header is row 2, data is row 3
    expect(() => parseUBSCSV(csv)).toThrow("Row 3:");
  });

  it("reports the correct file row number without sep= line", () => {
    const csv = [
      VALID_HEADER,
      `"1234 5678 9101";"9999 99XX XXXX 9999";"M. MUSTERMANN";"2025-07-21";"Laden6";"Shop";"1.7";"CHF";"";"CHF";"1.7";"";"23.07.2025"`,
    ].join("\n");

    // header is row 1, data is row 2
    expect(() => parseUBSCSV(csv)).toThrow("Row 2:");
  });

  it("throws 422 when a row is missing the amount", () => {
    const csv = [
      SEP_LINE,
      VALID_HEADER,
      `"1234 5678 9101";"9999 99XX XXXX 9999";"M. MUSTERMANN";"21.07.2025";"Laden6";"Shop";"1.7";"CHF";"";"CHF";"";"";"23.07.2025"`,
    ].join("\n");

    expect(() => parseUBSCSV(csv)).toThrow(ServiceError);
    expect(() => parseUBSCSV(csv)).toThrow("missing amount");
  });

  it("throws 422 when credit amount is not a number", () => {
    const csv = [
      SEP_LINE,
      VALID_HEADER,
      `"1234 5678 9101";"";"M. MUSTERMANN";"16.07.2025";"UEBERTRAG";"";"92.5";"CHF";"";"CHF";"";"not-a-number";"17.07.2025"`,
    ].join("\n");

    expect(() => parseUBSCSV(csv)).toThrow(ServiceError);
    expect(() => parseUBSCSV(csv)).toThrow("invalid credit amount");
  });

  it("throws 422 when debit amount is not a number", () => {
    const csv = [
      SEP_LINE,
      VALID_HEADER,
      `"1234 5678 9101";"9999 99XX XXXX 9999";"M. MUSTERMANN";"21.07.2025";"Laden6";"Shop";"1.7";"CHF";"";"CHF";"not-a-number";"";"23.07.2025"`,
    ].join("\n");

    expect(() => parseUBSCSV(csv)).toThrow(ServiceError);
    expect(() => parseUBSCSV(csv)).toThrow("invalid debit amount");
  });

  it("correctly parses an ISO-8859-1 encoded buffer (real UBS export encoding)", () => {
    // Build a CSV string with German umlauts, then encode it as ISO-8859-1 bytes
    const csvUtf8 = [
      SEP_LINE,
      VALID_HEADER,
      `"1234 5678 9101";"9999 99XX XXXX 9999";"M. MUSTERMANN";"21.07.2025";"Coop Europaallee Z\u00fcrich CHE";"Lebensmittelgesch\u00e4ft";"1.7";"CHF";"";"CHF";"1.7";"";"23.07.2025"`,
    ].join("\r\n");

    // Encode to ISO-8859-1: ü=0xFC, ä=0xE4
    const iso88591Bytes = new Uint8Array(
      Array.from(csvUtf8).map((ch) => {
        const code = ch.charCodeAt(0);
        if (code > 0xff) throw new Error(`Character outside ISO-8859-1: ${ch}`);
        return code;
      }),
    );

    // Simulate the controller decoding path
    const decoded = new TextDecoder("iso-8859-1").decode(iso88591Bytes);
    const result = parseUBSCSV(decoded);

    expect(result).toHaveLength(1);
    expect(result[0]!.description).toBe("Coop Europaallee Z\u00fcrich CHE");
  });

  it("throws 422 when both debit and credit are filled", () => {
    const csv = [
      SEP_LINE,
      VALID_HEADER,
      `"1234 5678 9101";"9999 99XX XXXX 9999";"M. MUSTERMANN";"21.07.2025";"Laden6";"Shop";"1.7";"CHF";"";"CHF";"1.7";"50.0";"23.07.2025"`,
    ].join("\n");

    expect(() => parseUBSCSV(csv)).toThrow(ServiceError);
    expect(() => parseUBSCSV(csv)).toThrow("both debit and credit amounts are filled");
  });

  it("throws 422 when all rows are footer rows (no actual transactions)", () => {
    const csv = [
      SEP_LINE,
      VALID_HEADER,
      `;;;;"Total pro W\u00e4hrung";;;;;;;;Total`,
      `;;;;"Total Kartenbuchungen";;;;;"CHF";"500.99";"122.18";"-462.23"`,
    ].join("\n");

    expect(() => parseUBSCSV(csv)).toThrow(ServiceError);
    expect(() => parseUBSCSV(csv)).toThrow("no data rows");
  });
});
