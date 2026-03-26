import { prisma } from "../prisma.js";

export async function findById(id: string) {
  return prisma.factTransactions.findUnique({
    where: { id },
    select: {
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
    },
  });
}

export async function updateById(
  id: string,
  data: { categoryId?: string; notes?: string; manualOverride?: boolean },
) {
  return prisma.factTransactions.update({
    where: { id },
    data,
    select: {
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
    },
  });
}

export async function deleteById(id: string) {
  return prisma.factTransactions.delete({ where: { id } });
}
