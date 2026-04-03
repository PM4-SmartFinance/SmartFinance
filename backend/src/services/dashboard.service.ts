import { ServiceError } from "../errors.js";
import * as dashboardRepository from "../repositories/dashboard.repository.js";

export async function getDashboardSummary(userId: string, startDate: string, endDate: string) {
  if (startDate > endDate) {
    throw new ServiceError(400, "startDate must not be after endDate");
  }

  const { incomeAgg, expenseAgg, transactionCount } = await dashboardRepository.getSummary(
    userId,
    startDate,
    endDate,
  );

  const totalIncome = incomeAgg._sum.amount?.toNumber() ?? 0;
  const totalExpenses = expenseAgg._sum.amount?.toNumber() ?? 0;

  return {
    totalIncome,
    totalExpenses,
    netBalance: totalIncome + totalExpenses,
    transactionCount,
  };
}
