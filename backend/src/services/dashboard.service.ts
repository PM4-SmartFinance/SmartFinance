import { Prisma } from "@prisma/client";
import * as dashboardRepository from "../repositories/dashboard.repository.js";

export interface DashboardTrendItem {
  year: number;
  month: number;
  income: number;
  expenses: number;
}

export interface DashboardSummary {
  accountBalance: number;
  monthlyExpenses: number;
  incomeThisMonth: number;
}

export interface DashboardCategoryBreakdownItem {
  category: string;
  amount: number;
}

function toDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function getMonthCursor(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function advanceMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  return value ? value.toNumber() : 0;
}

function resolveCategoryName(
  transaction: { category?: { categoryName: string } | null; merchantId: string },
  merchantCategories: Map<string, string>,
): string {
  return (
    transaction.category?.categoryName ??
    merchantCategories.get(transaction.merchantId) ??
    "Uncategorized"
  );
}

export async function getDashboardSummary(userId: string, startDate: string, endDate: string) {
  const transactions = await dashboardRepository.listTransactionsForPeriod(
    userId,
    startDate,
    endDate,
  );

  let incomeThisMonth = 0;
  let monthlyExpenses = 0;
  let accountBalance = 0;

  for (const transaction of transactions) {
    const amount = decimalToNumber(transaction.amount);
    accountBalance += amount;
    if (amount > 0) {
      incomeThisMonth += amount;
    } else if (amount < 0) {
      monthlyExpenses += Math.abs(amount);
    }
  }

  return {
    accountBalance,
    monthlyExpenses,
    incomeThisMonth,
  } satisfies DashboardSummary;
}

export async function getDashboardTrends(userId: string, startDate: string, endDate: string) {
  const transactions = await dashboardRepository.listTransactionsForPeriod(
    userId,
    startDate,
    endDate,
  );

  const start = getMonthCursor(toDate(startDate));
  const end = getMonthCursor(toDate(endDate));

  const monthlyTotals = new Map<
    string,
    {
      year: number;
      month: number;
      income: number;
      expenses: number;
    }
  >();

  for (const transaction of transactions) {
    const { year, month } = transaction.date;
    const key = monthKey(year, month);
    const current = monthlyTotals.get(key) ?? { year, month, income: 0, expenses: 0 };
    const amount = decimalToNumber(transaction.amount);

    if (amount > 0) {
      current.income += amount;
    } else if (amount < 0) {
      current.expenses += Math.abs(amount);
    }

    monthlyTotals.set(key, current);
  }

  const result: DashboardTrendItem[] = [];
  for (let cursor = start; cursor <= end; cursor = advanceMonth(cursor)) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    const key = monthKey(year, month);
    const current = monthlyTotals.get(key) ?? { year, month, income: 0, expenses: 0 };
    result.push({ year, month, income: current.income, expenses: current.expenses });
  }

  return result;
}

export async function getDashboardCategories(userId: string, startDate: string, endDate: string) {
  const [transactions, merchantCategories] = await Promise.all([
    dashboardRepository.listTransactionsForPeriod(userId, startDate, endDate),
    dashboardRepository.listMerchantCategories(userId),
  ]);

  const merchantCategoryMap = new Map(
    merchantCategories.map((entry) => [entry.merchantId, entry.category.categoryName]),
  );

  const totals = new Map<string, number>();

  for (const transaction of transactions) {
    const amount = decimalToNumber(transaction.amount);
    if (amount >= 0) {
      continue;
    }

    const category = resolveCategoryName(transaction, merchantCategoryMap);
    totals.set(category, (totals.get(category) ?? 0) + Math.abs(amount));
  }

  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}
