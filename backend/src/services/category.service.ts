import * as categoryRepository from "../repositories/category.repository.js";
import { ServiceError } from "../errors.js";

export async function getAllCategories(userId: string) {
  return categoryRepository.findAllForUser(userId);
}

export async function createCategory(categoryName: string, userId: string) {
  return categoryRepository.create({ categoryName, userId });
}

export async function updateCategory(id: string, userId: string, categoryName: string) {
  const category = await categoryRepository.findById(id);

  if (!category) throw new ServiceError(404, "Category not found");

  // Rule: Users cannot edit Global Categories (userId is null)
  if (!category.userId) {
    throw new ServiceError(403, "Global categories cannot be modified");
  }

  // Rule: Users can only edit their OWN categories
  if (category.userId !== userId) {
    throw new ServiceError(403, "Access denied");
  }

  return categoryRepository.update(id, { categoryName });
}

export async function deleteCategory(id: string, userId: string) {
  const category = await categoryRepository.findById(id);

  if (!category) throw new ServiceError(404, "Category not found");
  if (!category.userId) throw new ServiceError(403, "Global categories cannot be deleted");
  if (category.userId !== userId) throw new ServiceError(403, "Access denied");

  // Requirement: Block deletion if referenced by transactions/mappings
  const usageCount = await categoryRepository.countTransactions(id);
  if (usageCount > 0) {
    throw new ServiceError(409, "Category is in use and cannot be deleted");
  }

  return categoryRepository.remove(id);
}
