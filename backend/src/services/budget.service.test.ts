import { Prisma } from "@prisma/client";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { calculateBudgetStatus, updateBudget } from "./budget.service.js";
import * as budgetRepository from "../repositories/budget.repository.js";
import { ServiceError } from "../errors.js";

vi.mock("../repositories/budget.repository.js", () => ({
  findCategoryForUser: vi.fn(),
  findByIdForUser: vi.fn(),
  update: vi.fn(),
}));

const mockFindCategoryForUser = vi.mocked(budgetRepository.findCategoryForUser);
const mockFindByIdForUser = vi.mocked(budgetRepository.findByIdForUser);
const mockUpdate = vi.mocked(budgetRepository.update);

function d(value: string | number) {
  return new Prisma.Decimal(value);
}

function existingBudget(
  overrides: Partial<Awaited<ReturnType<typeof budgetRepository.findByIdForUser>>> = {},
) {
  return {
    id: "b-1",
    userId: "u-1",
    categoryId: "c-1",
    type: "MONTHLY" as const,
    month: 0,
    year: 0,
    limitAmount: d(500),
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("calculateBudgetStatus", () => {
  it("returns correct values for partial usage", () => {
    const result = calculateBudgetStatus(d(250), d(500));
    expect(result.percentageUsed).toBe(50);
    expect(result.remainingAmount.equals(d(250))).toBe(true);
    expect(result.isOverBudget).toBe(false);
  });

  it("returns correct values at the exact limit", () => {
    const result = calculateBudgetStatus(d(500), d(500));
    expect(result.percentageUsed).toBe(100);
    expect(result.remainingAmount.equals(d(0))).toBe(true);
    expect(result.isOverBudget).toBe(false);
  });

  it("returns correct values when over budget", () => {
    const result = calculateBudgetStatus(d(600), d(500));
    expect(result.percentageUsed).toBe(120);
    expect(result.remainingAmount.equals(d(-100))).toBe(true);
    expect(result.isOverBudget).toBe(true);
  });

  it("rounds percentageUsed to 2 decimal places", () => {
    // 1/3 of 300 = 100 spent out of 300 = 33.33%
    const result = calculateBudgetStatus(d("100"), d("300"));
    expect(result.percentageUsed).toBe(33.33);
  });

  it("returns 0% when nothing is spent", () => {
    const result = calculateBudgetStatus(d(0), d(500));
    expect(result.percentageUsed).toBe(0);
    expect(result.remainingAmount.equals(d(500))).toBe(true);
    expect(result.isOverBudget).toBe(false);
  });

  it("returns 0% when limit is zero", () => {
    const result = calculateBudgetStatus(d(0), d(0));
    expect(result.percentageUsed).toBe(0);
    expect(result.isOverBudget).toBe(false);
  });
});

describe("updateBudget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects limitAmount <= 0 with 400", async () => {
    await expect(updateBudget("b-1", "u-1", { limitAmount: 0 })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects categoryId not owned by user with 404", async () => {
    mockFindCategoryForUser.mockResolvedValue(null);
    await expect(updateBudget("b-1", "u-1", { categoryId: "c-x" })).rejects.toBeInstanceOf(
      ServiceError,
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 when budget does not exist", async () => {
    mockFindByIdForUser.mockResolvedValue(null);
    await expect(updateBudget("b-1", "u-1", { limitAmount: 100 })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects type change to SPECIFIC_MONTH_YEAR without month", async () => {
    mockFindByIdForUser.mockResolvedValue(existingBudget({ type: "MONTHLY", month: 0, year: 0 }));
    await expect(
      updateBudget("b-1", "u-1", { type: "SPECIFIC_MONTH_YEAR", year: 2026 }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("normalizes month/year to 0 when type changes to a general type", async () => {
    mockFindByIdForUser.mockResolvedValue(
      existingBudget({ type: "SPECIFIC_MONTH_YEAR", month: 7, year: 2026 }),
    );
    mockUpdate.mockResolvedValue({
      ...existingBudget({ type: "MONTHLY", month: 0, year: 0 }),
      currentSpending: d(0),
    });

    await updateBudget("b-1", "u-1", { type: "MONTHLY" });

    expect(mockUpdate).toHaveBeenCalledWith(
      "b-1",
      "u-1",
      expect.objectContaining({ type: "MONTHLY", month: 0, year: 0 }),
    );
  });

  it("propagates new month/year when type changes to a specific type", async () => {
    mockFindByIdForUser.mockResolvedValue(existingBudget({ type: "MONTHLY", month: 0, year: 0 }));
    mockUpdate.mockResolvedValue({
      ...existingBudget({ type: "SPECIFIC_MONTH_YEAR", month: 5, year: 2026 }),
      currentSpending: d(0),
    });

    await updateBudget("b-1", "u-1", {
      type: "SPECIFIC_MONTH_YEAR",
      month: 5,
      year: 2026,
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      "b-1",
      "u-1",
      expect.objectContaining({ type: "SPECIFIC_MONTH_YEAR", month: 5, year: 2026 }),
    );
  });

  it("passes through limitAmount-only update without altering type/month/year", async () => {
    mockFindByIdForUser.mockResolvedValue(existingBudget());
    mockUpdate.mockResolvedValue({
      ...existingBudget({ limitAmount: d(750) }),
      currentSpending: d(0),
    });

    await updateBudget("b-1", "u-1", { limitAmount: 750 });

    const call = mockUpdate.mock.calls[0][2];
    expect(call.limitAmount).toBe(750);
    expect(call.type).toBeUndefined();
    expect(call.month).toBeUndefined();
    expect(call.year).toBeUndefined();
  });
});
