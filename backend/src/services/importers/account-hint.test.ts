import { describe, it, expect } from "vitest";
import { extractAccountHint, extractIbanFromCsv, ibanMod97 } from "./account-hint.js";

// Canonical valid Swiss test IBAN.
const VALID_IBAN = "CH9300762011623852957";
const VALID_IBAN_SPACED = "CH93 0076 2011 6238 5295 7";

const UBS_HEADER = `"Kontonummer";"Kartennummer";"Konto-/Karteninhaber";"Einkaufsdatum";"Buchungstext";"Branche";"Betrag";"Originalwährung";"Kurs";"Währung";"Belastung";"Gutschrift";"Buchung"`;
const UBS_ROW = `"1234 5678 9101";"9999 99XX XXXX 9999";"M. MUSTERMANN";"21.07.2025";"Laden6";"Shop";"1.7";"CHF";"";"CHF";"1.7";"";"23.07.2025"`;

describe("extractAccountHint", () => {
  it("extracts the Kontonummer from a UBS export with a sep line", () => {
    const csv = ["sep=;", UBS_HEADER, UBS_ROW].join("\n");
    expect(extractAccountHint(csv, "ubs")).toEqual({ accountNumber: "1234 5678 9101" });
  });

  it("extracts the Kontonummer from a UBS export without a sep line", () => {
    const csv = [UBS_HEADER, UBS_ROW].join("\n");
    expect(extractAccountHint(csv, "ubs")).toEqual({ accountNumber: "1234 5678 9101" });
  });

  it("returns null for a UBS file with no data rows", () => {
    expect(extractAccountHint(UBS_HEADER, "ubs")).toBeNull();
  });

  it("returns null for formats that carry no account identifier", () => {
    expect(extractAccountHint("anything", "neon")).toBeNull();
    expect(extractAccountHint("anything", "zkb")).toBeNull();
    expect(extractAccountHint("anything", "wise")).toBeNull();
  });

  it("returns null for unknown plugin formats", () => {
    expect(extractAccountHint("anything", "some-plugin")).toBeNull();
  });

  it("extracts an IBAN found anywhere in the file, for any format", () => {
    const csv = `Date,Description,Account\n2025-01-01,Coffee,${VALID_IBAN_SPACED}`;
    expect(extractAccountHint(csv, "neon")).toEqual({ iban: VALID_IBAN });
  });

  it("returns both IBAN and UBS account number when both are present", () => {
    const csv = ["sep=;", UBS_HEADER, UBS_ROW, `note;${VALID_IBAN_SPACED}`].join("\n");
    expect(extractAccountHint(csv, "ubs")).toEqual({
      iban: VALID_IBAN,
      accountNumber: "1234 5678 9101",
    });
  });
});

describe("extractIbanFromCsv", () => {
  it("normalises a spaced IBAN", () => {
    expect(extractIbanFromCsv(`x,${VALID_IBAN_SPACED},y`)).toBe(VALID_IBAN);
  });

  it("returns null when no IBAN-shaped token is present", () => {
    expect(extractIbanFromCsv("Date,Amount\n2025-01-01,42.00")).toBeNull();
  });

  it("prefers a checksum-valid candidate over a malformed look-alike", () => {
    const bogus = "CH00 0000 0000 0000 0000 0"; // well-formed shape, fails mod-97
    expect(extractIbanFromCsv(`${bogus}\n${VALID_IBAN_SPACED}`)).toBe(VALID_IBAN);
  });
});

describe("ibanMod97", () => {
  it("accepts a valid IBAN", () => {
    expect(ibanMod97(VALID_IBAN)).toBe(true);
  });

  it("rejects a structurally-valid but checksum-wrong IBAN", () => {
    expect(ibanMod97("CH0000000000000000000")).toBe(false);
  });

  it("rejects input containing non-alphanumeric characters", () => {
    expect(ibanMod97("CH93-0076")).toBe(false);
  });
});
