import { prisma } from "../prisma.js";
import { Prisma } from "@prisma/client";
import type { ParsedTransaction } from "../services/importers/types.js";
import { ServiceError } from "../errors.js";
import type { MatchType } from "./category-rule.repository.js";

// Postgres SQLSTATEs we explicitly translate from the raw regex path.
const PG_INVALID_REGEX = "2201B";
const PG_QUERY_CANCELED = "57014";

function mapPostgresRegexError(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const code = (err.meta as { code?: string } | undefined)?.code;
    if (code === PG_INVALID_REGEX) {
      throw new ServiceError(400, "Pattern is not supported by the database regex engine");
    }
    if (code === PG_QUERY_CANCELED) {
      throw new ServiceError(400, "Pattern took too long to evaluate");
    }
  }
  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    if (err.message.includes("invalid regular expression")) {
      throw new ServiceError(400, "Pattern is not supported by the database regex engine");
    }
    if (err.message.includes("canceling statement due to statement timeout")) {
      throw new ServiceError(400, "Pattern took too long to evaluate");
    }
  }
  throw err;
}

const TRANSACTION_SELECT = {
  id: true,
  amount: true,
  notes: true,
  manualOverride: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  accountId: true,
  account: { select: { name: true, iban: true } },
  merchantId: true,
  merchant: { select: { name: true } },
  dateId: true,
  date: { select: { id: true, dayOfWeek: true, month: true, year: true } },
  categoryId: true,
  category: { select: { id: true, categoryName: true } },
  isDeleted: true,
} as const;

export async function findByIdForUser(
  id: string,
  userId: string,
  isAdmin = false,
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma;
  const transaction = await client.factTransactions.findFirst({
    where: { id, isDeleted: false },
    select: TRANSACTION_SELECT,
  });
  if (!transaction) {
    throw new ServiceError(404, "Transaction not found");
  }
  if (!isAdmin && transaction.userId !== userId) {
    throw new ServiceError(404, "Transaction not found");
  }
  return transaction;
}

export async function updateById(
  id: string,
  userId: string,
  data: {
    categoryId?: string | null;
    notes?: string;
    manualOverride?: boolean;
    amount?: number;
    dateId?: number;
  },
  isAdmin = false,
  tx?: Prisma.TransactionClient,
) {
  const run = async (client: Prisma.TransactionClient) => {
    // `findFirst` (not `findUnique`): `isDeleted` is not a unique field, so
    // `findUnique`'s where input would silently ignore the predicate and
    // return already-soft-deleted rows. `findFirst` composes the filter.
    const existing = await client.factTransactions.findFirst({
      where: { id, isDeleted: false },
      select: { id: true, userId: true },
    });
    if (!existing) {
      throw new ServiceError(404, "Transaction not found");
    }
    if (!isAdmin && existing.userId !== userId) {
      throw new ServiceError(404, "Transaction not found");
    }

    // `null` means "clear the category" — no row to validate.
    if (data.categoryId) {
      const category = await client.dimCategory.findFirst({
        where: { id: data.categoryId, userId: isAdmin ? existing.userId : userId },
        select: { id: true },
      });
      if (!category) {
        throw new ServiceError(404, "Category not found");
      }
    }

    return client.factTransactions.update({
      where: { id },
      data,
      select: TRANSACTION_SELECT,
    });
  };
  return tx ? run(tx) : prisma.$transaction(run);
}

export async function deleteById(
  id: string,
  userId: string,
  isAdmin = false,
  tx?: Prisma.TransactionClient,
) {
  const run = async (client: Prisma.TransactionClient) => {
    const existing = await client.factTransactions.findFirst({
      where: { id, isDeleted: false },
      select: { id: true, userId: true },
    });
    if (!existing) {
      throw new ServiceError(404, "Transaction not found");
    }
    if (!isAdmin && existing.userId !== userId) {
      throw new ServiceError(404, "Transaction not found");
    }

    await client.factTransactions.update({
      where: { id },
      data: { isDeleted: true },
    });
    return existing;
  };
  if (tx) await run(tx);
  else await prisma.$transaction(run);
}

export async function findAccountByIdAndUser(accountId: string, userId: string) {
  return prisma.dimAccount.findFirst({ where: { id: accountId, userId } });
}

export async function upsertDate(date: Date, tx: Prisma.TransactionClient) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const id = year * 10000 + month * 100 + day;
  const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

  return tx.dimDate.upsert({
    where: { id },
    update: {},
    create: { id, dayOfWeek, month, year },
  });
}

export async function findOrCreateMerchant(name: string, tx: Prisma.TransactionClient) {
  const existing = await tx.dimMerchant.findFirst({ where: { name } });
  if (existing) return existing;
  return tx.dimMerchant.create({ data: { name } });
}

export async function insertTransactions(
  rows: Array<{
    amount: number;
    userId: string;
    accountId: string;
    merchantId: string;
    dateId: number;
  }>,
  tx: Prisma.TransactionClient,
) {
  await tx.factTransactions.createMany({ data: rows.map((r) => ({ ...r, isDeleted: false })) });
}

// A full 50,000-row import (the supported maximum) runs in a single
// all-or-nothing transaction and takes well over Prisma's 5s interactive
// default, which otherwise aborts the commit with P2028. Size the timeout to
// the target import volume with headroom.
const BULK_IMPORT_TIMEOUT_MS = 120_000;
const BULK_IMPORT_MAX_WAIT_MS = 15_000;

export async function bulkImport(
  parsed: ParsedTransaction[],
  userId: string,
  accountId: string,
): Promise<number> {
  await prisma.$transaction(
    async (tx) => {
      // 1. Deduplicate and upsert dates
      const uniqueDates = new Map<number, Date>();
      for (const t of parsed) {
        const year = t.date.getUTCFullYear();
        const month = t.date.getUTCMonth() + 1;
        const day = t.date.getUTCDate();
        const id = year * 10000 + month * 100 + day;
        if (!uniqueDates.has(id)) uniqueDates.set(id, t.date);
      }
      await Promise.all([...uniqueDates.values()].map((date) => upsertDate(date, tx)));

      // 2. Deduplicate and find-or-create merchants
      const uniqueMerchantNames = new Set(parsed.map((t) => t.description));
      const merchants = await Promise.all(
        [...uniqueMerchantNames].map((name) => findOrCreateMerchant(name, tx)),
      );
      const merchantByName = new Map(merchants.map((m) => [m.name, m.id]));

      // 3. Build rows (sync lookups only)
      const rows = parsed.map((t) => {
        const year = t.date.getUTCFullYear();
        const month = t.date.getUTCMonth() + 1;
        const day = t.date.getUTCDate();
        return {
          amount: t.amount,
          userId,
          accountId,
          merchantId: merchantByName.get(t.description)!,
          dateId: year * 10000 + month * 100 + day,
        };
      });

      // 4. Bulk insert
      await insertTransactions(rows, tx);
    },
    { timeout: BULK_IMPORT_TIMEOUT_MS, maxWait: BULK_IMPORT_MAX_WAIT_MS },
  );

  return parsed.length;
}

export async function findUncategorizedForUser(userId: string) {
  return prisma.factTransactions.findMany({
    where: { userId, categoryId: null, manualOverride: false, isDeleted: false },
    select: {
      id: true,
      amount: true,
      dateId: true,
      merchant: { select: { name: true } },
    },
  });
}

export async function findCategorizableInRange(
  userId: string,
  startDateId: number,
  endDateId: number,
) {
  return prisma.factTransactions.findMany({
    where: {
      userId,
      manualOverride: false,
      isDeleted: false,
      dateId: { gte: startDateId, lte: endDateId },
    },
    select: {
      id: true,
      amount: true,
      dateId: true,
      categoryId: true,
      merchant: { select: { name: true } },
    },
  });
}

export async function findPreviewMatchesForUser(
  userId: string,
  pattern: string,
  matchType: MatchType,
  sampleLimit = 3,
): Promise<{
  matchCount: number;
  matchedTransactions: Array<{
    id: string;
    merchantName: string;
    amount: number;
    dateId: number;
  }>;
}> {
  if (matchType === "regex") {
    type RegexCountRow = { count: bigint };
    type RegexTxRow = { id: string; amount: number; dateId: number; merchantName: string };
    try {
      // Bound the regex evaluation so a pathological pattern can't tie up
      // the Postgres backend. statement_timeout is scoped to the tx.
      const { countRows, sampleRows } = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '2s'`);
        const countRows = await tx.$queryRaw<RegexCountRow[]>`
          SELECT COUNT(*)::bigint AS count
          FROM "FactTransactions" ft
          JOIN "DimMerchant" dm ON ft."merchantId" = dm.id
          WHERE ft."userId" = ${userId}
            AND ft."categoryId" IS NULL
            AND ft."manualOverride" = false
            AND ft."isDeleted" = false
            AND dm.name ~* ${pattern}
        `;
        const sampleRows = await tx.$queryRaw<RegexTxRow[]>`
          SELECT ft.id,
                 ft.amount::double precision AS amount,
                 ft."dateId",
                 dm.name AS "merchantName"
          FROM "FactTransactions" ft
          JOIN "DimMerchant" dm ON ft."merchantId" = dm.id
          WHERE ft."userId" = ${userId}
            AND ft."categoryId" IS NULL
            AND ft."manualOverride" = false
            AND ft."isDeleted" = false
            AND dm.name ~* ${pattern}
          ORDER BY ft."dateId" DESC, ft.id ASC
          LIMIT ${sampleLimit}
        `;
        return { countRows, sampleRows };
      });
      return {
        matchCount: Number(countRows[0]?.count ?? 0),
        matchedTransactions: sampleRows.map((tx) => ({
          id: tx.id,
          merchantName: tx.merchantName,
          amount: Number(tx.amount),
          dateId: tx.dateId,
        })),
      };
    } catch (err) {
      mapPostgresRegexError(err);
    }
  }

  const nameFilter: Prisma.DimMerchantWhereInput =
    matchType === "exact"
      ? { name: { equals: pattern, mode: "insensitive" } }
      : { name: { contains: pattern, mode: "insensitive" } };

  const where: Prisma.FactTransactionsWhereInput = {
    userId,
    categoryId: null,
    manualOverride: false,
    merchant: nameFilter,
    isDeleted: false,
  };

  const [matchCount, rows] = await prisma.$transaction([
    prisma.factTransactions.count({ where }),
    prisma.factTransactions.findMany({
      where,
      take: sampleLimit,
      orderBy: [{ dateId: "desc" }, { id: "asc" }],
      select: {
        id: true,
        amount: true,
        dateId: true,
        merchant: { select: { name: true } },
      },
    }),
  ]);

  return {
    matchCount,
    matchedTransactions: rows.map((tx) => ({
      id: tx.id,
      merchantName: tx.merchant.name,
      amount: tx.amount.toNumber(),
      dateId: tx.dateId,
    })),
  };
}

// Postgres has a hard limit of ~65k bind parameters per query (libpq protocol).
// Chunking the `id: { in: [...] }` lists keeps us safely under that limit and
// avoids holding row locks on tens of thousands of rows in a single statement.
const BULK_UPDATE_CHUNK_SIZE = 1000;

export async function bulkSetCategory(
  userId: string,
  updates: Array<{ id: string; categoryId: string }>,
): Promise<number> {
  if (updates.length === 0) return 0;

  // Group by categoryId for efficient batch updates
  const byCategory = new Map<string, string[]>();
  for (const { id, categoryId } of updates) {
    const ids = byCategory.get(categoryId) ?? [];
    ids.push(id);
    byCategory.set(categoryId, ids);
  }

  const statements = [];
  for (const [categoryId, ids] of byCategory) {
    for (let i = 0; i < ids.length; i += BULK_UPDATE_CHUNK_SIZE) {
      const chunk = ids.slice(i, i + BULK_UPDATE_CHUNK_SIZE);
      statements.push(
        prisma.factTransactions.updateMany({
          // `manualOverride: false` is a defense-in-depth guard: a user could
          // toggle the flag between `findUncategorizedForUser` and this write,
          // and we must never silently overwrite a manually-chosen category.
          where: { id: { in: chunk }, userId, manualOverride: false, isDeleted: false },
          data: { categoryId },
        }),
      );
    }
  }

  const results = await prisma.$transaction(statements);
  return results.reduce((sum, r) => sum + r.count, 0);
}

/**
 * Clears the category on every transaction that belongs to the given
 * user/category pair, restoring the post-import "uncategorized" state.
 * Also resets `manualOverride` so that the next auto-categorize run can
 * re-evaluate the row — the user explicitly asked to discard the prior
 * assignment, manual or otherwise.
 */
export async function clearCategoryAssignments(
  userId: string,
  categoryId: string,
): Promise<number> {
  const result = await prisma.factTransactions.updateMany({
    where: { userId, categoryId, isDeleted: false },
    data: { categoryId: null, manualOverride: false },
  });
  return result.count;
}

export interface ListTransactionsArgs {
  userId: string;
  skip: number;
  take: number;
  orderBy: Prisma.FactTransactionsOrderByWithRelationInput;
  where: Prisma.FactTransactionsWhereInput;
}

export async function listTransactions(args: ListTransactionsArgs) {
  const { userId, skip, take, orderBy, where } = args;
  const whereWithDeleted = { ...where, isDeleted: false };
  return prisma.$transaction([
    prisma.factTransactions.findMany({
      where: whereWithDeleted,
      orderBy,
      skip,
      take,
      select: {
        id: true,
        amount: true,
        dateId: true,
        accountId: true,
        categoryId: true,
        category: {
          select: { id: true, categoryName: true },
        },
        merchant: {
          select: {
            id: true,
            name: true,
            mappings: {
              where: { userId },
              select: {
                category: {
                  select: { id: true, categoryName: true },
                },
              },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.factTransactions.count({ where: whereWithDeleted }),
  ]);
}
