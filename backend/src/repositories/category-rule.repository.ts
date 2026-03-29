import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { ServiceError } from "../errors.js";

export async function findAllByUser(userId: string) {
  return prisma.categoryRule.findMany({
    where: { userId },
    orderBy: { priority: "desc" },
    include: { category: { select: { id: true, categoryName: true } } },
  });
}

export async function findById(id: string, userId: string) {
  return prisma.categoryRule.findFirst({
    where: { id, userId },
    include: { category: { select: { id: true, categoryName: true } } },
  });
}

export async function create(data: {
  userId: string;
  categoryId: string;
  pattern: string;
  matchType: string;
  priority: number;
}) {
  try {
    return await prisma.categoryRule.create({
      data: {
        userId: data.userId,
        categoryId: data.categoryId,
        pattern: data.pattern,
        matchType: data.matchType,
        priority: data.priority,
      },
      include: { category: { select: { id: true, categoryName: true } } },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ServiceError(409, "A rule with this pattern and match type already exists");
    }
    throw err;
  }
}

export async function update(
  id: string,
  userId: string,
  data: { pattern?: string; matchType?: string; categoryId?: string; priority?: number },
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.categoryRule.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new ServiceError(404, "Category rule not found");
    }
    try {
      return await tx.categoryRule.update({
        where: { id },
        data,
        include: { category: { select: { id: true, categoryName: true } } },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ServiceError(409, "A rule with this pattern and match type already exists");
      }
      throw err;
    }
  });
}

export async function remove(id: string, userId: string) {
  const result = await prisma.categoryRule.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    throw new ServiceError(404, "Category rule not found");
  }
}

export async function findCategoryForUser(categoryId: string, userId: string) {
  return prisma.dimCategory.findFirst({
    where: { id: categoryId, OR: [{ userId }, { userId: null }] },
    select: { id: true },
  });
}
