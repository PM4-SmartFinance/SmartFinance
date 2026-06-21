import { describe, it, expect } from "vitest";
import { parseMockBankCSV } from "./mock-bank.parser.js";
import { ServiceError } from "../../errors.js";

const HEADER = "date,amount,description";

describe("parseMockBankCSV", () => {
  it("parses a single debit row", () => {
    const csv = [HEADER, "2024-01-15,-42.50,Coffee Shop"].join("\n");
    const [row] = parseMockBankCSV(csv);
    expect(row).toMatchObject({
      amount: -42.5,
      description: "Coffee Shop",
      subject: "",
    });
    expect(row!.date).toEqual(new Date(Date.UTC(2024, 0, 15)));
  });

  it("parses a credit row", () => {
    const csv = [HEADER, "2024-01-16,1500.00,Salary"].join("\n");
    const [row] = parseMockBankCSV(csv);
    expect(row).toMatchObject({ amount: 1500, description: "Salary" });
  });

  it("returns an empty array for a header-only file", () => {
    expect(parseMockBankCSV(HEADER)).toEqual([]);
  });

  it("returns an empty array for an empty string", () => {
    expect(parseMockBankCSV("")).toEqual([]);
  });

  it("skips blank lines", () => {
    const csv = [HEADER, "2024-01-15,-10.00,ATM", "", "2024-01-16,20.00,Refund"].join("\n");
    expect(parseMockBankCSV(csv)).toHaveLength(2);
  });

  it("handles a description that contains a comma", () => {
    const csv = [HEADER, "2024-01-15,-5.00,Café, Berlin"].join("\n");
    const [row] = parseMockBankCSV(csv);
    expect(row!.description).toBe("Café, Berlin");
  });

  it("falls back to 'Unknown' when description is empty", () => {
    const csv = [HEADER, "2024-01-15,-5.00,"].join("\n");
    const [row] = parseMockBankCSV(csv);
    expect(row!.description).toBe("Unknown");
  });

  it("throws 422 for an invalid date format", () => {
    const csv = [HEADER, "15/01/2024,-5.00,Shop"].join("\n");
    expect(() => parseMockBankCSV(csv)).toThrow(ServiceError);
    expect(() => parseMockBankCSV(csv)).toThrow(/invalid date/i);
  });

  it("throws 422 for a non-numeric amount", () => {
    const csv = [HEADER, "2024-01-15,abc,Shop"].join("\n");
    expect(() => parseMockBankCSV(csv)).toThrow(ServiceError);
    expect(() => parseMockBankCSV(csv)).toThrow(/invalid amount/i);
  });

  it("throws 422 when a row has fewer than 3 columns", () => {
    const csv = [HEADER, "2024-01-15,-5.00"].join("\n");
    expect(() => parseMockBankCSV(csv)).toThrow(ServiceError);
    expect(() => parseMockBankCSV(csv)).toThrow(/3 columns/i);
  });

  it("parses multiple rows in order", () => {
    const csv = [
      HEADER,
      "2024-01-15,-42.50,Coffee Shop",
      "2024-01-16,1500.00,Salary",
      "2024-01-17,-10.00,Supermarket",
    ].join("\n");
    const rows = parseMockBankCSV(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0]!.amount).toBe(-42.5);
    expect(rows[1]!.amount).toBe(1500);
    expect(rows[2]!.amount).toBe(-10);
  });
});
