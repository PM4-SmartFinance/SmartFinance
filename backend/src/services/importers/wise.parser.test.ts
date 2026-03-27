import { describe, it, expect } from "vitest";
import { parseWiseCSV } from "./wise.parser.js";
import { ServiceError } from "../../errors.js";

const VALID_HEADER = `"TransferWise ID",Date,"Date Time",Amount,Currency,Description,"Payment Reference","Running Balance","Exchange From","Exchange To","Exchange Rate","Payer Name","Payee Name","Payee Account Number",Merchant,"Card Last Four Digits","Card Holder Full Name",Attachment,Note,"Total fees","Exchange To Amount","Transaction Type","Transaction Details Type"`;

describe("parseWiseCSV", () => {
  it("parses a debit transaction correctly", () => {
    const csv = [
      VALID_HEADER,
      `TRANSFER-1394444852,29-01-2025,"29-01-2025 17:23:16.284",-211.27,EUR,"Geld überwiesen an Max Muster",,0.00,,,,,"Max Muster",DE00000000000000000000,,,,,,0.00,,DEBIT,TRANSFER`,
    ].join("\n");

    const result = parseWiseCSV(csv);

    expect(result).toHaveLength(1);
    expect(result[0]!.amount).toBe(-211.27);
    expect(result[0]!.description).toBe("Geld überwiesen an Max Muster");
    expect(result[0]!.date.toISOString()).toBe("2025-01-29T00:00:00.000Z");
    expect(result[0]!.subject).toBe("");
  });

  it("parses a credit transaction correctly", () => {
    const csv = [
      VALID_HEADER,
      `BALANCE-3012848488,29-01-2025,"29-01-2025 17:22:40.348",211.27,EUR,"200,00 CHF zu 211,27 EUR umgetauscht",,211.27,CHF,EUR,1.05877,,,,,,,,,0.00,211.27,CREDIT,CONVERSION`,
    ].join("\n");

    const result = parseWiseCSV(csv);

    expect(result).toHaveLength(1);
    expect(result[0]!.amount).toBe(211.27);
    expect(result[0]!.description).toBe("200,00 CHF zu 211,27 EUR umgetauscht");
    expect(result[0]!.date.toISOString()).toBe("2025-01-29T00:00:00.000Z");
  });

  it("parses multiple rows correctly", () => {
    const csv = [
      VALID_HEADER,
      `TRANSFER-1394444852,29-01-2025,"29-01-2025 17:23:16.284",-211.27,EUR,"Geld überwiesen an Max Muster",,0.00,,,,,"Max Muster",DE00000000000000000000,,,,,,0.00,,DEBIT,TRANSFER`,
      `BALANCE-3012848488,29-01-2025,"29-01-2025 17:22:40.348",211.27,EUR,"200,00 CHF zu 211,27 EUR umgetauscht",,211.27,CHF,EUR,1.05877,,,,,,,,,0.00,211.27,CREDIT,CONVERSION`,
    ].join("\n");

    const result = parseWiseCSV(csv);

    expect(result).toHaveLength(2);
    expect(result[0]!.amount).toBe(-211.27);
    expect(result[1]!.amount).toBe(211.27);
  });

  it("uses 'Unknown' when description is empty", () => {
    const csv = [
      VALID_HEADER,
      `TRANSFER-1,01-06-2025,"01-06-2025 10:00:00.000",-50.00,CHF,,,50.00,,,,,,,,,,,,0.00,,DEBIT,TRANSFER`,
    ].join("\n");

    const result = parseWiseCSV(csv);
    expect(result[0]!.description).toBe("Unknown");
  });

  it("ignores trailing blank lines", () => {
    const csv = [
      VALID_HEADER,
      `TRANSFER-1394444852,29-01-2025,"29-01-2025 17:23:16.284",-211.27,EUR,"Merchant",,0.00,,,,,"Max Muster",,,,,,,0.00,,DEBIT,TRANSFER`,
      "",
      "  ",
    ].join("\n");

    const result = parseWiseCSV(csv);
    expect(result).toHaveLength(1);
  });

  it("handles CRLF line endings", () => {
    const csv =
      VALID_HEADER +
      "\r\n" +
      `TRANSFER-1394444852,29-01-2025,"29-01-2025 17:23:16.284",-211.27,EUR,"Merchant",,0.00,,,,,"Max Muster",,,,,,,0.00,,DEBIT,TRANSFER` +
      "\r\n";

    const result = parseWiseCSV(csv);
    expect(result).toHaveLength(1);
  });

  it("throws 422 when the CSV has no data rows (header only)", () => {
    expect(() => parseWiseCSV(VALID_HEADER)).toThrow(ServiceError);
    expect(() => parseWiseCSV(VALID_HEADER)).toThrow("no data rows");
  });

  it("throws 422 when the CSV is completely empty", () => {
    expect(() => parseWiseCSV("")).toThrow(ServiceError);
    expect(() => parseWiseCSV("  \n  \n")).toThrow(ServiceError);
  });

  it("throws 422 on wrong header format", () => {
    const wrongHeader = `"Date";"Amount";"Description"`;
    const csv = [wrongHeader, `"29-01-2025";"-211.27";"Merchant"`].join("\n");

    expect(() => parseWiseCSV(csv)).toThrow(ServiceError);
    expect(() => parseWiseCSV(csv)).toThrow("Unrecognized CSV format");
  });

  it("throws 422 when a row has an invalid date format", () => {
    const csv = [
      VALID_HEADER,
      `TRANSFER-1,2025-01-29,"2025-01-29 10:00:00.000",-50.00,CHF,"Merchant",,50.00,,,,,,,,,,,,0.00,,DEBIT,TRANSFER`,
    ].join("\n");

    expect(() => parseWiseCSV(csv)).toThrow(ServiceError);
    expect(() => parseWiseCSV(csv)).toThrow("invalid date format");
  });

  it("throws 422 when a row is missing the date field", () => {
    const csv = [
      VALID_HEADER,
      `TRANSFER-1,,"2025-01-29 10:00:00.000",-50.00,CHF,"Merchant",,50.00,,,,,,,,,,,,0.00,,DEBIT,TRANSFER`,
    ].join("\n");

    expect(() => parseWiseCSV(csv)).toThrow(ServiceError);
    expect(() => parseWiseCSV(csv)).toThrow("missing date");
  });

  it("throws 422 when a row is missing the amount field", () => {
    const csv = [
      VALID_HEADER,
      `TRANSFER-1,29-01-2025,"29-01-2025 10:00:00.000",,CHF,"Merchant",,50.00,,,,,,,,,,,,0.00,,DEBIT,TRANSFER`,
    ].join("\n");

    expect(() => parseWiseCSV(csv)).toThrow(ServiceError);
    expect(() => parseWiseCSV(csv)).toThrow("missing amount");
  });

  it("throws 422 when a row has an invalid amount", () => {
    const csv = [
      VALID_HEADER,
      `TRANSFER-1,29-01-2025,"29-01-2025 10:00:00.000",not-a-number,CHF,"Merchant",,50.00,,,,,,,,,,,,0.00,,DEBIT,TRANSFER`,
    ].join("\n");

    expect(() => parseWiseCSV(csv)).toThrow(ServiceError);
    expect(() => parseWiseCSV(csv)).toThrow("invalid amount");
  });
});
