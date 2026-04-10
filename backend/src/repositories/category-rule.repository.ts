import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { DuplicateRuleError } from "../errors.js";

export type MatchType = "exact" | "contains";

export async function findAllByUser(userId: string) {
  return prisma.categoryRule.findMany({
    where: { userId },
    // Deterministic ordering: priority is the primary sort, but ties must
    // resolve reproducibly so the categorization engine produces stable output
    // run-to-run. Falls back to creation time, then id for full determinism.
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }, { id: "asc" }],
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
  matchType: MatchType;
  priority: number;
}) {
  return prisma.$transaction(async (tx) => {
    try {
      return await tx.categoryRule.create({
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
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") throw new DuplicateRuleError();
        if (err.code === "P2003")
          throw new DuplicateRuleError("Referenced category no longer exists");
      }
      throw err;
    }
  });
}

export async function update(
  id: string,
  userId: string,
  data: { pattern?: string; matchType?: MatchType; categoryId?: string; priority?: number },
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.categoryRule.findFirst({ where: { id, userId } });
    if (!existing) {
      return null;
    }
    try {
      return await tx.categoryRule.update({
        where: { id },
        data,
        include: { category: { select: { id: true, categoryName: true } } },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") throw new DuplicateRuleError();
        if (err.code === "P2003")
          throw new DuplicateRuleError("Referenced category no longer exists");
        if (err.code === "P2025") return null;
      }
      throw err;
    }
  });
}

export async function remove(id: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.categoryRule.deleteMany({ where: { id, userId } });
    return result.count > 0;
  });
}

export async function findCategoryForUser(categoryId: string, userId: string) {
  return prisma.dimCategory.findFirst({
    where: { id: categoryId, OR: [{ userId }, { userId: null }] },
    select: { id: true },
  });
}
