import { prisma } from "../prisma.js";
import type { Prisma } from "@prisma/client";
import type { ParsedTransaction } from "../services/importers/types.js";

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
