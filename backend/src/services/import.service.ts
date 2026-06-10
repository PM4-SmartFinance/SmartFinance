import { ServiceError } from "../errors.js";
import { parseNeonCSV } from "./importers/neon.parser.js";
import { parseZKBCSV } from "./importers/zkb.parser.js";
import { parseWiseCSV } from "./importers/wise.parser.js";
import { parseUBSCSV } from "./importers/ubs.parser.js";
import * as transactionRepository from "../repositories/transaction.repository.js";
import * as accountRepository from "../repositories/account.repository.js";
import { extractAccountHint, extractIbanFromCsv } from "./importers/account-hint.js";
import { autoCategorize } from "./categorization.service.js";
import { importOperations, transactionsImported } from "../metrics/business-metrics.js";
import { fireTransactionImported } from "./module-registry.service.js";
import { getImporter } from "./importer-registry.service.js";
import {
  detectFormat,
  extractTable,
  extractSampleRow,
  headerSignature,
} from "./importers/detect.js";
import { parseWithMapping, type ColumnMapping } from "./importers/generic.parser.js";
import type { ParsedTransaction } from "./importers/types.js";
import * as importMappingRepository from "../repositories/import-mapping.repository.js";

export interface DuplicateTransaction {
  /** ISO date string, so the wizard can echo it back to force-import. */
  date: string;
  amount: number;
  description: string;
  subject: string;
}

function toDateId(date: Date): number {
  return date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
}

// Duplicate key: same account (caller-scoped), date, amount and merchant.
function dedupKey(dateId: number, amount: number, merchant: string): string {
  return `${dateId}|${amount.toFixed(2)}|${merchant}`;
}

export const SUPPORTED_FORMATS = ["neon", "zkb", "wise", "ubs"] as const;
export type ImportFormat = (typeof SUPPORTED_FORMATS)[number];

const FORMAT_ENCODING: Record<ImportFormat, string> = {
  neon: "utf-8",
  zkb: "utf-8",
  wise: "utf-8",
  ubs: "iso-8859-1",
};

export function resolveImportEncoding(format: string): string {
  if ((SUPPORTED_FORMATS as readonly string[]).includes(format)) {
    return FORMAT_ENCODING[format as ImportFormat];
  }
  const plugin = getImporter(format);
  return plugin?.encoding ?? "utf-8";
}

export interface ImportLogger {
  warn(obj: Record<string, unknown>, msg: string): void;
}

interface ImportParams {
  csvText: string;
  format: string;
  /** When provided, the CSV is parsed via the generic mapping-driven parser and
   *  the mapping is persisted by header signature for reuse (KAN-163). */
  mapping?: ColumnMapping | undefined;
  /** Optional user-given name to store with the mapping, making it a reusable
   *  named option in the wizard. */
  mappingName?: string | null | undefined;
  accountId?: string | undefined;
  userId: string;
  logger: ImportLogger;
}

export interface DetectImportResult {
  detectedFormat: string | null;
  confidence: number;
  columns: string[];
  headerSignature: string;
  /** First data row, aligned with `columns`, for the wizard's mapping preview. */
  sampleRow: string[];
  /** Previously saved mapping for this header signature, if any. */
  savedMapping: ColumnMapping | null;
  /** Name of the saved mapping for this signature, if it was named. */
  savedMappingName: string | null;
  /** Account the CSV most likely belongs to, for pre-selecting the wizard's
   *  account dropdown. Null when nothing matched (KAN-163). */
  suggestedAccountId: string | null;
}

/** Lists the user's named, reusable column mappings for the wizard dropdown. */
export async function listImportMappings(userId: string) {
  return importMappingRepository.findNamedByUser(userId);
}

/**
 * Suggests the account a CSV belongs to: IBAN match → account-number hint →
 * the user's single active account → null. Read-only (KAN-163).
 */
async function suggestAccountId(params: {
  csvText: string;
  format: string;
  userId: string;
}): Promise<string | null> {
  const { csvText, format, userId } = params;

  const iban = extractIbanFromCsv(csvText);
  if (iban) {
    const matches = await accountRepository.findActiveAccountByIbanAndUser(iban, userId);
    if (matches.length === 1) return matches[0]!.id;
  }

  const hint = extractAccountHint(csvText, format);
  if (hint?.accountNumber) {
    const matches = await accountRepository.findActiveAccountByNumberAndUser(
      hint.accountNumber,
      userId,
    );
    if (matches.length === 1) return matches[0]!.id;
  }

  const accounts = await accountRepository.findActiveAccountsByUser(userId);
  if (accounts.length === 1) return accounts[0]!.id;

  return null;
}

/**
 * Inspects an uploaded CSV header and returns a detection verdict, any saved
 * column mapping for the same header signature, and a suggested account.
 * Read-only: never persists transactions (KAN-163).
 */
export async function detectImport(params: {
  csvText: string;
  userId: string;
}): Promise<DetectImportResult> {
  const detection = detectFormat(params.csvText);
  const saved = await importMappingRepository.findBySignature(
    params.userId,
    detection.headerSignature,
  );
  const suggestedAccountId = await suggestAccountId({
    csvText: params.csvText,
    format: detection.detectedFormat ?? "",
    userId: params.userId,
  });
  return {
    detectedFormat: detection.detectedFormat,
    confidence: detection.confidence,
    columns: detection.columns,
    headerSignature: detection.headerSignature,
    sampleRow: extractSampleRow(params.csvText),
    savedMapping: saved?.mapping ?? null,
    savedMappingName: saved?.name ?? null,
    suggestedAccountId,
  };
}

interface AccountCandidate {
  id: string;
  name: string;
  iban: string;
}

async function resolveAccountId(params: {
  format: string;
  csvText: string;
  providedAccountId?: string | undefined;
  userId: string;
}): Promise<string> {
  const { format, csvText, providedAccountId, userId } = params;

  if (providedAccountId) {
    const account = await transactionRepository.findAccountByIdAndUser(providedAccountId, userId);
    if (!account) {
      throw new ServiceError(404, "Account not found");
    }
    return account.id;
  }

  // Only active accounts participate in resolution — deactivated accounts must
  // never silently receive an import (KAN-169).
  const accounts = await accountRepository.findActiveAccountsByUser(userId);

  if (accounts.length === 0) {
    throw new ServiceError(409, "No account available for this user.", {
      code: "NO_MATCH",
      candidates: [],
    });
  }
  if (accounts.length === 1) {
    return accounts[0]!.id;
  }

  // Several active accounts: try to auto-match the CSV to a specific one via the
  // account identifier the file carries (e.g. UBS Kontonummer) before asking the
  // user to choose.
  const hint = extractAccountHint(csvText, format);
  if (hint?.accountNumber) {
    const matches = await accountRepository.findActiveAccountByNumberAndUser(
      hint.accountNumber,
      userId,
    );
    if (matches.length === 1) {
      return matches[0]!.id;
    }
  }

  const candidates: AccountCandidate[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    iban: a.iban,
  }));
  throw new ServiceError(409, "Multiple accounts available. Choose one and retry.", {
    code: "AMBIGUOUS_ACCOUNT",
    candidates,
  });
}

export async function importTransactions({
  csvText,
  format,
  mapping,
  mappingName,
  accountId,
  userId,
  logger,
}: ImportParams): Promise<{
  imported: number;
  categorized: number;
  duplicates: DuplicateTransaction[];
}> {
  try {
    const resolvedAccountId = await resolveAccountId({
      format,
      csvText,
      providedAccountId: accountId,
      userId,
    });

    let parsed;
    if (mapping) {
      parsed = parseWithMapping(csvText, mapping);
    } else if (format === "neon") {
      parsed = parseNeonCSV(csvText);
    } else if (format === "zkb") {
      parsed = parseZKBCSV(csvText);
    } else if (format === "wise") {
      parsed = parseWiseCSV(csvText);
    } else if (format === "ubs") {
      parsed = parseUBSCSV(csvText);
    } else {
      const plugin = getImporter(format);
      if (!plugin) throw new ServiceError(400, `Unsupported import format: ${format}`);
      parsed = plugin.parse(csvText);
    }

    if (parsed.length === 0) {
      return { imported: 0, categorized: 0, duplicates: [] };
    }

    // Skip rows that duplicate a live transaction already on this account (same
    // date, amount and merchant). Skipped rows are returned so the user can
    // review and force-import them (KAN-163).
    const existingKeys = new Set(
      (await transactionRepository.findTransactionKeysForAccount(resolvedAccountId)).map((e) =>
        dedupKey(e.dateId, Number(e.amount), e.merchantName),
      ),
    );
    const toImport: ParsedTransaction[] = [];
    const duplicates: DuplicateTransaction[] = [];
    for (const t of parsed) {
      if (existingKeys.has(dedupKey(toDateId(t.date), t.amount, t.description))) {
        duplicates.push({
          date: t.date.toISOString(),
          amount: t.amount,
          description: t.description,
          subject: t.subject,
        });
      } else {
        toImport.push(t);
      }
    }

    const imported =
      toImport.length > 0
        ? await transactionRepository.bulkImport(toImport, userId, resolvedAccountId)
        : 0;
    transactionsImported.inc({ format }, imported);
    importOperations.inc({ format, outcome: "success" });

    // Persist a successful manual mapping so a repeat import of the same bank
    // reuses it. Best-effort: a storage failure must not fail the import.
    if (mapping) {
      try {
        const signature = headerSignature(extractTable(csvText).columns);
        if (signature) {
          await importMappingRepository.upsertMapping({
            userId,
            headerSignature: signature,
            name: mappingName ?? null,
            mapping,
          });
        }
      } catch (err) {
        logger.warn({ err, userId }, "post-import persist column mapping failed");
      }
    }

    try {
      await fireTransactionImported({ userId, accountId: resolvedAccountId, imported });
    } catch (err) {
      logger.warn(
        { err, userId, accountId: resolvedAccountId },
        "post-import fireTransactionImported failed",
      );
    }

    let categorized = 0;
    try {
      const result = await autoCategorize(userId);
      categorized = result.categorized;
    } catch (err) {
      logger.warn({ err, userId }, "post-import auto-categorize failed");
    }

    return { imported, categorized, duplicates };
  } catch (err) {
    const outcome =
      err instanceof ServiceError && err.statusCode < 500 ? "failed_user" : "failed_system";
    importOperations.inc({ format, outcome });
    throw err;
  }
}

/**
 * Imports transactions the user explicitly chose to keep despite being flagged
 * as duplicates — no dedup is applied (KAN-163).
 */
export async function forceImport(params: {
  userId: string;
  accountId: string;
  transactions: Array<{ date: string; amount: number; description: string; subject?: string }>;
  logger: ImportLogger;
}): Promise<{ imported: number; categorized: number }> {
  const { userId, accountId, transactions, logger } = params;

  const account = await transactionRepository.findAccountByIdAndUser(accountId, userId);
  if (!account) throw new ServiceError(404, "Account not found");
  if (transactions.length === 0) return { imported: 0, categorized: 0 };

  const parsed: ParsedTransaction[] = transactions.map((t) => {
    const date = new Date(t.date);
    if (isNaN(date.getTime())) throw new ServiceError(400, `Invalid date: ${t.date}`);
    return { date, amount: t.amount, description: t.description, subject: t.subject ?? "" };
  });

  const imported = await transactionRepository.bulkImport(parsed, userId, account.id);
  transactionsImported.inc({ format: "custom" }, imported);

  try {
    await fireTransactionImported({ userId, accountId: account.id, imported });
  } catch (err) {
    logger.warn(
      { err, userId, accountId: account.id },
      "post-import fireTransactionImported failed",
    );
  }

  let categorized = 0;
  try {
    categorized = (await autoCategorize(userId)).categorized;
  } catch (err) {
    logger.warn({ err, userId }, "post-import auto-categorize failed");
  }

  return { imported, categorized };
}
