import { prisma } from "../prisma.js";

export interface DashboardTransactionRecord {
  amount: string;
  merchantId: string;
  categoryName: string | null;
  month: number;
  year: number;
}

export interface DashboardMerchantCategoryRecord {
  merchantId: string;
  categoryName: string;
}

function toDateId(date: string): number {
  return Number(date.replaceAll("-", ""));
}

export async function listTransactionsForPeriod(
  userId: string,
  startDate: string,
  endDate: string,
) {
  const startId = toDateId(startDate);
  const endId = toDateId(endDate);

  return prisma.factTransactions.findMany({
    where: {
      userId,
      dateId: {
        gte: startId,
        lte: endId,
      },
    },
    select: {
      amount: true,
      merchantId: true,
      category: {
        select: {
          categoryName: true,
        },
      },
      date: {
        select: {
          month: true,
          year: true,
        },
      },
    },
    orderBy: {
      dateId: "asc",
    },
  });
}

export async function listMerchantCategories(userId: string) {
  return prisma.userMerchantMapping.findMany({
    where: { userId },
    select: {
      merchantId: true,
      category: {
        select: {
          categoryName: true,
        },
      },
    },
  });
}
