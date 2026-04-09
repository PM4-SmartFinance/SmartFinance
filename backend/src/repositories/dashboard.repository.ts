import { prisma } from "../prisma.js";

function dateStringToId(dateStr: string): number {
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

interface ListMonthlyTrendsArgs {
  userId: string;
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
}

export interface MonthlyTrendAggregate {
  year: number;
  month: number;
  income: number;
  expenses: number;
}

export async function listMonthlyTrends(
  args: ListMonthlyTrendsArgs,
): Promise<MonthlyTrendAggregate[]> {
  const { userId, startYear, startMonth, endYear, endMonth } = args;

  const rows = await prisma.$queryRaw<MonthlyTrendAggregate[]>`
    SELECT
      d.year::int AS year,
      d.month::int AS month,
      ROUND(COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0), 2)::double precision AS income,
      ROUND(COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0), 2)::double precision AS expenses
    FROM "FactTransactions" t
    INNER JOIN "DimDate" d ON d.id = t."dateId"
    WHERE t."userId" = ${userId}
      AND (d.year > ${startYear} OR (d.year = ${startYear} AND d.month >= ${startMonth}))
      AND (d.year < ${endYear} OR (d.year = ${endYear} AND d.month <= ${endMonth}))
    GROUP BY d.year, d.month
    ORDER BY d.year ASC, d.month ASC
  `;

  return rows.map((r) => ({
    year: Number(r.year),
    month: Number(r.month),
    income: Number(r.income),
    expenses: Number(r.expenses),
  }));
}
