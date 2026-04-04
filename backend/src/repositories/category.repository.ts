import { prisma } from "../prisma.js";

/**
 * Finds all categories available to a specific user.
 * Includes global categories (userId is null) AND the user's custom ones.
 */
export async function findAllForUser(userId: string) {
  return prisma.dimCategory.findMany({
    where: {
      OR: [{ userId: null }, { userId: userId }],
    },
    orderBy: { categoryName: "asc" },
  });
}

export async function findById(id: string) {
  return prisma.dimCategory.findUnique({ where: { id } });
}

export async function create(data: { categoryName: string; userId: string }) {
  return prisma.dimCategory.create({ data });
}

export async function update(id: string, data: { categoryName: string }) {
  return prisma.dimCategory.update({
    where: { id },
    data,
  });
}

export async function remove(id: string) {
  return prisma.dimCategory.delete({ where: { id } });
}

/**
 * Checks if a category is currently linked to any transactions.
 * Requirement: Deletion is blocked if category is actively referenced.
 */
export async function countTransactions(categoryId: string) {
  // Check merchant mappings first as they are the primary link
  const mappingCount = await prisma.userMerchantMapping.count({
    where: { categoryId },
  });

  return mappingCount;
}
