import { describe, it, expect } from "vitest";
import { detectFormat, extractTable, extractSampleRow, headerSignature } from "./detect.js";
import { EXPECTED_HEADERS as NEON_HEADERS } from "./neon.parser.js";
import { EXPECTED_HEADERS as ZKB_HEADERS } from "./zkb.parser.js";
import { EXPECTED_HEADERS as WISE_HEADERS } from "./wise.parser.js";
import { EXPECTED_HEADERS as UBS_HEADERS } from "./ubs.parser.js";

const neonHeader = NEON_HEADERS.join(";");
const zkbHeader = ZKB_HEADERS.join(";");
const wiseHeader = WISE_HEADERS.join(",");
const ubsHeader = `sep=;\n${UBS_HEADERS.join(";")}`;

describe("extractTable", () => {
  it("strips a sep= line and infers the declared delimiter", () => {
    const table = extractTable(`sep=;\nA;B;C\n1;2;3`);
    expect(table.delimiter).toBe(";");
    expect(table.columns).toEqual(["A", "B", "C"]);
    expect(table.rows).toEqual(["1;2;3"]);
  });

  it("infers the delimiter that yields the most columns when not declared", () => {
    expect(extractTable(`a,b,c,d\n1,2,3,4`).delimiter).toBe(",");
    expect(extractTable(`a;b;c;d\n1;2;3;4`).delimiter).toBe(";");
  });

  it("strips a UTF-8 BOM from the first column", () => {
    expect(extractTable(`\uFEFFDate,Amount\n1,2`).columns).toEqual(["Date", "Amount"]);
  });

  it("returns empty columns for an empty file", () => {
    expect(extractTable("").columns).toEqual([]);
  });
});

describe("extractSampleRow", () => {
  it("returns the first data row aligned with the columns", () => {
    expect(extractSampleRow("A;B;C\n1;2;3\n4;5;6")).toEqual(["1", "2", "3"]);
  });

  it("skips a sep= line and trims values", () => {
    expect(extractSampleRow("sep=;\nA;B\n x ; y ")).toEqual(["x", "y"]);
  });

  it("returns an empty array when there is no data row", () => {
    expect(extractSampleRow("A,B,C")).toEqual([]);
    expect(extractSampleRow("")).toEqual([]);
  });
});

describe("headerSignature", () => {
  it("is order-independent and case-insensitive", () => {
    expect(headerSignature(["Date", "Amount"])).toBe(headerSignature(["amount", "DATE"]));
  });

  it("ignores empty trailing columns", () => {
    expect(headerSignature(["Date", "Amount", "  "])).toBe(headerSignature(["Date", "Amount"]));
  });
});

describe("detectFormat", () => {
  it("confidently matches a built-in Neon header", () => {
    const result = detectFormat(`${neonHeader}\n2025-01-01;1;;;;Shop;ref;;;;`);
    expect(result.detectedFormat).toBe("neon");
    expect(result.confidence).toBe(1);
    expect(result.columns).toEqual(NEON_HEADERS);
  });

  it("confidently matches ZKB, Wise and UBS (incl. sep= line)", () => {
    expect(detectFormat(zkbHeader).detectedFormat).toBe("zkb");
    expect(detectFormat(wiseHeader).detectedFormat).toBe("wise");
    expect(detectFormat(ubsHeader).detectedFormat).toBe("ubs");
  });

  it("returns null for an ambiguous header that partially matches two formats", () => {
    // A header sharing only a couple of columns with Neon and ZKB — below the
    // confidence threshold, so no importer is auto-selected.
    const ambiguous = "Date;Amount;Booking text;Foo;Bar";
    const result = detectFormat(ambiguous);
    expect(result.detectedFormat).toBeNull();
    expect(result.confidence).toBeLessThan(0.8);
    expect(result.columns).toContain("Date");
  });

  it("returns null with the columns for an unrecognised header (manual mapping)", () => {
    const result = detectFormat("Transaktionsdatum,Betrag,Empfaenger\n2025-01-01,5,Shop");
    expect(result.detectedFormat).toBeNull();
    expect(result.confidence).toBeLessThan(0.8);
    expect(result.columns).toEqual(["Transaktionsdatum", "Betrag", "Empfaenger"]);
    expect(result.headerSignature).not.toBe("");
  });

  it("returns null with empty columns for a malformed/empty file", () => {
    const result = detectFormat("");
    expect(result.detectedFormat).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.columns).toEqual([]);
    expect(result.headerSignature).toBe("");
  });
});
