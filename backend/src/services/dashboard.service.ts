import { ServiceError } from "../errors.js";
import * as dashboardRepository from "../repositories/dashboard.repository.js";

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
