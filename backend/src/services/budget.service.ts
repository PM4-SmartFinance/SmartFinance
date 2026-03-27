import { ServiceError } from "../errors.js";
import * as budgetRepository from "../repositories/budget.repository.js";

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
  const category = await budgetRepository.findCategoryForUser(categoryId, userId);
  if (!category) {
    throw new ServiceError(404, "Category not found");
  }
  return budgetRepository.create({ userId, categoryId, month, year, limitAmount });
}

export async function updateBudget(id: string, userId: string, limitAmount: number) {
  return budgetRepository.update(id, userId, limitAmount);
}

export async function deleteBudget(id: string, userId: string) {
  return budgetRepository.remove(id, userId);
}
