import { parseCSVLine, stripBOM } from "./csv.utils.js";

export interface AccountHint {
  iban?: string;
  accountNumber?: string;
}

/**
 * Extracts a target-account hint from raw CSV text so the import service can
 * resolve which user account a CSV belongs to when the user has several
 * accounts and no explicit accountId was provided (KAN-169, KAN-163).
 *
 * Two identifiers are looked for: an IBAN anywhere in the file (works for any
 * format that happens to carry one), and the UBS "Kontonummer" in column 0.
 * None of the four built-in formats carry the source IBAN today, so the IBAN
 * scan mainly benefits custom CSVs; the UBS account-number path is the reliable
 * built-in match. Returns null when neither identifier is present.
 */
export function extractAccountHint(csvText: string, format: string): AccountHint | null {
  const hint: AccountHint = {};

  const iban = extractIbanFromCsv(csvText);
  if (iban) hint.iban = iban;

  if (format === "ubs") {
    const ubs = extractUbsAccountNumber(csvText);
    if (ubs?.accountNumber) hint.accountNumber = ubs.accountNumber;
  }

  return hint.iban || hint.accountNumber ? hint : null;
}

// Structural IBAN candidate: 2 letters, 2 check digits, then 11–30 more
// alphanumerics (optionally space-grouped). Run on an uppercased copy.
const IBAN_CANDIDATE = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/g;

/**
 * Scans the whole CSV for the first IBAN-shaped token, preferring one that
 * passes the mod-97 checksum. Returns the normalized (space-stripped,
 * uppercased) IBAN, or null if none is found.
 */
export function extractIbanFromCsv(csvText: string): string | null {
  const text = stripBOM(csvText).toUpperCase();
  const matches = text.match(IBAN_CANDIDATE);
  if (!matches) return null;

  let firstWellFormed: string | null = null;
  for (const raw of matches) {
    const normalized = raw.replace(/\s+/g, "");
    if (normalized.length < 15 || normalized.length > 34) continue;
    if (firstWellFormed === null) firstWellFormed = normalized;
    if (ibanMod97(normalized)) return normalized;
  }
  return firstWellFormed;
}

/**
 * ISO 13616 mod-97 IBAN checksum. Expects an already space-stripped, uppercased
 * IBAN. Moves the first four characters to the end, maps letters A→10…Z→35, and
 * checks the resulting number is congruent to 1 mod 97.
 */
export function ibanMod97(iban: string): boolean {
  if (iban.length < 4) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    let value: number;
    if (code >= 48 && code <= 57) {
      value = code - 48; // 0-9
    } else if (code >= 65 && code <= 90) {
      value = code - 55; // A=10 … Z=35
    } else {
      return false;
    }
    remainder = (remainder * (value > 9 ? 100 : 10) + value) % 97;
  }
  return remainder === 1;
}

function extractUbsAccountNumber(csvText: string): AccountHint | null {
  let lines = stripBOM(csvText)
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");

  // UBS exports start with a "sep=;" line declaring the delimiter.
  let delimiter = ";";
  if (lines.length > 0 && /^sep=.$/i.test(lines[0]!)) {
    delimiter = lines[0]!.charAt(4);
    lines = lines.slice(1);
  }

  // Need at least a header and one data row.
  if (lines.length < 2) return null;

  // Column 0 of the first data row holds the Kontonummer.
  const fields = parseCSVLine(lines[1]!, delimiter);
  const accountNumber = (fields[0] ?? "").trim();
  if (!accountNumber) return null;

  return { accountNumber };
}
