import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculateBudgetStatus } from "./budget.service.js";

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
