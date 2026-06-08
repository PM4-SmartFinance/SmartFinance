import { DuplicateAccountError, ServiceError } from "../errors.js";
import * as accountRepository from "../repositories/account.repository.js";

export async function getAccountsByUser(userId: string) {
  return accountRepository.findAccountsByUser(userId);
}

export async function getAccount(id: string, userId: string) {
  const account = await accountRepository.findById(id, userId);
  if (!account) {
    throw new ServiceError(404, "Account not found");
  }
  return account;
}

export async function createAccount(
  userId: string,
  data: { name: string; iban: string; accountNumber?: string | null },
) {
  // Currency is not user-selectable (KAN-169): default to the user's configured
  // default currency. A user always has one (set at creation / seeded).
  const currencyId = await accountRepository.findUserDefaultCurrencyId(userId);
  if (!currencyId) {
    throw new ServiceError(400, "No default currency configured for this user");
  }

  try {
    return await accountRepository.create({
      userId,
      name: data.name,
      iban: data.iban,
      currencyId,
      ...(data.accountNumber !== undefined ? { accountNumber: data.accountNumber } : {}),
    });
  } catch (err) {
    if (err instanceof DuplicateAccountError) {
      throw new ServiceError(409, err.message);
    }
    throw err;
  }
}

/**
 * Updates an account's editable fields. `active: false` deactivates the account
 * (its transactions stay in the DB but are hidden from the transactions view and
 * excluded from import resolution); `active: true` reactivates it (KAN-169).
 */
export async function updateAccount(
  id: string,
  userId: string,
  data: { name?: string; iban?: string; accountNumber?: string | null; active?: boolean },
) {
  try {
    const account = await accountRepository.update(id, userId, data);
    if (!account) {
      throw new ServiceError(404, "Account not found");
    }
    return account;
  } catch (err) {
    if (err instanceof DuplicateAccountError) {
      throw new ServiceError(409, err.message);
    }
    throw err;
  }
}

export async function deleteAccount(id: string, userId: string) {
  const account = await accountRepository.findById(id, userId);
  if (!account) {
    throw new ServiceError(404, "Account not found");
  }

  // The FactTransactions → DimAccount FK is ON DELETE CASCADE, so deleting an
  // account would silently destroy every transaction (including soft-deleted
  // history) that references it. Block the delete instead and let the user
  // reassign or remove the transactions first (KAN-169 delete policy).
  const transactionCount = await accountRepository.countTransactions(id);
  if (transactionCount > 0) {
    throw new ServiceError(
      409,
      "Cannot delete an account that still has transactions. Delete or reassign its transactions first.",
      { code: "ACCOUNT_HAS_TRANSACTIONS", transactionCount },
    );
  }

  await accountRepository.remove(id, userId);
}
