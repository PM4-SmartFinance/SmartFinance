import { ServiceError } from "../errors.js";
import { parseNeonCSV } from "./importers/neon.parser.js";
import { parseZKBCSV } from "./importers/zkb.parser.js";
import { parseWiseCSV } from "./importers/wise.parser.js";
import { parseUBSCSV } from "./importers/ubs.parser.js";
import * as transactionRepository from "../repositories/transaction.repository.js";
import { autoCategorize } from "./categorization.service.js";

export const SUPPORTED_FORMATS = ["neon", "zkb", "wise", "ubs"] as const;
export type ImportFormat = (typeof SUPPORTED_FORMATS)[number];

interface ImportParams {
  csvText: string;
  format: ImportFormat;
  accountId: string;
  userId: string;
}

export async function importTransactions({
  csvText,
  format,
  accountId,
  userId,
}: ImportParams): Promise<{ imported: number }> {
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
    return { imported: 0 };
  }

  const imported = await transactionRepository.bulkImport(parsed, userId, accountId);
  // Best-effort: do not let a categorization failure roll back a committed import.
  // Users can retry via POST /transactions/auto-categorize.
  autoCategorize(userId).catch((err: unknown) => {
    console.warn("[import] post-import auto-categorize failed for user", userId, err);
  });
  return { imported };
}
