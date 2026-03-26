import { ServiceError } from "../errors.js";
import { prisma } from "../prisma.js";
import * as budgetRepository from "../repositories/budget.repository.js";

async function assertCategoryOwnership(categoryId: string, userId: string) {
  const category = await prisma.dimCategory.findFirst({
    where: { id: categoryId, OR: [{ userId }, { userId: null }] },
    select: { id: true },
  });
  if (!category) {
    throw new ServiceError(404, "Category not found");
  }
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
  return budgetRepository.findAllByUser(userId);
}

export async function createBudget(
  userId: string,
  categoryId: string,
  month: number,
  year: number,
  limitAmount: number,
) {
  validateMonthYear(month, year);
  if (limitAmount <= 0) {
    throw new ServiceError(400, "limitAmount must be greater than 0");
  }
  await assertCategoryOwnership(categoryId, userId);
  return budgetRepository.create({ userId, categoryId, month, year, limitAmount });
}

export async function updateBudget(id: string, userId: string, limitAmount: number) {
  if (limitAmount <= 0) {
    throw new ServiceError(400, "limitAmount must be greater than 0");
  }
  return budgetRepository.update(id, userId, limitAmount);
}

export async function deleteBudget(id: string, userId: string) {
  return budgetRepository.remove(id, userId);
}
