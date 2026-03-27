import { ServiceError } from "../errors.js";
import { parseNeonCSV } from "./importers/neon.parser.js";
import { parseZKBCSV } from "./importers/zkb.parser.js";
import { parseWiseCSV } from "./importers/wise.parser.js";
import * as transactionRepository from "../repositories/transaction.repository.js";

export const SUPPORTED_FORMATS = ["neon", "zkb", "wise"] as const;
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
  } else {
    throw new ServiceError(400, `Unsupported import format: ${format}`);
  }

  if (parsed.length === 0) {
    return { imported: 0 };
  }

  const imported = await transactionRepository.bulkImport(parsed, userId, accountId);
  return { imported };
}
