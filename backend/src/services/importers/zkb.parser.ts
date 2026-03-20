import { ServiceError } from "../../errors.js";
import type { ParsedTransaction } from "./neon.parser.js";
import { parseCSVLine } from "./csv.utils.js";

// Column indices for the ZKB CSV format
const COL = {
  DATE: 0,
  BOOKING_TEXT: 1,
  DEBIT_CHF: 6,
  CREDIT_CHF: 7,
} as const;

const EXPECTED_HEADERS = [
  "Date",
  "Booking text",
  "Curr",
  "Amount details",
  "ZKB reference",
  "Reference number",
  "Debit CHF",
  "Credit CHF",
  "Value date",
  "Balance CHF",
  "Payment purpose",
  "Details",
];

export function parseZKBCSV(csv: string): ParsedTransaction[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");

  if (lines.length < 2) {
    throw new ServiceError(422, "CSV file contains no data rows");
  }

  const header = parseCSVLine(lines[0]!, ";");
  for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
    if (header[i] !== EXPECTED_HEADERS[i]) {
      throw new ServiceError(
        422,
        `Unrecognized CSV format: expected ZKB export (header mismatch at column ${i + 1})`,
      );
    }
  }

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]!, ";");
    const rowNum = i + 1;

    const rawDate = fields[COL.DATE] ?? "";

    // Skip sub-rows (continuation rows that have no date)
    if (!rawDate) {
      continue;
    }

    const bookingText = (fields[COL.BOOKING_TEXT] ?? "").trim();
    const rawDebit = (fields[COL.DEBIT_CHF] ?? "").trim();
    const rawCredit = (fields[COL.CREDIT_CHF] ?? "").trim();

    // ZKB uses DD.MM.YYYY date format
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(rawDate)) {
      throw new ServiceError(
        422,
        `Row ${rowNum}: invalid date format "${rawDate}" — expected DD.MM.YYYY`,
      );
    }

    const [day, month, year] = rawDate.split(".");
    const isoDate = `${year}-${month}-${day}`;
    const date = new Date(`${isoDate}T00:00:00.000Z`);
    if (isNaN(date.getTime())) {
      throw new ServiceError(422, `Row ${rowNum}: invalid date "${rawDate}"`);
    }

    if (!rawDebit && !rawCredit) {
      throw new ServiceError(422, `Row ${rowNum}: missing amount`);
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
