import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { DuplicateAccountError } from "../errors.js";

const ACCOUNT_SELECT = {
  id: true,
  name: true,
  iban: true,
  accountNumber: true,
  active: true,
} as const;

export async function findAccountsByUser(userId: string) {
  return prisma.dimAccount.findMany({
    where: { userId },
    select: ACCOUNT_SELECT,
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

/** Active accounts only — used by import resolution and the import account picker. */
export async function findActiveAccountsByUser(userId: string) {
  return prisma.dimAccount.findMany({
    where: { userId, active: true },
    select: ACCOUNT_SELECT,
    orderBy: { name: "asc" },
  });
}

export async function findById(id: string, userId: string) {
  return prisma.dimAccount.findFirst({
    where: { id, userId },
    select: ACCOUNT_SELECT,
  });
}

/**
 * Matches an active account by its bank-provided account number. Used to
 * auto-resolve a CSV import to the right account when the user has several
 * (KAN-169). The number is normalised (whitespace stripped) on both sides so
 * "1234 5678 9101" matches "12345678 9101".
 */
export async function findActiveAccountByNumberAndUser(accountNumber: string, userId: string) {
  const normalized = accountNumber.replace(/\s+/g, "");
  if (!normalized) return [];
  const accounts = await prisma.dimAccount.findMany({
    where: { userId, active: true, accountNumber: { not: null } },
    select: ACCOUNT_SELECT,
  });
  return accounts.filter((a) => (a.accountNumber ?? "").replace(/\s+/g, "") === normalized);
}

/**
 * Matches an active account by IBAN (KAN-163). IBANs are stored as entered, so
 * both sides are normalised (whitespace stripped, uppercased) before comparing.
 * IBAN is unique per user, so this returns at most one account.
 */
export async function findActiveAccountByIbanAndUser(iban: string, userId: string) {
  const normalized = iban.replace(/\s+/g, "").toUpperCase();
  if (!normalized) return [];
  const accounts = await prisma.dimAccount.findMany({
    where: { userId, active: true },
    select: ACCOUNT_SELECT,
  });
  return accounts.filter((a) => a.iban.replace(/\s+/g, "").toUpperCase() === normalized);
}

/**
 * The account currency is not user-selectable in the UI (KAN-169). Creation
 * defaults to the user's configured default currency, so the service needs to
 * resolve it without reaching across to the user repository for a single field.
 */
export async function findUserDefaultCurrencyId(userId: string): Promise<string | null> {
  const user = await prisma.dimUser.findUnique({
    where: { id: userId },
    select: { defaultCurrencyId: true },
  });
  return user?.defaultCurrencyId ?? null;
}

export async function countTransactions(accountId: string): Promise<number> {
  // Counts every referencing row, including soft-deleted ones: the FK is
  // ON DELETE CASCADE, so a hard delete would also wipe soft-deleted history.
  return prisma.factTransactions.count({ where: { accountId } });
}

export async function create(data: {
  userId: string;
  name: string;
  iban: string;
  currencyId: string;
  accountNumber?: string | null;
}) {
  try {
    return await prisma.dimAccount.create({
      data,
      select: ACCOUNT_SELECT,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new DuplicateAccountError();
    }
    throw err;
  }
}

export async function update(
  id: string,
  userId: string,
  data: { name?: string; iban?: string; accountNumber?: string | null; active?: boolean },
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.dimAccount.findFirst({ where: { id, userId } });
    if (!existing) {
      return null;
    }
    try {
      return await tx.dimAccount.update({
        where: { id },
        data,
        select: ACCOUNT_SELECT,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new DuplicateAccountError();
      }
      // P2025 (record vanished between the findFirst check and this update) means
      // a concurrent delete raced this update inside the transaction. That is
      // exceptional, not a normal "not found" — let it surface rather than
      // silently downgrading it to a 404.
      throw err;
    }
  });
}

export async function remove(id: string, userId: string) {
  const result = await prisma.dimAccount.deleteMany({ where: { id, userId } });
  return result.count > 0;
}
