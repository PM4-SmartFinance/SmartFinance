import { prisma } from "../prisma.js";

export function dateStringToId(dateStr: string): number {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  return Number(yearStr) * 10000 + Number(monthStr) * 100 + Number(dayStr);
}

export async function getSummary(userId: string, startDate: string, endDate: string) {
  const startId = dateStringToId(startDate);
  const endId = dateStringToId(endDate);

  const [incomeAgg, expenseAgg, transactionCount] = await Promise.all([
    prisma.factTransactions.aggregate({
      where: { userId, dateId: { gte: startId, lte: endId }, amount: { gt: 0 } },
      _sum: { amount: true },
    }),
    prisma.factTransactions.aggregate({
      where: { userId, dateId: { gte: startId, lte: endId }, amount: { lt: 0 } },
      _sum: { amount: true },
    }),
    prisma.factTransactions.count({
      where: { userId, dateId: { gte: startId, lte: endId } },
    }),
  ]);

  return { incomeAgg, expenseAgg, transactionCount };
}
