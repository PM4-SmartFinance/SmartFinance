import { Prisma, BudgetType } from "@prisma/client";
import { ServiceError } from "../errors.js";
import * as budgetRepository from "../repositories/budget.repository.js";

export function calculateBudgetStatus(
  currentSpending: Prisma.Decimal,
  limitAmount: Prisma.Decimal,
): { percentageUsed: number; remainingAmount: Prisma.Decimal; isOverBudget: boolean } {
  const isOverBudget = currentSpending.greaterThan(limitAmount);
  const remainingAmount = limitAmount.minus(currentSpending);
  const percentageUsed = limitAmount.isZero()
    ? 0
    : currentSpending.dividedBy(limitAmount).times(100).toDecimalPlaces(2).toNumber();
  return { percentageUsed, remainingAmount, isOverBudget };
}

const TYPE_PRIORITY: Record<BudgetType, number> = {
  DAILY: 0,
  MONTHLY: 1,
  YEARLY: 1,
  SPECIFIC_MONTH: 2,
  SPECIFIC_YEAR: 2,
  SPECIFIC_MONTH_YEAR: 3,
};

export function isBudgetActiveNow(type: BudgetType, month: number, year: number): boolean {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  switch (type) {
    case "DAILY":
    case "MONTHLY":
    case "YEARLY":
      return true;
    case "SPECIFIC_MONTH":
      return month === currentMonth;
    case "SPECIFIC_YEAR":
      return year === currentYear;
    case "SPECIFIC_MONTH_YEAR":
      return month === currentMonth && year === currentYear;
  }
}

export async function listBudgets(userId: string) {
  const budgets = await budgetRepository.findAllByUser(userId);
  return budgets.map((b) => ({
    ...b,
    ...calculateBudgetStatus(b.currentSpending, b.limitAmount),
    isActive: isBudgetActiveNow(b.type, b.month, b.year),
    priority: TYPE_PRIORITY[b.type],
  }));
}

const TYPES_REQUIRING_MONTH: BudgetType[] = ["SPECIFIC_MONTH", "SPECIFIC_MONTH_YEAR"];
const TYPES_REQUIRING_YEAR: BudgetType[] = ["SPECIFIC_YEAR", "SPECIFIC_MONTH_YEAR"];

export async function createBudget(
  userId: string,
  categoryId: string,
  type: BudgetType,
  limitAmount: number,
  month?: number,
  year?: number,
) {
  const category = await budgetRepository.findCategoryForUser(categoryId, userId);
  if (!category) {
    throw new ServiceError(404, "Category not found");
  }

  // Validate month/year presence based on type
  if (TYPES_REQUIRING_MONTH.includes(type) && (month === undefined || month < 1 || month > 12)) {
    throw new ServiceError(400, "month is required for this budget type (1-12)");
  }
  if (TYPES_REQUIRING_YEAR.includes(type) && (year === undefined || year < 2000)) {
    throw new ServiceError(400, "year is required for this budget type (>= 2000)");
  }

  const resolvedMonth = TYPES_REQUIRING_MONTH.includes(type) ? month! : 0;
  const resolvedYear = TYPES_REQUIRING_YEAR.includes(type) ? year! : 0;

  const budget = await budgetRepository.create({
    userId,
    categoryId,
    type,
    month: resolvedMonth,
    year: resolvedYear,
    limitAmount,
  });
  return {
    ...budget,
    ...calculateBudgetStatus(budget.currentSpending, budget.limitAmount),
    isActive: isBudgetActiveNow(type, resolvedMonth, resolvedYear),
    priority: TYPE_PRIORITY[type],
  };
}

export async function updateBudget(
  id: string,
  userId: string,
  updates: {
    categoryId?: string;
    month?: number;
    year?: number;
    limitAmount?: number;
  },
) {
  // Validate provided fields
  if (updates.limitAmount !== undefined && updates.limitAmount <= 0) {
    throw new ServiceError(400, "limitAmount must be greater than 0");
  }
  if (updates.month !== undefined && (updates.month < 1 || updates.month > 12)) {
    throw new ServiceError(400, "month must be between 1 and 12");
  }
  if (updates.year !== undefined && updates.year < 2000) {
    throw new ServiceError(400, "year must be 2000 or later");
  }

  // Validate category if provided
  if (updates.categoryId !== undefined) {
    const category = await budgetRepository.findCategoryForUser(updates.categoryId, userId);
    if (!category) {
      throw new ServiceError(404, "Category not found");
    }
  }

  const budget = await budgetRepository.update(id, userId, updates);
  return {
    ...budget,
    ...calculateBudgetStatus(budget.currentSpending, budget.limitAmount),
    isActive: isBudgetActiveNow(budget.type, budget.month, budget.year),
    priority: TYPE_PRIORITY[budget.type],
  };
}

export async function deleteBudget(id: string, userId: string) {
  return budgetRepository.remove(id, userId);
}
