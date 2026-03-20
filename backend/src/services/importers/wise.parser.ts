import { ServiceError } from "../../errors.js";
import type { ParsedTransaction } from "./neon.parser.js";
import { parseCSVLine } from "./csv.utils.js";

// Column indices for the Wise CSV format
const COL = {
  DATE: 1,
  AMOUNT: 3,
  DESCRIPTION: 5,
} as const;

const EXPECTED_HEADERS = [
  "TransferWise ID",
  "Date",
  "Date Time",
  "Amount",
  "Currency",
  "Description",
  "Payment Reference",
  "Running Balance",
  "Exchange From",
  "Exchange To",
  "Exchange Rate",
  "Payer Name",
  "Payee Name",
  "Payee Account Number",
  "Merchant",
  "Card Last Four Digits",
  "Card Holder Full Name",
  "Attachment",
  "Note",
  "Total fees",
  "Exchange To Amount",
  "Transaction Type",
  "Transaction Details Type",
];

export function parseWiseCSV(csv: string): ParsedTransaction[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");

  if (lines.length < 2) {
    throw new ServiceError(422, "CSV file contains no data rows");
  }

  const header = parseCSVLine(lines[0]!, ",");
  for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
    if (header[i] !== EXPECTED_HEADERS[i]) {
      throw new ServiceError(
        422,
        `Unrecognized CSV format: expected Wise export (header mismatch at column ${i + 1})`,
      );
    }
  }

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]!, ",");
    const rowNum = i + 1;

    const rawDate = fields[COL.DATE] ?? "";
    const rawAmount = fields[COL.AMOUNT] ?? "";
    const description = (fields[COL.DESCRIPTION] ?? "").trim();

    if (!rawDate) {
      throw new ServiceError(422, `Row ${rowNum}: missing date`);
    }
    if (!rawAmount) {
      throw new ServiceError(422, `Row ${rowNum}: missing amount`);
    }

    // Wise uses DD-MM-YYYY date format
    if (!/^\d{2}-\d{2}-\d{4}$/.test(rawDate)) {
      throw new ServiceError(
        422,
        `Row ${rowNum}: invalid date format "${rawDate}" — expected DD-MM-YYYY`,
      );
    }

    const [day, month, year] = rawDate.split("-");
    const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    if (isNaN(date.getTime())) {
      throw new ServiceError(422, `Row ${rowNum}: invalid date "${rawDate}"`);
    }

    const amount = parseFloat(rawAmount);
    if (isNaN(amount)) {
      throw new ServiceError(422, `Row ${rowNum}: invalid amount "${rawAmount}"`);
    }

    transactions.push({
      date,
      amount,
      description: description || "Unknown",
      subject: "",
    });
  }

  return transactions;
}
