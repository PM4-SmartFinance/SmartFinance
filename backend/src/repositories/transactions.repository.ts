import { prisma } from "../prisma.js";
import { ServiceError } from "../errors.js";

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
} as const;

export async function findById(id: string) {
  return prisma.factTransactions.findUnique({
    where: { id },
    select: TRANSACTION_SELECT,
  });
}

export async function findByIdForUser(id: string, userId: string) {
  const transaction = await prisma.factTransactions.findUnique({
    where: { id },
    select: TRANSACTION_SELECT,
  });
  if (!transaction) {
    throw new ServiceError(404, "Transaction not found");
  }
  if (transaction.userId !== userId) {
    throw new ServiceError(404, "Transaction not found");
  }
  return transaction;
}

export async function updateById(
  id: string,
  userId: string,
  data: { categoryId?: string; notes?: string; manualOverride?: boolean },
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.factTransactions.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!existing) {
      throw new ServiceError(404, "Transaction not found");
    }
    if (existing.userId !== userId) {
      throw new ServiceError(404, "Transaction not found");
    }

    if (data.categoryId !== undefined) {
      const category = await tx.dimCategory.findFirst({
        where: { id: data.categoryId, OR: [{ userId }] },
        select: { id: true },
      });
      if (!category) {
        throw new ServiceError(404, "Category not found");
      }
    }

    return tx.factTransactions.update({
      where: { id },
      data,
      select: TRANSACTION_SELECT,
    });
  });
}

export async function deleteById(id: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.factTransactions.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!existing) {
      throw new ServiceError(404, "Transaction not found");
    }
    if (existing.userId !== userId) {
      throw new ServiceError(404, "Transaction not found");
    }

    await tx.factTransactions.delete({ where: { id } });
  });
}
