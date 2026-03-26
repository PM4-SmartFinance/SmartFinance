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
    const rows: Array<{
      amount: number;
      userId: string;
      accountId: string;
      merchantId: string;
      dateId: number;
    }> = [];

    for (const t of parsed) {
      const dateRecord = await upsertDate(t.date, tx);
      const merchant = await findOrCreateMerchant(t.description, tx);
      rows.push({
        amount: t.amount,
        userId,
        accountId,
        merchantId: merchant.id,
        dateId: dateRecord.id,
      });
    }

    await insertTransactions(rows, tx);
  });

  return parsed.length;
}
