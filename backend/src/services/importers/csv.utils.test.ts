import { describe, it, expect } from "vitest";
import { stripBOM, parseCSVLine, decodeCSVBuffer } from "./csv.utils.js";

describe("stripBOM", () => {
  it("removes a leading UTF-8 BOM", () => {
    const input = "\uFEFFKontonummer;Kartennummer";
    expect(stripBOM(input)).toBe("Kontonummer;Kartennummer");
  });

  it("returns the string unchanged when no BOM is present", () => {
    const input = "Kontonummer;Kartennummer";
    expect(stripBOM(input)).toBe("Kontonummer;Kartennummer");
  });

  it("returns an empty string unchanged", () => {
    expect(stripBOM("")).toBe("");
  });

  it("only strips BOM at the start, not in the middle", () => {
    const input = "before\uFEFFafter";
    expect(stripBOM(input)).toBe("before\uFEFFafter");
  });
});

describe("decodeCSVBuffer", () => {
  it("decodes a UTF-8 buffer when fallback is utf-8", () => {
    const buf = Buffer.from("Zürich", "utf-8");
    expect(decodeCSVBuffer(buf, "utf-8")).toBe("Zürich");
  });

  it("decodes a valid UTF-8 buffer even when fallback is iso-8859-1", () => {
    const buf = Buffer.from("Zürich", "utf-8");
    expect(decodeCSVBuffer(buf, "iso-8859-1")).toBe("Zürich");
  });

  it("falls back to iso-8859-1 when buffer is not valid UTF-8", () => {
    // ü in ISO-8859-1 is 0xFC (single byte), which is invalid UTF-8
    const buf = Buffer.from([0x5a, 0xfc, 0x72, 0x69, 0x63, 0x68]); // "Zürich" in ISO-8859-1
    expect(decodeCSVBuffer(buf, "iso-8859-1")).toBe("Zürich");
  });

  it("decodes pure ASCII regardless of fallback encoding", () => {
    const buf = Buffer.from("hello", "utf-8");
    expect(decodeCSVBuffer(buf, "iso-8859-1")).toBe("hello");
  });
});

describe("parseCSVLine", () => {
  it("parses semicolon-delimited fields", () => {
    expect(parseCSVLine("a;b;c", ";")).toEqual(["a", "b", "c"]);
  });

  it("parses comma-delimited fields", () => {
    expect(parseCSVLine("a,b,c", ",")).toEqual(["a", "b", "c"]);
  });

  it("strips surrounding double quotes", () => {
    expect(parseCSVLine('"hello";"world"', ";")).toEqual(["hello", "world"]);
  });

  it("handles escaped double quotes inside quoted fields", () => {
    expect(parseCSVLine('"say ""hi""";"ok"', ";")).toEqual(['say "hi"', "ok"]);
  });

  it("handles empty fields", () => {
    expect(parseCSVLine(";;", ";")).toEqual(["", "", ""]);
  });

  it("handles a single field with no delimiter", () => {
    expect(parseCSVLine("only", ";")).toEqual(["only"]);
  });
});
