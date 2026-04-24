import { prisma } from "../prisma.js";
import type { Prisma } from "@prisma/client";
import type { ParsedTransaction } from "../services/importers/types.js";
import type { MatchType } from "./category-rule.repository.js";

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
  await tx.factTransactions.createMany({ data: rows });
}

export async function bulkImport(
  parsed: ParsedTransaction[],
  userId: string,
  accountId: string,
): Promise<number> {
  await prisma.$transaction(async (tx) => {
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
  });

  return parsed.length;
}

export async function findUncategorizedForUser(userId: string) {
  return prisma.factTransactions.findMany({
    where: { userId, categoryId: null, manualOverride: false },
    select: {
      id: true,
      amount: true,
      dateId: true,
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
  const nameFilter: Prisma.DimMerchantWhereInput =
    matchType === "exact"
      ? { name: { equals: pattern, mode: "insensitive" } }
      : { name: { contains: pattern, mode: "insensitive" } };

  const where: Prisma.FactTransactionsWhereInput = {
    userId,
    categoryId: null,
    manualOverride: false,
    merchant: nameFilter,
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
          where: { id: { in: chunk }, userId, manualOverride: false },
          data: { categoryId },
        }),
      );
    }
  }

  const results = await prisma.$transaction(statements);
  return results.reduce((sum, r) => sum + r.count, 0);
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
  return prisma.$transaction([
    prisma.factTransactions.findMany({
      where,
      orderBy,
      skip,
      take,
      select: {
        id: true,
        amount: true,
        dateId: true,
        accountId: true,
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
    prisma.factTransactions.count({ where }),
  ]);
}
