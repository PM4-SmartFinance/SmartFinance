import { ServiceError } from "../errors.js";
import { parseNeonCSV } from "./importers/neon.parser.js";
import { parseZKBCSV } from "./importers/zkb.parser.js";
import { parseWiseCSV } from "./importers/wise.parser.js";
import { parseUBSCSV } from "./importers/ubs.parser.js";
import * as transactionRepository from "../repositories/transaction.repository.js";
import { autoCategorize } from "./categorization.service.js";

export const SUPPORTED_FORMATS = ["neon", "zkb", "wise", "ubs"] as const;
export type ImportFormat = (typeof SUPPORTED_FORMATS)[number];

/**
 * Minimal structured logger interface used by the import service.
 * Kept framework-agnostic so the service does not depend on Fastify types,
 * while still allowing the controller to pass `request.log` (Pino).
 */
export interface ImportLogger {
  warn(obj: Record<string, unknown>, msg: string): void;
}

interface ImportParams {
  csvText: string;
  format: ImportFormat;
  accountId: string;
  userId: string;
  logger: ImportLogger;
}

export async function importTransactions({
  csvText,
  format,
  accountId,
  userId,
  logger,
}: ImportParams): Promise<{ imported: number; categorized: number }> {
  const account = await transactionRepository.findAccountByIdAndUser(accountId, userId);
  if (!account) {
    throw new ServiceError(404, "Account not found");
  }

  let parsed;
  if (format === "neon") {
    parsed = parseNeonCSV(csvText);
  } else if (format === "zkb") {
    parsed = parseZKBCSV(csvText);
  } else if (format === "wise") {
    parsed = parseWiseCSV(csvText);
  } else if (format === "ubs") {
    parsed = parseUBSCSV(csvText);
  } else {
    throw new ServiceError(400, `Unsupported import format: ${format}`);
  }

  if (parsed.length === 0) {
    return { imported: 0, categorized: 0 };
  }

  const imported = await transactionRepository.bulkImport(parsed, userId, accountId);

  // Best-effort: the import transaction has already committed, so a categorization
  // failure here must not be reported as an import failure. Errors are logged via
  // the injected structured logger; users can always retry via
  // POST /transactions/auto-categorize.
  let categorized = 0;
  try {
    const result = await autoCategorize(userId);
    categorized = result.categorized;
  } catch (err) {
    logger.warn({ err, userId }, "post-import auto-categorize failed");
  }

  return { imported, categorized };
}
