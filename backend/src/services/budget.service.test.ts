import { Prisma } from "@prisma/client";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { calculateBudgetStatus, createBudget } from "./budget.service.js";

const mockLogger = { warn: vi.fn(), error: vi.fn() };

vi.mock("../repositories/budget.repository.js", () => ({
  findCategoryForUser: vi.fn().mockResolvedValue({ id: "cat-1" }),
  create: vi.fn().mockResolvedValue({
    id: "budget-1",
    categoryId: "cat-1",
    type: "MONTHLY",
    month: 0,
    year: 0,
    limitAmount: new Prisma.Decimal(500),
    currentSpending: new Prisma.Decimal(0),
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: "user-1",
  }),
}));

vi.mock("./module-registry.service.js", () => ({
  fireBudgetCreated: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../logger.js", () => ({
  getLogger: vi.fn(() => mockLogger),
}));

import * as moduleRegistry from "./module-registry.service.js";

function d(value: string | number) {
  return new Prisma.Decimal(value);
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

describe("createBudget lifecycle hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(moduleRegistry.fireBudgetCreated).mockResolvedValue(undefined);
  });

  it("fires the onBudgetCreated lifecycle hook after repository create", async () => {
    await createBudget("user-1", "cat-1", "MONTHLY", 500);
    expect(vi.mocked(moduleRegistry.fireBudgetCreated)).toHaveBeenCalledExactlyOnceWith({
      userId: "user-1",
      budgetId: "budget-1",
      categoryId: "cat-1",
    });
  });

  it("swallows a registry failure and logs a warning", async () => {
    const err = new Error("registry bug");
    vi.mocked(moduleRegistry.fireBudgetCreated).mockRejectedValueOnce(err);
    await expect(createBudget("user-1", "cat-1", "MONTHLY", 500)).resolves.toBeDefined();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err }),
      "fireBudgetCreated unexpectedly threw",
    );
  });
});
