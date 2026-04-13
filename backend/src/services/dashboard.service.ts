import { ServiceError } from "../errors.js";
import * as dashboardRepository from "../repositories/dashboard.repository.js";
import type {
  CategoryTotalAggregate,
  MonthlyTrendAggregate,
} from "../repositories/dashboard.repository.js";

function isValidCalendarDate(dateStr: string): boolean {
  const d = new Date(dateStr + "T00:00:00Z");
  return !isNaN(d.getTime()) && dateStr === d.toISOString().slice(0, 10);
}

// Shared guard for date-range endpoints. Throws ServiceError(400) on any
// invalid calendar date or an inverted range. Keeping this in one place
// ensures /dashboard/summary and /dashboard/categories stay in sync.
function validateDateRange(startDate: string, endDate: string): void {
  if (!isValidCalendarDate(startDate) || !isValidCalendarDate(endDate)) {
    throw new ServiceError(400, "startDate and endDate must be valid calendar dates");
  }

  if (new Date(startDate + "T00:00:00Z").getTime() > new Date(endDate + "T00:00:00Z").getTime()) {
    throw new ServiceError(400, "startDate must not be after endDate");
  }
}

export async function getDashboardSummary(userId: string, startDate: string, endDate: string) {
  validateDateRange(startDate, endDate);

  const { incomeAgg, expenseAgg, transactionCount } = await dashboardRepository.getSummary(
    userId,
    startDate,
    endDate,
  );

  const totalIncome = Number((incomeAgg._sum.amount?.toNumber() ?? 0).toFixed(2));
  // totalExpenses is negative (e.g. -800.00) — expenses are stored as negative amounts.
  // netBalance = totalIncome + totalExpenses (e.g. 1500 + (-800) = 700).
  const totalExpenses = Number((expenseAgg._sum.amount?.toNumber() ?? 0).toFixed(2));

  return {
    totalIncome,
    totalExpenses,
    netBalance: Number((totalIncome + totalExpenses).toFixed(2)),
    transactionCount,
  };
}

export async function getDashboardTrends(
  userId: string,
  startDateStr: string,
  endDateStr: string,
): Promise<MonthlyTrendAggregate[]> {
  validateDateRange(startDateStr, endDateStr);

  const start = new Date(startDateStr + "T00:00:00Z");
  const end = new Date(endDateStr + "T00:00:00Z");

  const startYear = start.getUTCFullYear();
  const startMonth = start.getUTCMonth() + 1;
  const endYear = end.getUTCFullYear();
  const endMonth = end.getUTCMonth() + 1;

  const aggregates = await dashboardRepository.listMonthlyTrends({
    userId,
    startYear,
    startMonth,
    endYear,
    endMonth,
  });

  const aggregateByMonth = new Map(
    aggregates.map((item) => [`${item.year}-${item.month}`, item] as const),
  );

  // Build a complete month sequence from start to end so gaps show as zero.
  const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;

  const data: MonthlyTrendAggregate[] = [];
  for (let i = 0; i < totalMonths; i++) {
    const monthDate = new Date(Date.UTC(startYear, startMonth - 1 + i, 1));
    const year = monthDate.getUTCFullYear();
    const month = monthDate.getUTCMonth() + 1;
    const aggregate = aggregateByMonth.get(`${year}-${month}`);

    data.push({
      year,
      month,
      income: aggregate?.income ?? 0,
      expenses: aggregate?.expenses ?? 0,
    });
  }

  return data;
}

export async function getDashboardCategories(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<CategoryTotalAggregate[]> {
  validateDateRange(startDate, endDate);

  try {
    return await dashboardRepository.getCategoryTotals(userId, startDate, endDate);
  } catch (err) {
    // Decorate raw SQL failures with the request context so the centralized
    // error handler's log entry is actionable. The original error is kept as
    // `cause` so stack traces survive.
    throw new Error(`getCategoryTotals failed for user ${userId} [${startDate}..${endDate}]`, {
      cause: err,
    });
  }
}
