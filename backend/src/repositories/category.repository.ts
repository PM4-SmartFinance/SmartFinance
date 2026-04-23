import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { ServiceError } from "../errors.js";

/**
 * Finds all categories available to a specific user.
 */
export async function findAllForUser(userId: string) {
  return prisma.dimCategory.findMany({
    where: { userId: userId },
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

export async function update(id: string, userId: string, data: { categoryName: string }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.dimCategory.findFirst({ where: { id, userId } });
    if (!existing) throw new ServiceError(404, "Category not found");
    return tx.dimCategory.update({ where: { id }, data });
  });
}

export async function deleteById(id: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.dimCategory.findFirst({ where: { id, userId } });
    if (!existing) throw new ServiceError(404, "Category not found");
    return tx.dimCategory.delete({ where: { id } });
  });
}
