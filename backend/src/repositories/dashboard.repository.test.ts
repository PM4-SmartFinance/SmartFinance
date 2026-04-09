import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { getSummary, getCategoryTotals } from "./dashboard.repository.js";

vi.mock("../prisma.js", () => ({
  prisma: {
    factTransactions: {
      aggregate: vi.fn(),
      count: vi.fn(),
    },
    $queryRaw: vi.fn(), //
  },
}));

import { prisma } from "../prisma.js";

const mockPrisma = vi.mocked(prisma.factTransactions);

describe("getSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes correct dateId range to all three queries", async () => {
    mockPrisma.aggregate.mockResolvedValue({ _sum: { amount: null } } as never);
    mockPrisma.count.mockResolvedValue(0);

    await getSummary("user-1", "2025-01-01", "2025-01-31");

    const expectedDateRange = { gte: 20250101, lte: 20250131 };
    expect(mockPrisma.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ dateId: expectedDateRange }) }),
    );
    expect(mockPrisma.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ dateId: expectedDateRange }) }),
    );
    expect(mockPrisma.aggregate).toHaveBeenCalledTimes(2);
  });

  it("filters income query to positive amounts only", async () => {
    mockPrisma.aggregate.mockResolvedValue({ _sum: { amount: null } } as never);
    mockPrisma.count.mockResolvedValue(0);

    await getSummary("user-1", "2025-01-01", "2025-01-31");

    expect(mockPrisma.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ amount: { gt: 0 } }) }),
    );
  });

  it("filters expense query to negative amounts only", async () => {
    mockPrisma.aggregate.mockResolvedValue({ _sum: { amount: null } } as never);
    mockPrisma.count.mockResolvedValue(0);

    await getSummary("user-1", "2025-01-01", "2025-01-31");

    expect(mockPrisma.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ amount: { lt: 0 } }) }),
    );
  });

  it("scopes all queries to the given userId", async () => {
    mockPrisma.aggregate.mockResolvedValue({ _sum: { amount: null } } as never);
    mockPrisma.count.mockResolvedValue(0);

    await getSummary("user-42", "2025-01-01", "2025-01-31");

    expect(mockPrisma.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user-42" }) }),
    );
    expect(mockPrisma.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user-42" }) }),
    );
    expect(mockPrisma.aggregate).toHaveBeenCalledTimes(2);
  });

  it("returns the aggregation results from all three queries", async () => {
    mockPrisma.aggregate
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal("1500.00") } } as never)
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal("-800.00") } } as never);
    mockPrisma.count.mockResolvedValue(5);

    const result = await getSummary("user-1", "2025-01-01", "2025-01-31");

    expect(result.incomeAgg._sum.amount?.toNumber()).toBe(1500);
    expect(result.expenseAgg._sum.amount?.toNumber()).toBe(-800);
    expect(result.transactionCount).toBe(5);
  });
});

describe("getCategoryTotals", () => {
  it("maps raw SQL rows to the CategoryTotalAggregate interface", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { categoryId: "cat-1", categoryName: "Rent", totalAmount: "1200.50" },
      { categoryId: "cat-2", categoryName: "Food", totalAmount: "45.00" },
    ] as never);

    const result = await getCategoryTotals("user-1", "2025-01-01", "2025-01-31");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ categoryId: "cat-1", categoryName: "Rent", total: 1200.5 });
    expect(result[1]).toEqual({ categoryId: "cat-2", categoryName: "Food", total: 45 });
  });
});
