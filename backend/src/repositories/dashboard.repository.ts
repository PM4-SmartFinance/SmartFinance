import { prisma } from "../prisma.js";

export function dateStringToId(dateStr: string): number {
  // Defence-in-depth: callers are expected to pre-validate, but a loose regex
  // (e.g. `^\d{4}-\d{2}-\d{2}$`) would still let through values like
  // "2026-13-99". Reject anything that is not a plausible Gregorian date so
  // a bad input becomes a loud error instead of a silently wrong query.
  const parts = dateStr.split("-");
  if (parts.length !== 3) {
    throw new Error(`Invalid date string passed to dateStringToId: ${dateStr}`);
  }
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1000 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new Error(`Invalid date string passed to dateStringToId: ${dateStr}`);
  }
  return year * 10000 + month * 100 + day;
}

export async function getSummary(userId: string, startDate: string, endDate: string) {
  const startId = dateStringToId(startDate);
  const endId = dateStringToId(endDate);

  const [incomeAgg, expenseAgg, transactionCount] = await Promise.all([
    prisma.factTransactions.aggregate({
      where: {
        userId,
        isDeleted: false,
        dateId: { gte: startId, lte: endId },
        amount: { gt: 0 },
      },
      _sum: { amount: true },
    }),
    prisma.factTransactions.aggregate({
      where: {
        userId,
        isDeleted: false,
        dateId: { gte: startId, lte: endId },
        amount: { lt: 0 },
      },
      _sum: { amount: true },
    }),
    prisma.factTransactions.count({
      where: { userId, isDeleted: false, dateId: { gte: startId, lte: endId } },
    }),
  ]);

  return { incomeAgg, expenseAgg, transactionCount };
}

interface ListDailyTrendsArgs {
  userId: string;
  startDateId: number;
  endDateId: number;
}

export interface DailyTrendAggregate {
  /** ISO date string YYYY-MM-DD */
  date: string;
  income: number;
  expenses: number;
}

interface RawDailyTrendRow {
  dateId: number;
  income: number | string;
  expenses: number | string;
}

function dateIdToIsoString(id: number): string {
  const y = Math.floor(id / 10000);
  const m = Math.floor((id % 10000) / 100);
  const d = id % 100;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export async function listDailyTrends(args: ListDailyTrendsArgs): Promise<DailyTrendAggregate[]> {
  const { userId, startDateId, endDateId } = args;

  // INNER JOIN (not LEFT JOIN) intentional: we only return days that have at
  // least one transaction. Days with zero transactions are added by the
  // service-layer gap-fill, which decouples chart completeness from how
  // densely DimDate is populated.
  const rows = await prisma.$queryRaw<RawDailyTrendRow[]>`
    SELECT
      d.id::int AS "dateId",
      ROUND(COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0), 2)::double precision AS income,
      ROUND(COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0), 2)::double precision AS expenses
    FROM "FactTransactions" t
    INNER JOIN "DimDate" d ON d.id = t."dateId"
    WHERE t."userId" = ${userId}
      AND t."isDeleted" = FALSE
      AND d.id >= ${startDateId}
      AND d.id <= ${endDateId}
    GROUP BY d.id
    ORDER BY d.id ASC
  `;

  return rows.map((r) => ({
    date: dateIdToIsoString(Number(r.dateId)),
    income: Number(r.income),
    expenses: Number(r.expenses),
  }));
}

export interface CategoryTotalAggregate {
  categoryId: string | null;
  categoryName: string;
  total: number;
  isUncategorized?: boolean;
}

interface RawCategoryRow {
  categoryId: string | null;
  categoryName: string;
  totalAmount: number | string;
  isUncategorized: boolean;
}

const UNCATEGORIZED_LABEL = "Uncategorized";

export async function getCategoryTotals(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<CategoryTotalAggregate[]> {
  const startId = dateStringToId(startDate);
  const endId = dateStringToId(endDate);

  // Two-part query merged via UNION ALL:
  //  1) LEFT JOIN over the user's categories so zero-spend categories appear
  //     with total = 0 (the chart should display every tracked category).
  //  2) Synthetic "Uncategorized" row summing transactions with categoryId IS
  //     NULL — surfaces money the user hasn't classified yet so they can act.
  //
  // Final ordering and filtering of the zero-total Uncategorized row happen
  // in TypeScript (kept out of SQL to keep the query readable).
  const rows = await prisma.$queryRaw<RawCategoryRow[]>`
    SELECT
      CAST(c.id AS TEXT) AS "categoryId",
      c."categoryName" AS "categoryName",
      COALESCE(ROUND(ABS(SUM(t.amount)), 2)::double precision, 0) AS "totalAmount",
      FALSE AS "isUncategorized"
    FROM "DimCategory" c
    LEFT JOIN "FactTransactions" t
      ON t."categoryId" = c.id
      AND t."userId" = ${userId}
      AND t."isDeleted" = FALSE
      AND t."dateId" >= ${startId}
      AND t."dateId" <= ${endId}
      AND t.amount < 0
    WHERE c."userId" = ${userId}
    GROUP BY c.id, c."categoryName"

    UNION ALL

    SELECT
      NULL::text AS "categoryId",
      ${UNCATEGORIZED_LABEL} AS "categoryName",
      COALESCE(ROUND(ABS(SUM(amount)), 2)::double precision, 0) AS "totalAmount",
      TRUE AS "isUncategorized"
    FROM "FactTransactions"
    WHERE "userId" = ${userId}
      AND "isDeleted" = FALSE
      AND "categoryId" IS NULL
      AND "dateId" >= ${startId}
      AND "dateId" <= ${endId}
      AND amount < 0
  `;

  const categorized: CategoryTotalAggregate[] = [];
  let uncategorized: CategoryTotalAggregate | null = null;

  for (const r of rows) {
    const total = Number(r.totalAmount);
    if (r.isUncategorized) {
      if (total > 0) {
        uncategorized = {
          categoryId: null,
          categoryName: r.categoryName,
          total,
          isUncategorized: true,
        };
      }
      continue;
    }
    categorized.push({
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      total,
    });
  }

  categorized.sort((a, b) => {
    if (a.total !== b.total) return b.total - a.total;
    return a.categoryName.localeCompare(b.categoryName);
  });

  return uncategorized ? [...categorized, uncategorized] : categorized;
}
