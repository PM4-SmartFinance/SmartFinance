import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { getSummary, getCategoryTotals, listDailyTrends } from "./dashboard.repository.js";

vi.mock("../prisma.js", () => ({
  prisma: {
    factTransactions: {
      aggregate: vi.fn(),
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("preserves the order returned by the database (sort contract lives in SQL)", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { categoryId: "a", categoryName: "A", totalAmount: "100" },
      { categoryId: "b", categoryName: "B", totalAmount: "100" },
      { categoryId: "c", categoryName: "C", totalAmount: "50" },
    ] as never);

    const result = await getCategoryTotals("user-1", "2025-01-01", "2025-01-31");

    expect(result.map((r) => r.categoryId)).toEqual(["a", "b", "c"]);
  });

  it("returns an empty array when no categorized expenses exist", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);

    const result = await getCategoryTotals("user-1", "2025-01-01", "2025-01-31");

    expect(result).toEqual([]);
  });

  it("passes userId, startId, and endId as interpolated parameters to $queryRaw", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);

    await getCategoryTotals("user-42", "2025-01-01", "2025-01-31");

    // $queryRaw is a tagged-template call: (strings, ...values). We assert on
    // the interpolated values to prove the SQL was parameterized correctly.
    const mockFn = vi.mocked(prisma.$queryRaw);
    expect(mockFn).toHaveBeenCalledTimes(1);
    const values = mockFn.mock.calls[0]!.slice(1);
    expect(values).toEqual(["user-42", 20250101, 20250131]);
  });

  it("scopes the query to the given userId (regression guard against dropping WHERE)", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);

    await getCategoryTotals("user-xyz", "2025-06-01", "2025-06-30");

    const mockFn = vi.mocked(prisma.$queryRaw);
    expect(mockFn.mock.calls[0]!.slice(1)).toContain("user-xyz");
  });

  it("throws on out-of-range calendar date inputs (defence-in-depth in dateStringToId)", async () => {
    await expect(getCategoryTotals("user-1", "2025-13-99", "2025-12-31")).rejects.toThrow(
      /Invalid date string/,
    );
    expect(vi.mocked(prisma.$queryRaw)).not.toHaveBeenCalled();
  });
});

describe("listDailyTrends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps raw SQL rows to the DailyTrendAggregate interface (formatting dateId as YYYY-MM-DD)", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { dateId: 20250101, income: "100.50", expenses: "40.25" },
      { dateId: 20251231, income: "0", expenses: "9.99" },
    ] as never);

    const result = await listDailyTrends({
      userId: "user-1",
      startDateId: 20250101,
      endDateId: 20251231,
    });

    expect(result).toEqual([
      { date: "2025-01-01", income: 100.5, expenses: 40.25 },
      { date: "2025-12-31", income: 0, expenses: 9.99 },
    ]);
  });

  it("zero-pads single-digit months and days when formatting the date string", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { dateId: 20250203, income: "1", expenses: "2" },
    ] as never);

    const result = await listDailyTrends({
      userId: "user-1",
      startDateId: 20250203,
      endDateId: 20250203,
    });

    expect(result[0]!.date).toBe("2025-02-03");
  });

  it("passes userId, startDateId, and endDateId as interpolated parameters to $queryRaw", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);

    await listDailyTrends({ userId: "user-42", startDateId: 20250101, endDateId: 20250131 });

    const mockFn = vi.mocked(prisma.$queryRaw);
    expect(mockFn).toHaveBeenCalledTimes(1);
    const values = mockFn.mock.calls[0]!.slice(1);
    expect(values).toEqual(["user-42", 20250101, 20250131]);
  });

  it("returns an empty array when the query yields no rows", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);

    const result = await listDailyTrends({
      userId: "user-1",
      startDateId: 20250101,
      endDateId: 20250131,
    });

    expect(result).toEqual([]);
  });

  it("preserves the order returned by the database (chronological — contract lives in SQL)", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { dateId: 20250101, income: "1", expenses: "0" },
      { dateId: 20250102, income: "2", expenses: "0" },
      { dateId: 20250103, income: "3", expenses: "0" },
    ] as never);

    const result = await listDailyTrends({
      userId: "user-1",
      startDateId: 20250101,
      endDateId: 20250103,
    });

    expect(result.map((r) => r.date)).toEqual(["2025-01-01", "2025-01-02", "2025-01-03"]);
  });

  it("coerces stringified numeric DB values (income/expenses) to numbers", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { dateId: 20250115, income: "1234.56", expenses: "78.9" },
    ] as never);

    const result = await listDailyTrends({
      userId: "user-1",
      startDateId: 20250115,
      endDateId: 20250115,
    });

    expect(typeof result[0]!.income).toBe("number");
    expect(typeof result[0]!.expenses).toBe("number");
    expect(result[0]!.income).toBe(1234.56);
    expect(result[0]!.expenses).toBe(78.9);
  });
});
