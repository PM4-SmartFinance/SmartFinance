import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { ServiceError } from "../errors.js";

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
  try {
    return await prisma.$transaction(async (tx) => {
      return tx.dimCategory.create({ data });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ServiceError(409, "A category with this name already exists");
    }
    throw err;
  }
}

export async function update(id: string, data: { categoryName: string }) {
  return prisma.$transaction(async (tx) => {
    return tx.dimCategory.update({ where: { id }, data });
  });
}

/**
 * Checks if a category is actively referenced by transactions or merchant mappings,
 * then deletes it — all within a single transaction to prevent TOCTOU races.
 * Returns the usage count if deletion is blocked, or null on success.
 */
export async function removeIfUnused(id: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const [transactionCount, mappingCount] = await Promise.all([
      tx.factTransactions.count({ where: { categoryId: id } }),
      tx.userMerchantMapping.count({ where: { categoryId: id } }),
    ]);

    const usageCount = transactionCount + mappingCount;
    if (usageCount > 0) {
      return usageCount;
    }

    await tx.dimCategory.delete({ where: { id } });
    return 0;
  });
}
