import { Prisma } from "@prisma/client";
import * as categoryRepository from "../repositories/category.repository.js";
import { ServiceError } from "../errors.js";
import { fireCategoryAdded } from "./module-registry.service.js";

export async function getAllCategories(userId: string) {
  return categoryRepository.findAllForUser(userId);
}

export async function createCategory(categoryName: string, userId: string) {
  const category = await categoryRepository.create({ categoryName, userId });
  try {
    await fireCategoryAdded({
      userId,
      categoryId: category.id,
      categoryName: category.categoryName,
    });
  } catch {
    // Best-effort: module hook errors must not fail core category creation
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
