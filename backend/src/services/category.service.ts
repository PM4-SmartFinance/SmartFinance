import { Prisma } from "@prisma/client";
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

  // Rule: Users can only edit their OWN categories
  if (category.userId !== userId) {
    throw new ServiceError(403, "Access denied");
  }

  return categoryRepository.update(id, { categoryName });
}

export async function deleteCategory(id: string, userId: string) {
  const category = await categoryRepository.findById(id);

  if (!category) throw new ServiceError(404, "Category not found");

  // Rule: Users can only delete their OWN categories
  if (category.userId !== userId) {
    throw new ServiceError(403, "Access denied");
  }

  try {
    // Because we added onDelete: Restrict to the Prisma schema,
    // the database will automatically block the delete if the category is in use.
    await categoryRepository.deleteById(id);
  } catch (error) {
    // Catch the specific Postgres Foreign Key Constraint error
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new ServiceError(409, "Category is in use and cannot be deleted");
    }
    throw error;
  }
}
