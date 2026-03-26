import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { ServiceError } from "../errors.js";

async function computeSpending(userId: string, categoryId: string, month: number, year: number) {
  const result = await prisma.factTransactions.aggregate({
    _sum: { amount: true },
    where: {
      userId,
      merchant: {
        mappings: { some: { userId, categoryId } },
      },
      date: { month, year },
    },
  });
  return result._sum.amount ?? new Prisma.Decimal(0);
}

export async function findAllByUser(userId: string) {
  const budgets = await prisma.budget.findMany({
    where: { userId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  return Promise.all(
    budgets.map(async (b) => ({
      ...b,
      currentSpending: await computeSpending(userId, b.categoryId, b.month, b.year),
    })),
  );
}

export async function findById(id: string, userId: string) {
  const budget = await prisma.budget.findFirst({ where: { id, userId } });
  if (!budget) {
    throw new ServiceError(404, "Budget not found");
  }
  return {
    ...budget,
    currentSpending: await computeSpending(userId, budget.categoryId, budget.month, budget.year),
  };
}

export async function create(data: {
  userId: string;
  categoryId: string;
  month: number;
  year: number;
  limitAmount: number;
}) {
  try {
    const budget = await prisma.budget.create({
      data: {
        userId: data.userId,
        categoryId: data.categoryId,
        month: data.month,
        year: data.year,
        limitAmount: new Prisma.Decimal(data.limitAmount),
      },
    });
    return { ...budget, currentSpending: new Prisma.Decimal(0) };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ServiceError(409, "Budget already exists for this category and month");
    }
    throw err;
  }
}

export async function update(id: string, userId: string, limitAmount: number) {
  const result = await prisma.budget.updateMany({
    where: { id, userId },
    data: { limitAmount: new Prisma.Decimal(limitAmount) },
  });
  if (result.count === 0) {
    throw new ServiceError(404, "Budget not found");
  }
  const budget = await prisma.budget.findUniqueOrThrow({ where: { id } });
  return {
    ...budget,
    currentSpending: await computeSpending(userId, budget.categoryId, budget.month, budget.year),
  };
}

export async function remove(id: string, userId: string) {
  const result = await prisma.budget.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    throw new ServiceError(404, "Budget not found");
  }
}
