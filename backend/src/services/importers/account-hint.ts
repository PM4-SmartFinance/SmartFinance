import { parseCSVLine, stripBOM } from "./csv.utils.js";

export interface AccountHint {
  iban?: string;
  accountNumber?: string;
}

/**
 * Extracts a target-account hint from raw CSV text so the import service can
 * resolve which user account a CSV belongs to when the user has several
 * accounts and no explicit accountId was provided (KAN-169).
 *
 * Only the UBS format currently carries an account identifier in its rows: the
 * "Kontonummer" in column 0. Neon, ZKB and Wise exports contain transaction
 * rows only, so they return null and the import falls back to letting the user
 * pick an account. Plugin formats are unknown here and also return null.
 */
export function extractAccountHint(csvText: string, format: string): AccountHint | null {
  if (format === "ubs") {
    return extractUbsAccountNumber(csvText);
  }
  return null;
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
