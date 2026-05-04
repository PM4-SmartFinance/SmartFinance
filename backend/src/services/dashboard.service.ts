import { ServiceError } from "../errors.js";
import * as dashboardRepository from "../repositories/dashboard.repository.js";
import { dateStringToId } from "../repositories/dashboard.repository.js";
import type {
  CategoryTotalAggregate,
  DailyTrendAggregate,
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
): Promise<DailyTrendAggregate[]> {
  validateDateRange(startDateStr, endDateStr);

  const startDateId = dateStringToId(startDateStr);
  const endDateId = dateStringToId(endDateStr);

  const aggregates = await dashboardRepository.listDailyTrends({
    userId,
    startDateId,
    endDateId,
  });

  const aggregateByDate = new Map(aggregates.map((a) => [a.date, a] as const));

  // Build a complete day sequence from start to end so gaps show as zero.
  const start = new Date(startDateStr + "T00:00:00Z");
  const end = new Date(endDateStr + "T00:00:00Z");
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;

  const data: DailyTrendAggregate[] = [];
  for (let i = 0; i < totalDays; i++) {
    const day = new Date(start.getTime() + i * 86_400_000);
    const y = day.getUTCFullYear();
    const m = day.getUTCMonth() + 1;
    const d = day.getUTCDate();
    const date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const aggregate = aggregateByDate.get(date);
    data.push({
      date,
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
