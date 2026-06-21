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
      {
        categoryId: "cat-1",
        categoryName: "Rent",
        totalAmount: "1200.50",
        isUncategorized: false,
      },
      {
        categoryId: "cat-2",
        categoryName: "Food",
        totalAmount: "45.00",
        isUncategorized: false,
      },
    ] as never);

    const result = await getCategoryTotals("user-1", "2025-01-01", "2025-01-31");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ categoryId: "cat-1", categoryName: "Rent", total: 1200.5 });
    expect(result[1]).toEqual({ categoryId: "cat-2", categoryName: "Food", total: 45 });
  });

  it("sorts categorized rows by total desc with categoryName as tiebreaker", async () => {
    // Database returns rows in arbitrary order; the repository sorts in TS.
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { categoryId: "c", categoryName: "C", totalAmount: "50", isUncategorized: false },
      { categoryId: "b", categoryName: "B", totalAmount: "100", isUncategorized: false },
      { categoryId: "a", categoryName: "A", totalAmount: "100", isUncategorized: false },
    ] as never);

    const result = await getCategoryTotals("user-1", "2025-01-01", "2025-01-31");

    // 100/A, 100/B (alphabetical tiebreaker), then 50/C.
    expect(result.map((r) => r.categoryId)).toEqual(["a", "b", "c"]);
  });

  it("appends the Uncategorized row last and only when its total > 0", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      // Even though Uncategorized has the largest total, it must be pinned
      // last so the user sees their tracked categories first.
      {
        categoryId: null,
        categoryName: "Uncategorized",
        totalAmount: "999",
        isUncategorized: true,
      },
      { categoryId: "a", categoryName: "A", totalAmount: "100", isUncategorized: false },
      { categoryId: "b", categoryName: "B", totalAmount: "0", isUncategorized: false },
    ] as never);

    const result = await getCategoryTotals("user-1", "2025-01-01", "2025-01-31");

    expect(result).toHaveLength(3);
    expect(result[0]!.categoryId).toBe("a");
    expect(result[1]!.categoryId).toBe("b");
    expect(result[2]).toEqual({
      categoryId: null,
      categoryName: "Uncategorized",
      total: 999,
      isUncategorized: true,
    });
  });

  it("drops the Uncategorized row when its total is 0", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { categoryId: "a", categoryName: "A", totalAmount: "100", isUncategorized: false },
      { categoryId: null, categoryName: "Uncategorized", totalAmount: "0", isUncategorized: true },
    ] as never);

    const result = await getCategoryTotals("user-1", "2025-01-01", "2025-01-31");

    expect(result).toHaveLength(1);
    expect(result[0]!.categoryId).toBe("a");
  });

  it("returns an empty array when the query yields no rows", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);

    const result = await getCategoryTotals("user-1", "2025-01-01", "2025-01-31");

    expect(result).toEqual([]);
  });

  it("interpolates userId, startId, endId, and the Uncategorized label into $queryRaw", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);

    await getCategoryTotals("user-42", "2025-01-01", "2025-01-31");

    // $queryRaw is a tagged-template call: (strings, ...values). The SQL has
    // two parts (LEFT JOIN over categories, UNION ALL with the uncategorized
    // bucket). userId appears five times: c.userId + t.userId in part 1,
    // "userId" in part 2, plus the active-account subquery (KAN-169) which is
    // interpolated once per part. startId / endId each appear twice and the
    // literal "Uncategorized" appears once.
    const mockFn = vi.mocked(prisma.$queryRaw);
    expect(mockFn).toHaveBeenCalledTimes(1);
    const values = mockFn.mock.calls[0]!.slice(1);
    expect(values.filter((v) => v === "user-42")).toHaveLength(5);
    expect(values.filter((v) => v === 20250101)).toHaveLength(2);
    expect(values.filter((v) => v === 20250131)).toHaveLength(2);
    expect(values).toContain("Uncategorized");
  });

  it("includes a specific accountId in the interpolated parameters when provided", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);

    await getCategoryTotals("user-1", "2025-01-01", "2025-01-31", "acc-9");

    const values = vi.mocked(prisma.$queryRaw).mock.calls[0]!.slice(1);
    // The active-account subquery appears once per UNION part and references
    // accountId twice each → four occurrences.
    expect(values.filter((v) => v === "acc-9")).toHaveLength(4);
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
    // userId appears twice (main WHERE + active-account subquery); the subquery
    // also binds accountId twice — null here since none was provided (KAN-169).
    expect(values).toEqual(["user-42", "user-42", null, null, 20250101, 20250131]);
  });

  it("includes a specific accountId in the interpolated parameters when provided", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);

    await listDailyTrends({
      userId: "user-1",
      startDateId: 20250101,
      endDateId: 20250131,
      accountId: "acc-9",
    });

    const values = vi.mocked(prisma.$queryRaw).mock.calls[0]!.slice(1);
    expect(values).toContain("acc-9");
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
