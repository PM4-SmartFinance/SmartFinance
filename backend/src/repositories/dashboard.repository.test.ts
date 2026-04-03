import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { dateStringToId, getSummary } from "./dashboard.repository.js";

vi.mock("../prisma.js", () => ({
  prisma: {
    factTransactions: {
      aggregate: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma.js";

const mockPrisma = vi.mocked(prisma.factTransactions);

describe("dateStringToId", () => {
  it("converts a standard date to YYYYMMDD integer", () => {
    expect(dateStringToId("2025-06-15")).toBe(20250615);
  });

  it("preserves leading zero for single-digit month", () => {
    expect(dateStringToId("2025-01-01")).toBe(20250101);
  });

  it("preserves leading zero for single-digit day", () => {
    expect(dateStringToId("2025-09-05")).toBe(20250905);
  });

  it("handles end of year", () => {
    expect(dateStringToId("2025-12-31")).toBe(20251231);
  });

  it("handles year boundary (Jan 1 of new year)", () => {
    expect(dateStringToId("2026-01-01")).toBe(20260101);
  });
});

describe("getSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes correct dateId range to all three queries", async () => {
    mockPrisma.aggregate.mockResolvedValue({ _sum: { amount: null } } as never);
    mockPrisma.count.mockResolvedValue(0);

    await getSummary("user-1", "2025-01-01", "2025-01-31");

    const incomeCall = mockPrisma.aggregate.mock.calls[0]![0] as {
      where: { dateId: { gte: number; lte: number } };
    };
    const expenseCall = mockPrisma.aggregate.mock.calls[1]![0] as {
      where: { dateId: { gte: number; lte: number } };
    };
    const countCall = mockPrisma.count.mock.calls[0]![0] as {
      where: { dateId: { gte: number; lte: number } };
    };

    expect(incomeCall.where.dateId).toEqual({ gte: 20250101, lte: 20250131 });
    expect(expenseCall.where.dateId).toEqual({ gte: 20250101, lte: 20250131 });
    expect(countCall.where.dateId).toEqual({ gte: 20250101, lte: 20250131 });
  });

  it("filters income query to positive amounts only", async () => {
    mockPrisma.aggregate.mockResolvedValue({ _sum: { amount: null } } as never);
    mockPrisma.count.mockResolvedValue(0);

    await getSummary("user-1", "2025-01-01", "2025-01-31");

    const incomeCall = mockPrisma.aggregate.mock.calls[0]![0] as {
      where: { amount: { gt?: number; lt?: number } };
    };
    expect(incomeCall.where.amount).toEqual({ gt: 0 });
  });

  it("filters expense query to negative amounts only", async () => {
    mockPrisma.aggregate.mockResolvedValue({ _sum: { amount: null } } as never);
    mockPrisma.count.mockResolvedValue(0);

    await getSummary("user-1", "2025-01-01", "2025-01-31");

    const expenseCall = mockPrisma.aggregate.mock.calls[1]![0] as {
      where: { amount: { gt?: number; lt?: number } };
    };
    expect(expenseCall.where.amount).toEqual({ lt: 0 });
  });

  it("scopes all queries to the given userId", async () => {
    mockPrisma.aggregate.mockResolvedValue({ _sum: { amount: null } } as never);
    mockPrisma.count.mockResolvedValue(0);

    await getSummary("user-42", "2025-01-01", "2025-01-31");

    expect(
      (mockPrisma.aggregate.mock.calls[0]![0] as { where: { userId: string } }).where.userId,
    ).toBe("user-42");
    expect(
      (mockPrisma.aggregate.mock.calls[1]![0] as { where: { userId: string } }).where.userId,
    ).toBe("user-42");
    expect((mockPrisma.count.mock.calls[0]![0] as { where: { userId: string } }).where.userId).toBe(
      "user-42",
    );
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
