import { ServiceError } from "../../errors.js";

export interface ParsedTransaction {
  date: Date;
  amount: number;
  description: string;
  subject: string;
}

// Column indices for the Neon CSV format
const COL = {
  DATE: 0,
  AMOUNT: 1,
  DESCRIPTION: 5,
  SUBJECT: 6,
} as const;

const EXPECTED_HEADERS = [
  "Date",
  "Amount",
  "Original amount",
  "Original currency",
  "Exchange rate",
  "Description",
  "Subject",
];

function parseCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }

  fields.push(current);
  return fields;
}

export function parseNeonCSV(csv: string): ParsedTransaction[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");

  if (lines.length < 2) {
    throw new ServiceError(422, "CSV file contains no data rows");
  }

  const header = parseCSVLine(lines[0]!, ";");
  for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
    if (header[i] !== EXPECTED_HEADERS[i]) {
      throw new ServiceError(
        422,
        `Unrecognized CSV format: expected Neon export (header mismatch at column ${i + 1})`,
      );
    }
  }

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]!, ";");
    const rowNum = i + 1;

    const rawDate = fields[COL.DATE] ?? "";
    const rawAmount = fields[COL.AMOUNT] ?? "";
    const description = (fields[COL.DESCRIPTION] ?? "").trim();
    const subject = (fields[COL.SUBJECT] ?? "").trim();

    if (!rawDate) {
      throw new ServiceError(422, `Row ${rowNum}: missing date`);
    }
    if (!rawAmount) {
      throw new ServiceError(422, `Row ${rowNum}: missing amount`);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      throw new ServiceError(
        422,
        `Row ${rowNum}: invalid date format "${rawDate}" — expected YYYY-MM-DD`,
      );
    }

    const date = new Date(`${rawDate}T00:00:00.000Z`);
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
      subject,
    });
  }

  return transactions;
}
