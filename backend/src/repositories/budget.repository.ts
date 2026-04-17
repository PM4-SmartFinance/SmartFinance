import { Prisma, BudgetType } from "@prisma/client";
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
    orderBy: [{ type: "asc" }, { year: "desc" }, { month: "desc" }],
  });

  if (budgets.length === 0) {
    return [];
  }

  const spendingByKey = await computeSpendingBatch(userId, budgets);

  return budgets.map((b) => ({
    ...b,
    currentSpending: spendingByKey.get(b.id) ?? new Prisma.Decimal(0),
  }));
}

export async function create(data: {
  userId: string;
  categoryId: string;
  type: BudgetType;
  month: number;
  year: number;
  limitAmount: number;
}) {
  try {
    const budget = await prisma.dimBudget.create({
      data: {
        userId: data.userId,
        categoryId: data.categoryId,
        type: data.type,
        month: data.month,
        year: data.year,
        limitAmount: new Prisma.Decimal(data.limitAmount),
      },
    });
    return { ...budget, currentSpending: new Prisma.Decimal(0) };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ServiceError(409, "Budget already exists for this category and type");
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
      budget.type,
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

function getDateFilter(type: BudgetType, month: number, year: number) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();

  switch (type) {
    case "DAILY": {
      // Build the integer dateId for today: YYYYMMDD
      const dateId = currentYear * 10000 + currentMonth * 100 + currentDay;
      return { dateId };
    }
    case "MONTHLY":
      return { date: { month: currentMonth, year: currentYear } };
    case "YEARLY":
      return { date: { year: currentYear } };
    case "SPECIFIC_MONTH":
      return { date: { month, year: currentYear } };
    case "SPECIFIC_YEAR":
      return { date: { year } };
    case "SPECIFIC_MONTH_YEAR":
      return { date: { month, year } };
  }
}

async function computeSpendingSingle(
  userId: string,
  categoryId: string,
  type: BudgetType,
  month: number,
  year: number,
) {
  const dateFilter = getDateFilter(type, month, year);
  const result = await prisma.factTransactions.aggregate({
    _sum: { amount: true },
    where: {
      userId,
      merchant: { mappings: { some: { userId, categoryId } } },
      ...dateFilter,
    },
  });
  return result._sum.amount ?? new Prisma.Decimal(0);
}

async function computeSpendingBatch(
  userId: string,
  budgets: { id: string; categoryId: string; type: BudgetType; month: number; year: number }[],
) {
  const result = new Map<string, Prisma.Decimal>();

  if (budgets.length === 0) return result;

  // Group budgets by their date filter to batch queries
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();

  const uniqueCategories = [...new Set(budgets.map((b) => b.categoryId))];

  // Collect all unique period filters
  const periodFilters: { month: number; year: number }[] = [];
  const dailyDateId = currentYear * 10000 + currentMonth * 100 + currentDay;
  let needsDaily = false;

  for (const b of budgets) {
    switch (b.type) {
      case "DAILY":
        needsDaily = true;
        break;
      case "MONTHLY":
        periodFilters.push({ month: currentMonth, year: currentYear });
        break;
      case "YEARLY":
        // For yearly, we need all months in the current year
        periodFilters.push({ month: 0, year: currentYear });
        break;
      case "SPECIFIC_MONTH":
        periodFilters.push({ month: b.month, year: currentYear });
        break;
      case "SPECIFIC_YEAR":
        periodFilters.push({ month: 0, year: b.year });
        break;
      case "SPECIFIC_MONTH_YEAR":
        periodFilters.push({ month: b.month, year: b.year });
        break;
    }
  }

  // Deduplicate periods
  const uniquePeriods = [
    ...new Map(periodFilters.map((p) => [`${p.month}:${p.year}`, p])).values(),
  ];

  // Build OR filters for date dimension
  const dateFilters: Prisma.FactTransactionsWhereInput[] = [];
  for (const p of uniquePeriods) {
    if (p.month === 0) {
      // Yearly — match all months in that year
      dateFilters.push({ date: { year: p.year } });
    } else {
      dateFilters.push({ date: { month: p.month, year: p.year } });
    }
  }
  if (needsDaily) {
    dateFilters.push({ dateId: dailyDateId });
  }

  if (dateFilters.length === 0) return result;

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

  // For each budget, accumulate matching transaction amounts
  for (const tx of transactions) {
    const date = dateById.get(tx.dateId);
    const cats = mappingsByMerchant.get(tx.merchantId);
    if (!date || !cats) continue;

    for (const budget of budgets) {
      if (!cats.includes(budget.categoryId)) continue;

      let matches = false;
      switch (budget.type) {
        case "DAILY":
          matches = tx.dateId === dailyDateId;
          break;
        case "MONTHLY":
          matches = date.month === currentMonth && date.year === currentYear;
          break;
        case "YEARLY":
          matches = date.year === currentYear;
          break;
        case "SPECIFIC_MONTH":
          matches = date.month === budget.month && date.year === currentYear;
          break;
        case "SPECIFIC_YEAR":
          matches = date.year === budget.year;
          break;
        case "SPECIFIC_MONTH_YEAR":
          matches = date.month === budget.month && date.year === budget.year;
          break;
      }

      if (matches) {
        const current = result.get(budget.id) ?? new Prisma.Decimal(0);
        result.set(budget.id, current.add(tx.amount));
      }
    }
  }

  return result;
}
