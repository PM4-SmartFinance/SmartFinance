import { parseCSVLine, stripBOM } from "./csv.utils.js";
import { EXPECTED_HEADERS as NEON_HEADERS } from "./neon.parser.js";
import { EXPECTED_HEADERS as ZKB_HEADERS } from "./zkb.parser.js";
import { EXPECTED_HEADERS as WISE_HEADERS } from "./wise.parser.js";
import { EXPECTED_HEADERS as UBS_HEADERS } from "./ubs.parser.js";

/**
 * Header-signature based importer detection (KAN-163).
 *
 * Instead of validating a CSV header by strict, ordered, column-by-column
 * comparison (which throws 422 on any deviation), we score the uploaded
 * header row against each built-in importer's expected columns. A confident,
 * unambiguous match pre-selects that importer; otherwise the caller falls back
 * to letting the user map columns manually.
 */

export interface ImporterSignature {
  format: string;
  label: string;
  /** Delimiter the built-in parser expects; informational only — detection
   *  infers the delimiter from the file itself. */
  delimiter: string;
  headers: string[];
}

export const BUILTIN_SIGNATURES: ImporterSignature[] = [
  { format: "neon", label: "Neon", delimiter: ";", headers: NEON_HEADERS },
  { format: "zkb", label: "ZKB", delimiter: ";", headers: ZKB_HEADERS },
  { format: "wise", label: "Wise", delimiter: ",", headers: WISE_HEADERS },
  { format: "ubs", label: "UBS", delimiter: ";", headers: UBS_HEADERS },
];

/** Minimum fraction of an importer's expected headers that must be present for
 *  a confident match. */
const CONFIDENCE_THRESHOLD = 0.8;
/** A match is only auto-selected if it leads the runner-up by this margin, so
 *  two partially-overlapping formats stay "ambiguous" rather than guessing. */
const AMBIGUITY_MARGIN = 0.15;

const DELIMITER_CANDIDATES = [",", ";", "\t"];

export interface ExtractedTable {
  columns: string[];
  delimiter: string;
  /** Raw data lines (header excluded, sep= line excluded). */
  rows: string[];
}

/**
 * Splits raw CSV text into header columns, delimiter and data rows. Handles the
 * UTF-8 BOM and an Excel-style `sep=;` first line, and infers the delimiter
 * from the header when it is not declared.
 */
export function extractTable(csvText: string): ExtractedTable {
  let lines = stripBOM(csvText)
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");

  let declared: string | null = null;
  if (lines.length > 0 && /^sep=.$/i.test(lines[0]!)) {
    declared = lines[0]!.charAt(4);
    lines = lines.slice(1);
  }

  const headerLine = lines[0] ?? "";
  const delimiter = declared ?? chooseDelimiter(headerLine);
  const columns = headerLine === "" ? [] : parseCSVLine(headerLine, delimiter).map((c) => c.trim());

  return { columns, delimiter, rows: lines.slice(1) };
}

/** Picks the delimiter that splits the header into the most fields. */
function chooseDelimiter(headerLine: string): string {
  let best = DELIMITER_CANDIDATES[0]!;
  let bestCount = -1;
  for (const d of DELIMITER_CANDIDATES) {
    const count = parseCSVLine(headerLine, d).length;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Stable key for a set of columns, used to look up a saved column mapping for a
 * repeat import of the same bank. Order-independent so a reordered export still
 * resolves to the same mapping.
 */
export function headerSignature(columns: string[]): string {
  return columns
    .map(normalizeHeader)
    .filter((c) => c !== "")
    .sort()
    .join("|");
}

/** Fraction of a signature's expected headers present in `columns` (0..1). */
function scoreSignature(columns: string[], signature: ImporterSignature): number {
  if (signature.headers.length === 0) return 0;
  const present = new Set(columns.map(normalizeHeader));
  const matched = signature.headers.filter((h) => present.has(normalizeHeader(h))).length;
  return matched / signature.headers.length;
}

export interface DetectionResult {
  /** Built-in format key when a confident, unambiguous match is found, else null. */
  detectedFormat: string | null;
  /** Confidence of the leading candidate (0..1). */
  confidence: number;
  /** Header columns as read from the file — shown to the user for manual mapping. */
  columns: string[];
  /** Signature used to key a saved mapping. */
  headerSignature: string;
}

export function detectFormat(csvText: string): DetectionResult {
  const { columns } = extractTable(csvText);
  const signature = headerSignature(columns);

  if (columns.length === 0) {
    return { detectedFormat: null, confidence: 0, columns, headerSignature: signature };
  }

  const scored = BUILTIN_SIGNATURES.map((sig) => ({
    format: sig.format,
    confidence: scoreSignature(columns, sig),
  })).sort((a, b) => b.confidence - a.confidence);

  const best = scored[0]!;
  const runnerUp = scored[1]?.confidence ?? 0;

  const isConfident = best.confidence >= CONFIDENCE_THRESHOLD;
  const isUnambiguous = best.confidence - runnerUp >= AMBIGUITY_MARGIN;

  return {
    detectedFormat: isConfident && isUnambiguous ? best.format : null,
    confidence: best.confidence,
    columns,
    headerSignature: signature,
  };
}
