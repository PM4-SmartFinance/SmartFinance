import type { ImportFormat } from "../import.service.js";

export interface AccountHint {
  iban?: string;
  accountNumber?: string;
}

/**
 * Extracts a target-account hint from raw CSV text so the import service can
 * resolve which user account a CSV belongs to without an explicit accountId.
 *
 * Returns null for every supported format today — none expose the user's own
 * IBAN in transaction rows. UBS rows carry a Kontonummer (column 0) that is a
 * future extension point: once dimAccount gains an accountNumber field and a
 * findAccountByAccountNumberAndUser repository helper exists, return
 * { accountNumber } here for `format === "ubs"`.
 */
export function extractAccountHint(csvText: string, format: ImportFormat): AccountHint | null {
  void csvText;
  void format;
  return null;
}
