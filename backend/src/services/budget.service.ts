import { Prisma } from "@prisma/client";
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

function validateMonthYear(month: number, year: number) {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new ServiceError(400, "month must be an integer between 1 and 12");
  }
  if (!Number.isInteger(year) || year < 2000) {
    throw new ServiceError(400, "year must be an integer >= 2000");
  }
}

export async function listBudgets(userId: string) {
  const budgets = await budgetRepository.findAllByUser(userId);
  return budgets.map((b) => ({ ...b, ...calculateBudgetStatus(b.currentSpending, b.limitAmount) }));
}

export async function createBudget(
  userId: string,
  categoryId: string,
  month: number,
  year: number,
  limitAmount: number,
) {
  const category = await budgetRepository.findCategoryForUser(categoryId, userId);
  if (!category) {
    throw new ServiceError(404, "Category not found");
  }
  const budget = await budgetRepository.create({ userId, categoryId, month, year, limitAmount });
  return { ...budget, ...calculateBudgetStatus(budget.currentSpending, budget.limitAmount) };
}

export async function updateBudget(id: string, userId: string, limitAmount: number) {
  if (limitAmount <= 0) {
    throw new ServiceError(400, "limitAmount must be greater than 0");
  }
  const budget = await budgetRepository.update(id, userId, limitAmount);
  return { ...budget, ...calculateBudgetStatus(budget.currentSpending, budget.limitAmount) };
}

export async function deleteBudget(id: string, userId: string) {
  return budgetRepository.remove(id, userId);
}
