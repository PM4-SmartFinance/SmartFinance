import { ServiceError } from "../errors.js";
import { parseNeonCSV } from "./importers/neon.parser.js";
import { parseZKBCSV } from "./importers/zkb.parser.js";
import { parseWiseCSV } from "./importers/wise.parser.js";
import { parseUBSCSV } from "./importers/ubs.parser.js";
import { extractAccountHint } from "./importers/account-hint.js";
import * as transactionRepository from "../repositories/transaction.repository.js";
import * as accountRepository from "../repositories/account.repository.js";
import { autoCategorize } from "./categorization.service.js";
import { importOperations, transactionsImported } from "../metrics/business-metrics.js";

export const SUPPORTED_FORMATS = ["neon", "zkb", "wise", "ubs"] as const;
export type ImportFormat = (typeof SUPPORTED_FORMATS)[number];

export interface ImportLogger {
  warn(obj: Record<string, unknown>, msg: string): void;
}

interface ImportParams {
  csvText: string;
  format: ImportFormat;
  accountId?: string | undefined;
  userId: string;
  logger: ImportLogger;
}

interface AccountCandidate {
  id: string;
  name: string;
  iban: string;
}

async function resolveAccountId(params: {
  csvText: string;
  format: ImportFormat;
  providedAccountId?: string | undefined;
  userId: string;
}): Promise<string> {
  const { csvText, format, providedAccountId, userId } = params;

  if (providedAccountId) {
    const account = await transactionRepository.findAccountByIdAndUser(providedAccountId, userId);
    if (!account) {
      throw new ServiceError(404, "Account not found");
    }
    return account.id;
  }

  // Future extension point: a non-null hint can drive an IBAN/account-number
  // lookup. Today this always returns null (see account-hint.ts).
  extractAccountHint(csvText, format);

  const accounts: AccountCandidate[] = await accountRepository.findAccountsByUser(userId);
  if (accounts.length === 1) {
    return accounts[0]!.id;
  }
  if (accounts.length === 0) {
    throw new ServiceError(409, "No account available for this user.", {
      code: "NO_MATCH",
      candidates: [],
    });
  }
  throw new ServiceError(409, "Multiple accounts available. Choose one and retry.", {
    code: "AMBIGUOUS_ACCOUNT",
    candidates: accounts,
  });
}

export async function importTransactions({
  csvText,
  format,
  accountId,
  userId,
  logger,
}: ImportParams): Promise<{ imported: number; categorized: number }> {
  try {
    const resolvedAccountId = await resolveAccountId({
      csvText,
      format,
      providedAccountId: accountId,
      userId,
    });

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

    const imported = await transactionRepository.bulkImport(parsed, userId, resolvedAccountId);
    transactionsImported.inc({ format }, imported);
    importOperations.inc({ format, outcome: "success" });

    let categorized = 0;
    try {
      const result = await autoCategorize(userId);
      categorized = result.categorized;
    } catch (err) {
      logger.warn({ err, userId }, "post-import auto-categorize failed");
    }

    return { imported, categorized };
  } catch (err) {
    const outcome =
      err instanceof ServiceError && err.statusCode < 500 ? "failed_user" : "failed_system";
    importOperations.inc({ format, outcome });
    throw err;
  }
}
