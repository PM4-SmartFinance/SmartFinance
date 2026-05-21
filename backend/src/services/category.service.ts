import { Prisma } from "@prisma/client";
import * as categoryRepository from "../repositories/category.repository.js";
import * as transactionRepository from "../repositories/transaction.repository.js";
import { ServiceError } from "../errors.js";
import { fireCategoryAdded } from "./module-registry.service.js";
import { getLogger } from "../logger.js";

export async function getAllCategories(userId: string) {
  return categoryRepository.findAllForUser(userId);
}

export async function createCategory(categoryName: string, userId: string) {
  const category = await categoryRepository.create({ categoryName, userId });
  // Best-effort: category is already committed; hook failures must not surface as category errors.
  try {
    await fireCategoryAdded({
      userId,
      categoryId: category.id,
      categoryName: category.categoryName,
    });
  } catch (err) {
    getLogger().warn(
      { err, userId, categoryId: category.id },
      "fireCategoryAdded unexpectedly threw",
    );
  }
  return category;
}

export async function updateCategory(id: string, userId: string, categoryName: string) {
  const result = await categoryRepository.update(id, userId, { categoryName });
  if (!result) throw new ServiceError(404, "Category not found");
  return result;
}

export async function deleteCategory(id: string, userId: string) {
  try {
    const result = await categoryRepository.deleteById(id, userId);
    if (!result) throw new ServiceError(404, "Category not found");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new ServiceError(409, "Category is in use and cannot be deleted");
    }
    throw error;
  }
}

/**
 * Bulk-clears the category assignment from every transaction in the given
 * personal category for the requesting user. Restores the post-import
 * "uncategorized" state so the user can subsequently delete the category
 * or let the auto-categorize engine re-evaluate the rows. (KAN-156)
 *
 * Global categories (userId == null) are read-only and not subject to bulk
 * clearing — return 404 to match the existing delete/edit contract for
 * defensive uniformity.
 */
export async function uncategorizeAllForCategory(
  categoryId: string,
  userId: string,
): Promise<{ uncategorized: number }> {
  const category = await categoryRepository.findById(categoryId);
  if (!category || category.userId !== userId) {
    throw new ServiceError(404, "Category not found");
  }
  const count = await transactionRepository.clearCategoryAssignments(userId, categoryId);
  return { uncategorized: count };
}
