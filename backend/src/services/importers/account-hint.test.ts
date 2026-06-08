import { describe, it, expect } from "vitest";
import { extractAccountHint } from "./account-hint.js";

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
});
