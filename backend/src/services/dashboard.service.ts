import { ServiceError } from "../errors.js";
import * as dashboardRepository from "../repositories/dashboard.repository.js";
import type { MonthlyTrendAggregate } from "../repositories/dashboard.repository.js";

function isValidCalendarDate(dateStr: string): boolean {
  const d = new Date(dateStr + "T00:00:00Z");
  return !isNaN(d.getTime()) && dateStr === d.toISOString().slice(0, 10);
}

export async function getDashboardSummary(userId: string, startDate: string, endDate: string) {
  if (!isValidCalendarDate(startDate) || !isValidCalendarDate(endDate)) {
    throw new ServiceError(400, "startDate and endDate must be valid calendar dates");
  }

  if (new Date(startDate + "T00:00:00Z").getTime() > new Date(endDate + "T00:00:00Z").getTime()) {
    throw new ServiceError(400, "startDate must not be after endDate");
  }

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
  months: number,
): Promise<MonthlyTrendAggregate[]> {
  const now = new Date();
  const endYear = now.getUTCFullYear();
  const endMonth = now.getUTCMonth() + 1;

  const startDate = new Date(Date.UTC(endYear, endMonth - 1, 1));
  startDate.setUTCMonth(startDate.getUTCMonth() - (months - 1));

  const startYear = startDate.getUTCFullYear();
  const startMonth = startDate.getUTCMonth() + 1;

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

  const data: MonthlyTrendAggregate[] = [];
  for (let i = 0; i < months; i++) {
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

export async function getDashboardCategories(userId: string, startDate: string, endDate: string) {
  if (!isValidCalendarDate(startDate) || !isValidCalendarDate(endDate)) {
    throw new ServiceError(400, "startDate and endDate must be valid calendar dates");
  }

  if (new Date(startDate + "T00:00:00Z").getTime() > new Date(endDate + "T00:00:00Z").getTime()) {
    throw new ServiceError(400, "startDate must not be after endDate");
  }

  const categoryTotals = await dashboardRepository.getCategoryTotals(userId, startDate, endDate);

  return categoryTotals;
}
