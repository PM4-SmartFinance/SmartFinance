import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { ServiceError } from "../errors.js";

export async function findCategoryForUser(categoryId: string, userId: string) {
  return prisma.dimCategory.findFirst({
    where: { id: categoryId, OR: [{ userId }, { userId: null }] },
    select: { id: true },
  });
}

export async function findAllByUser(userId: string) {
  const budgets = await prisma.dimBudget.findMany({
    where: { userId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  if (budgets.length === 0) {
    return [];
  }

  const spendingByKey = await computeSpendingBatch(
    userId,
    budgets.map((b) => ({ categoryId: b.categoryId, month: b.month, year: b.year })),
  );

  return budgets.map((b) => ({
    ...b,
    currentSpending:
      spendingByKey.get(`${b.categoryId}:${b.month}:${b.year}`) ?? new Prisma.Decimal(0),
  }));
}

export async function create(data: {
  userId: string;
  categoryId: string;
  month: number;
  year: number;
  limitAmount: number;
}) {
  try {
    const budget = await prisma.dimBudget.create({
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
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        throw new ServiceError(409, "Budget already exists for this category and month");
      }
    }
    throw err;
  }
}

export async function update(id: string, userId: string, limitAmount: number) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.dimBudget.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new ServiceError(404, "Budget not found");
    }

    const budget = await tx.dimBudget.update({
      where: { id },
      data: { limitAmount: new Prisma.Decimal(limitAmount) },
    });

    const spending = await computeSpendingSingle(
      userId,
      budget.categoryId,
      budget.month,
      budget.year,
    );
    return { ...budget, currentSpending: spending };
  });
}

export async function remove(id: string, userId: string) {
  const result = await prisma.dimBudget.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    throw new ServiceError(404, "Budget not found");
  }
}

async function computeSpendingSingle(
  userId: string,
  categoryId: string,
  month: number,
  year: number,
) {
  const result = await prisma.factTransactions.aggregate({
    _sum: { amount: true },
    where: {
      userId,
      merchant: { mappings: { some: { userId, categoryId } } },
      date: { month, year },
    },
  });
  return result._sum.amount ?? new Prisma.Decimal(0);
}

async function computeSpendingBatch(
  userId: string,
  entries: { categoryId: string; month: number; year: number }[],
) {
  const result = new Map<string, Prisma.Decimal>();

  if (entries.length === 0) return result;

  const uniquePeriods = [...new Set(entries.map((e) => `${e.month}:${e.year}`))];
  const uniqueCategories = [...new Set(entries.map((e) => e.categoryId))];

  const dateFilters = uniquePeriods.map((p) => {
    const parts = p.split(":");
    return { date: { month: Number(parts[0]), year: Number(parts[1]) } };
  });

  const transactions = await prisma.factTransactions.findMany({
    where: {
      userId,
      merchant: { mappings: { some: { userId, categoryId: { in: uniqueCategories } } } },
      OR: dateFilters,
    },
    select: {
      amount: true,
      merchantId: true,
      dateId: true,
    },
  });

  // Batch-fetch related merchants' category mappings and dates
  const merchantIds = [...new Set(transactions.map((t) => t.merchantId))];
  const dateIds = [...new Set(transactions.map((t) => t.dateId))];

  const [mappings, dates] = await Promise.all([
    prisma.userMerchantMapping.findMany({
      where: { userId, merchantId: { in: merchantIds } },
      select: { merchantId: true, categoryId: true },
    }),
    prisma.dimDate.findMany({
      where: { id: { in: dateIds } },
      select: { id: true, month: true, year: true },
    }),
  ]);

  const mappingsByMerchant = new Map<string, string[]>();
  for (const m of mappings) {
    const cats = mappingsByMerchant.get(m.merchantId) ?? [];
    cats.push(m.categoryId);
    mappingsByMerchant.set(m.merchantId, cats);
  }

  const dateById = new Map(dates.map((d) => [d.id, d]));

  for (const tx of transactions) {
    const date = dateById.get(tx.dateId);
    const cats = mappingsByMerchant.get(tx.merchantId);
    if (!date || !cats) continue;

    for (const categoryId of cats) {
      const key = `${categoryId}:${date.month}:${date.year}`;
      const current = result.get(key) ?? new Prisma.Decimal(0);
      result.set(key, current.add(tx.amount));
    }
  }

  return result;
}
