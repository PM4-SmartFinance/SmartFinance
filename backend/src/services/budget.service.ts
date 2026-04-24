import { Prisma, BudgetType } from "@prisma/client";
import { ServiceError } from "../errors.js";
import * as budgetRepository from "../repositories/budget.repository.js";

export function calculateBudgetStatus(
  currentSpending: Prisma.Decimal,
  limitAmount: Prisma.Decimal,
): { percentageUsed: number; remainingAmount: Prisma.Decimal; isOverBudget: boolean } {
  const isOverBudget = currentSpending.greaterThan(limitAmount);
  const remainingAmount = limitAmount.minus(currentSpending);
  const percentageUsed = limitAmount.isZero()
    ? 0
    : currentSpending.dividedBy(limitAmount).times(100).toDecimalPlaces(2).toNumber();
  return { percentageUsed, remainingAmount, isOverBudget };
}

const TYPE_PRIORITY: Record<BudgetType, number> = {
  DAILY: 0,
  MONTHLY: 1,
  YEARLY: 1,
  SPECIFIC_MONTH: 2,
  SPECIFIC_YEAR: 2,
  SPECIFIC_MONTH_YEAR: 3,
};

export function isBudgetActiveNow(type: BudgetType, month: number, year: number): boolean {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  switch (type) {
    case "DAILY":
    case "MONTHLY":
    case "YEARLY":
      return true;
    case "SPECIFIC_MONTH":
      return month === currentMonth;
    case "SPECIFIC_YEAR":
      return year === currentYear;
    case "SPECIFIC_MONTH_YEAR":
      return month === currentMonth && year === currentYear;
  }
}

export async function listBudgets(userId: string) {
  const budgets = await budgetRepository.findAllByUser(userId);
  return budgets.map((b) => ({
    ...b,
    ...calculateBudgetStatus(b.currentSpending, b.limitAmount),
    isActive: isBudgetActiveNow(b.type, b.month, b.year),
    priority: TYPE_PRIORITY[b.type],
  }));
}

const TYPES_REQUIRING_MONTH: BudgetType[] = ["SPECIFIC_MONTH", "SPECIFIC_MONTH_YEAR"];
const TYPES_REQUIRING_YEAR: BudgetType[] = ["SPECIFIC_YEAR", "SPECIFIC_MONTH_YEAR"];

export async function createBudget(
  userId: string,
  categoryId: string,
  type: BudgetType,
  limitAmount: number,
  month?: number,
  year?: number,
) {
  const category = await budgetRepository.findCategoryForUser(categoryId, userId);
  if (!category) {
    throw new ServiceError(404, "Category not found");
  }

  // Validate month/year presence based on type
  if (TYPES_REQUIRING_MONTH.includes(type) && (month === undefined || month < 1 || month > 12)) {
    throw new ServiceError(400, "month is required for this budget type (1-12)");
  }
  if (TYPES_REQUIRING_YEAR.includes(type) && (year === undefined || year < 2000)) {
    throw new ServiceError(400, "year is required for this budget type (>= 2000)");
  }

  const resolvedMonth = TYPES_REQUIRING_MONTH.includes(type) ? month! : 0;
  const resolvedYear = TYPES_REQUIRING_YEAR.includes(type) ? year! : 0;

  const budget = await budgetRepository.create({
    userId,
    categoryId,
    type,
    month: resolvedMonth,
    year: resolvedYear,
    limitAmount,
  });
  return {
    ...budget,
    ...calculateBudgetStatus(budget.currentSpending, budget.limitAmount),
    isActive: isBudgetActiveNow(type, resolvedMonth, resolvedYear),
    priority: TYPE_PRIORITY[type],
  };
}

export interface UpdateBudgetData {
  limitAmount?: number;
  categoryId?: string;
  type?: BudgetType;
  month?: number;
  year?: number;
  active?: boolean;
}

export async function updateBudget(id: string, userId: string, data: UpdateBudgetData) {
  if (data.limitAmount !== undefined && data.limitAmount <= 0) {
    throw new ServiceError(400, "limitAmount must be greater than 0");
  }

  if (data.categoryId !== undefined) {
    const category = await budgetRepository.findCategoryForUser(data.categoryId, userId);
    if (!category) {
      throw new ServiceError(404, "Category not found");
    }
  }

  const budget = await budgetRepository.update(id, userId, data);
  return {
    ...budget,
    ...calculateBudgetStatus(budget.currentSpending, budget.limitAmount),
    isActive: isBudgetActiveNow(budget.type, budget.month, budget.year),
    priority: TYPE_PRIORITY[budget.type],
  };
}

export async function deleteBudget(id: string, userId: string) {
  return budgetRepository.remove(id, userId);
}

export type PeriodFilter = "DAILY" | "MONTHLY" | "YEARLY" | "DATE_RANGE";

export interface CategorySpendingResult {
  categoryId: string;
  spending: string;
  /** Budget limit scaled to the view period (null only if no budget exists for category) */
  scaledLimit: string | null;
  sourceBudgetType: BudgetType | null;
}

// --- Month-segment approach for accurate multi-budget limit scaling ---

interface MonthSegment {
  year: number;
  month: number;
  days: number;
  totalDaysInMonth: number;
}

function getMonthSegments(startDateId: number, endDateId: number): MonthSegment[] {
  const segments: MonthSegment[] = [];
  const startYear = Math.floor(startDateId / 10000);
  const startMonth = Math.floor((startDateId % 10000) / 100);
  const startDay = startDateId % 100;
  const endYear = Math.floor(endDateId / 10000);
  const endMonth = Math.floor((endDateId % 10000) / 100);
  const endDay = endDateId % 100;

  let y = startYear;
  let m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    const totalDays = new Date(y, m, 0).getDate();
    const first = y === startYear && m === startMonth ? startDay : 1;
    const last = y === endYear && m === endMonth ? endDay : totalDays;
    segments.push({ year: y, month: m, days: last - first + 1, totalDaysInMonth: totalDays });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return segments;
}

function isBudgetActiveForMonth(
  b: { type: BudgetType; month: number; year: number },
  month: number,
  year: number,
): boolean {
  switch (b.type) {
    case "DAILY":
    case "MONTHLY":
    case "YEARLY":
      return true;
    case "SPECIFIC_MONTH":
      return b.month === month;
    case "SPECIFIC_YEAR":
      return b.year === year;
    case "SPECIFIC_MONTH_YEAR":
      return b.month === month && b.year === year;
  }
}

function daysInYear(year: number): number {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;
}

/** Proportional limit contribution of a budget for a partial month segment. */
function getLimitContribution(
  limitAmount: Prisma.Decimal,
  type: BudgetType,
  segDays: number,
  segTotalDays: number,
  segYear: number,
): Prisma.Decimal {
  switch (type) {
    case "DAILY":
      return limitAmount.times(segDays);
    case "MONTHLY":
    case "SPECIFIC_MONTH":
    case "SPECIFIC_MONTH_YEAR":
      return limitAmount.times(segDays).dividedBy(segTotalDays);
    case "YEARLY":
    case "SPECIFIC_YEAR":
      return limitAmount.times(segDays).dividedBy(daysInYear(segYear));
  }
}

function computeDateIdRange(
  period: PeriodFilter,
  startDate?: string,
  endDate?: string,
): { startDateId: number; endDateId: number } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();

  switch (period) {
    case "DAILY":
      return { startDateId: y * 10000 + m * 100 + d, endDateId: y * 10000 + m * 100 + d };
    case "MONTHLY": {
      const lastDay = new Date(y, m, 0).getDate();
      return { startDateId: y * 10000 + m * 100 + 1, endDateId: y * 10000 + m * 100 + lastDay };
    }
    case "YEARLY":
      return { startDateId: y * 10000 + 101, endDateId: y * 10000 + 1231 };
    case "DATE_RANGE": {
      if (!startDate || !endDate) {
        throw new ServiceError(400, "startDate and endDate are required for DATE_RANGE period");
      }
      const sParts = startDate.split("-").map(Number) as [number, number, number];
      const eParts = endDate.split("-").map(Number) as [number, number, number];
      return {
        startDateId: sParts[0] * 10000 + sParts[1] * 100 + sParts[2],
        endDateId: eParts[0] * 10000 + eParts[1] * 100 + eParts[2],
      };
    }
  }
}

export async function getCategorySpendingForPeriod(
  userId: string,
  period: PeriodFilter,
  budgets: Awaited<ReturnType<typeof listBudgets>>,
  startDate?: string,
  endDate?: string,
): Promise<CategorySpendingResult[]> {
  const { startDateId, endDateId } = computeDateIdRange(period, startDate, endDate);
  const spendingMap = await budgetRepository.computeCategorySpendingForPeriod(
    userId,
    startDateId,
    endDateId,
  );

  const segments = getMonthSegments(startDateId, endDateId);
  const categoryIds = [...new Set(budgets.map((b) => b.categoryId))];

  return categoryIds.map((categoryId) => {
    const spending = spendingMap.get(categoryId) ?? new Prisma.Decimal(0);
    const categoryBudgets = budgets.filter((b) => b.categoryId === categoryId && b.active);

    if (categoryBudgets.length === 0) {
      return {
        categoryId,
        spending: spending.toString(),
        scaledLimit: null,
        sourceBudgetType: null,
      };
    }

    // For each month segment, find the winning budget (highest priority among
    // those active for that month) and sum proportional limit contributions.
    let totalLimit = new Prisma.Decimal(0);
    let primaryType: BudgetType | null = null;
    let highestPriority = -1;

    for (const seg of segments) {
      const active = categoryBudgets.filter((b) => isBudgetActiveForMonth(b, seg.month, seg.year));
      if (active.length === 0) continue;

      const winner = active.reduce((best, b) =>
        TYPE_PRIORITY[b.type] > TYPE_PRIORITY[best.type] ? b : best,
      );

      totalLimit = totalLimit.add(
        getLimitContribution(
          winner.limitAmount,
          winner.type,
          seg.days,
          seg.totalDaysInMonth,
          seg.year,
        ),
      );

      if (TYPE_PRIORITY[winner.type] > highestPriority) {
        highestPriority = TYPE_PRIORITY[winner.type];
        primaryType = winner.type;
      }
    }

    return {
      categoryId,
      spending: spending.toString(),
      scaledLimit: totalLimit.toDecimalPlaces(2).toString(),
      sourceBudgetType: primaryType,
    };
  });
}
