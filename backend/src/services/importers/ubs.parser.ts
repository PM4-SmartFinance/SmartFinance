import { ServiceError } from "../../errors.js";
import type { ParsedTransaction } from "./types.js";
import { parseCSVLine, stripBOM } from "./csv.utils.js";

// Column indices for the UBS CSV format
const COL = {
  DATE: 3,
  BOOKING_TEXT: 4,
  DEBIT: 10,
  CREDIT: 11,
} as const;

const EXPECTED_HEADERS = [
  "Kontonummer",
  "Kartennummer",
  "Konto-/Karteninhaber",
  "Einkaufsdatum",
  "Buchungstext",
  "Branche",
  "Betrag",
  "Originalw\u00e4hrung",
  "Kurs",
  "W\u00e4hrung",
  "Belastung",
  "Gutschrift",
  "Buchung",
];

export function parseUBSCSV(csv: string): ParsedTransaction[] {
  let lines = stripBOM(csv)
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");

  // UBS CSVs start with a "sep=;" line that declares the delimiter
  let delimiter = ";";
  let sepLineOffset = 0;
  if (lines.length > 0 && /^sep=.$/i.test(lines[0]!)) {
    delimiter = lines[0]!.charAt(4);
    lines = lines.slice(1);
    sepLineOffset = 1;
  }

  if (lines.length < 2) {
    throw new ServiceError(422, "CSV file contains no data rows");
  }

  const header = parseCSVLine(lines[0]!, delimiter);
  for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
    if (header[i] !== EXPECTED_HEADERS[i]) {
      throw new ServiceError(
        422,
        `Unrecognized CSV format: expected UBS export (header mismatch at column ${i + 1}: expected "${EXPECTED_HEADERS[i]}", got "${header[i] ?? "<missing>"}")`,
      );
    }
  }

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]!, delimiter);
    const rowNum = i + 1 + sepLineOffset;

    const rawDate = (fields[COL.DATE] ?? "").trim();

    // Skip footer/total rows — identified by empty date and empty leading fields
    if (!rawDate) {
      const isLikelyFooter = fields.slice(0, COL.DATE).every((f) => !f.trim());
      if (!isLikelyFooter) {
        throw new ServiceError(422, `Row ${rowNum}: missing date`);
      }
      continue;
    }

    const bookingText = (fields[COL.BOOKING_TEXT] ?? "").replace(/\s+/g, " ").trim();

    const rawDebit = (fields[COL.DEBIT] ?? "").trim();
    const rawCredit = (fields[COL.CREDIT] ?? "").trim();

    // UBS uses DD.MM.YYYY date format
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(rawDate)) {
      throw new ServiceError(
        422,
        `Row ${rowNum}: invalid date format "${rawDate}" — expected DD.MM.YYYY`,
      );
    }

    const [day, month, year] = rawDate.split(".");
    const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    if (isNaN(date.getTime())) {
      throw new ServiceError(422, `Row ${rowNum}: invalid date "${rawDate}"`);
    }

    if (!rawDebit && !rawCredit) {
      throw new ServiceError(422, `Row ${rowNum}: missing amount`);
    }
    if (rawDebit && rawCredit) {
      throw new ServiceError(422, `Row ${rowNum}: both debit and credit amounts are filled`);
    }

    let amount: number;
    if (rawCredit) {
      amount = parseFloat(rawCredit);
      if (isNaN(amount)) {
        throw new ServiceError(422, `Row ${rowNum}: invalid credit amount "${rawCredit}"`);
      }
    } else {
      const debit = parseFloat(rawDebit);
      if (isNaN(debit)) {
        throw new ServiceError(422, `Row ${rowNum}: invalid debit amount "${rawDebit}"`);
      }
      amount = -debit;
    }

    transactions.push({
      date,
      amount,
      description: bookingText || "Unknown",
      subject: "",
    });
  }

  if (transactions.length === 0) {
    throw new ServiceError(422, "CSV file contains no data rows");
  }

  return transactions;
}
