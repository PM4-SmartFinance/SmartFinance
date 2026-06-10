import { ServiceError } from "../../errors.js";
import type { ParsedTransaction } from "./types.js";
import { parseCSVLine } from "./csv.utils.js";
import { extractTable } from "./detect.js";

/**
 * Mapping-driven CSV parser (KAN-163).
 *
 * When automatic importer detection fails, the user maps the file's columns to
 * canonical transaction fields. This parser consumes that mapping — keyed by
 * header name, not column index, so it survives reordered exports — and
 * produces the same `ParsedTransaction[]` the built-in parsers do. The
 * downstream validation → normalisation → categorisation pipeline is unchanged.
 *
 * Amount is expressed either as a single signed column (`amount`) or as a
 * debit/credit pair (debit reduces the balance, credit increases it). Dates are
 * auto-detected across the common Swiss/ISO layouts unless `dateFormat` pins one.
 */

export type DateFormat = "iso" | "dmy-dot" | "dmy-dash" | "dmy-slash";

export interface ColumnMapping {
  /** Header name of the transaction date column. */
  date: string;
  /** Header name of the description/booking-text column. */
  description: string;
  /** Header name of a single signed-amount column. Mutually exclusive with debit/credit. */
  amount?: string;
  /** Header name of the debit (outflow) column. Pairs with `credit`. */
  debit?: string;
  /** Header name of the credit (inflow) column. Pairs with `debit`. */
  credit?: string;
  /** Optional header name carrying a secondary subject/reference. */
  subject?: string;
  /** Pin the date layout; omit to auto-detect per row. */
  dateFormat?: DateFormat;
}

const DATE_FORMATS: DateFormat[] = ["iso", "dmy-dot", "dmy-dash", "dmy-slash"];

/**
 * Validates the shape of a client-supplied mapping. Throws `ServiceError(400)`
 * on malformed input so the controller can reject it at the boundary before any
 * parsing work. Returns the value typed as `ColumnMapping`.
 */
export function validateColumnMapping(raw: unknown): ColumnMapping {
  if (typeof raw !== "object" || raw === null) {
    throw new ServiceError(400, "Column mapping must be an object");
  }
  const m = raw as Record<string, unknown>;

  const isOptStr = (v: unknown): v is string | undefined =>
    v === undefined || (typeof v === "string" && v.trim() !== "");

  if (typeof m["date"] !== "string" || m["date"].trim() === "") {
    throw new ServiceError(400, "Column mapping requires a 'date' column");
  }
  if (typeof m["description"] !== "string" || m["description"].trim() === "") {
    throw new ServiceError(400, "Column mapping requires a 'description' column");
  }
  if (
    !isOptStr(m["amount"]) ||
    !isOptStr(m["debit"]) ||
    !isOptStr(m["credit"]) ||
    !isOptStr(m["subject"])
  ) {
    throw new ServiceError(400, "Column mapping fields must be non-empty strings when present");
  }

  const hasAmount = typeof m["amount"] === "string";
  const hasDebitCredit = typeof m["debit"] === "string" || typeof m["credit"] === "string";
  if (hasAmount && hasDebitCredit) {
    throw new ServiceError(400, "Provide either 'amount' or a debit/credit pair, not both");
  }
  if (!hasAmount && !hasDebitCredit) {
    throw new ServiceError(400, "Column mapping requires an 'amount' or a debit/credit column");
  }

  if (m["dateFormat"] !== undefined && !DATE_FORMATS.includes(m["dateFormat"] as DateFormat)) {
    throw new ServiceError(400, `Unsupported dateFormat: ${String(m["dateFormat"])}`);
  }

  const mapping: ColumnMapping = {
    date: m["date"],
    description: m["description"],
  };
  if (typeof m["amount"] === "string") mapping.amount = m["amount"];
  if (typeof m["debit"] === "string") mapping.debit = m["debit"];
  if (typeof m["credit"] === "string") mapping.credit = m["credit"];
  if (typeof m["subject"] === "string") mapping.subject = m["subject"];
  if (m["dateFormat"] !== undefined) mapping.dateFormat = m["dateFormat"] as DateFormat;
  return mapping;
}

export function parseWithMapping(csvText: string, mapping: ColumnMapping): ParsedTransaction[] {
  const { columns, delimiter, rows } = extractTable(csvText);

  if (columns.length === 0) {
    throw new ServiceError(422, "CSV file contains no header row");
  }

  // Resolve each mapped header name to a column index. Surface every
  // unrecognised column at once so the user gets one actionable message.
  const index = buildHeaderIndex(columns);
  const requested: Array<[label: string, header: string | undefined]> = [
    ["date", mapping.date],
    ["description", mapping.description],
    ["amount", mapping.amount],
    ["debit", mapping.debit],
    ["credit", mapping.credit],
    ["subject", mapping.subject],
  ];
  const unknown = requested
    .filter(([, header]) => header !== undefined && !index.has(normalize(header)))
    .map(([, header]) => header as string);
  if (unknown.length > 0) {
    throw new ServiceError(
      422,
      `Mapping references columns not present in the file: ${unknown.join(", ")}. ` +
        `Available columns: ${columns.join(", ")}`,
    );
  }

  const dateIdx = index.get(normalize(mapping.date))!;
  const descIdx = index.get(normalize(mapping.description))!;
  const amountIdx = mapping.amount !== undefined ? index.get(normalize(mapping.amount))! : null;
  const debitIdx = mapping.debit !== undefined ? index.get(normalize(mapping.debit))! : null;
  const creditIdx = mapping.credit !== undefined ? index.get(normalize(mapping.credit))! : null;
  const subjectIdx = mapping.subject !== undefined ? index.get(normalize(mapping.subject))! : null;

  const transactions: ParsedTransaction[] = [];

  for (let i = 0; i < rows.length; i++) {
    const fields = parseCSVLine(rows[i]!, delimiter);
    // +2: 1 for header row, 1 for 1-based row numbering.
    const rowNum = i + 2;

    const rawDate = (fields[dateIdx] ?? "").trim();
    // Skip continuation/sub-rows that carry no date (matches built-in parsers).
    if (!rawDate) continue;

    const date = parseDate(rawDate, mapping.dateFormat);
    if (!date) {
      throw new ServiceError(422, `Row ${rowNum}: unrecognized date "${rawDate}"`);
    }

    const amount = computeAmount({ fields, amountIdx, debitIdx, creditIdx, rowNum });

    const description = (fields[descIdx] ?? "").replace(/\s+/g, " ").trim();
    const subject = subjectIdx !== null ? (fields[subjectIdx] ?? "").trim() : "";

    transactions.push({
      date,
      amount,
      description: description || "Unknown",
      subject,
    });
  }

  if (transactions.length === 0) {
    throw new ServiceError(422, "CSV file contains no data rows");
  }

  return transactions;
}

function buildHeaderIndex(columns: string[]): Map<string, number> {
  const index = new Map<string, number>();
  columns.forEach((col, i) => {
    const key = normalize(col);
    // First occurrence wins on duplicate headers.
    if (!index.has(key)) index.set(key, i);
  });
  return index;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function computeAmount(params: {
  fields: string[];
  amountIdx: number | null;
  debitIdx: number | null;
  creditIdx: number | null;
  rowNum: number;
}): number {
  const { fields, amountIdx, debitIdx, creditIdx, rowNum } = params;

  if (amountIdx !== null) {
    const raw = (fields[amountIdx] ?? "").trim();
    if (!raw) throw new ServiceError(422, `Row ${rowNum}: missing amount`);
    const amount = parseAmount(raw);
    if (amount === null) throw new ServiceError(422, `Row ${rowNum}: invalid amount "${raw}"`);
    return amount;
  }

  const rawDebit = debitIdx !== null ? (fields[debitIdx] ?? "").trim() : "";
  const rawCredit = creditIdx !== null ? (fields[creditIdx] ?? "").trim() : "";

  if (!rawDebit && !rawCredit) {
    throw new ServiceError(422, `Row ${rowNum}: missing amount`);
  }
  if (rawDebit && rawCredit) {
    throw new ServiceError(422, `Row ${rowNum}: both debit and credit amounts are filled`);
  }

  if (rawCredit) {
    const credit = parseAmount(rawCredit);
    if (credit === null)
      throw new ServiceError(422, `Row ${rowNum}: invalid credit amount "${rawCredit}"`);
    return Math.abs(credit);
  }
  const debit = parseAmount(rawDebit);
  if (debit === null)
    throw new ServiceError(422, `Row ${rowNum}: invalid debit amount "${rawDebit}"`);
  return -Math.abs(debit);
}

/**
 * Parses an amount tolerating Swiss thousands separators (apostrophe/space) and
 * a comma decimal mark. Returns null when the value is not a finite number.
 */
function parseAmount(raw: string): number | null {
  let s = raw.replace(/['\s]/g, "");
  // If a comma is present and no dot, treat comma as the decimal separator.
  if (s.includes(",") && !s.includes(".")) {
    s = s.replace(",", ".");
  }
  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}

function parseDate(raw: string, format?: DateFormat): Date | null {
  const formats = format ? [format] : DATE_FORMATS;
  for (const fmt of formats) {
    const iso = toIso(raw, fmt);
    if (iso) {
      const date = new Date(`${iso}T00:00:00.000Z`);
      if (!isNaN(date.getTime())) return date;
    }
  }
  return null;
}

function toIso(raw: string, format: DateFormat): string | null {
  let m: RegExpMatchArray | null;
  switch (format) {
    case "iso":
      m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
    case "dmy-dot":
      m = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
    case "dmy-dash":
      m = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
    case "dmy-slash":
      m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  }
}
