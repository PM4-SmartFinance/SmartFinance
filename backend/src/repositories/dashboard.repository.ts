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

export interface CategoryTotalAggregate {
  categoryId: string;
  categoryName: string;
  total: number;
}

interface RawCategoryRow {
  categoryId: string;
  categoryName: string;
  totalAmount: number | string;
}

export async function getCategoryTotals(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<CategoryTotalAggregate[]> {
  const startId = dateStringToId(startDate);
  const endId = dateStringToId(endDate);

  // Using Raw SQL to easily join FactTransactions with DimCategory
  const rows = await prisma.$queryRaw<RawCategoryRow[]>`
    SELECT 
      c.id AS "categoryId", 
      c."categoryName" AS "categoryName", 
      ROUND(ABS(SUM(t.amount)), 2)::double precision AS "totalAmount"
    FROM "FactTransactions" t
    INNER JOIN "DimCategory" c ON t."categoryId" = c.id
    WHERE t."userId" = ${userId}
      AND t."dateId" >= ${startId}
      AND t."dateId" <= ${endId}
      AND t.amount < 0
    GROUP BY c.id, c."categoryName"
    ORDER BY "totalAmount" DESC
  `;

  // Map the raw postgres results to our TypeScript interface
  return rows.map((r) => ({
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    total: Number(r.totalAmount),
  }));
}
