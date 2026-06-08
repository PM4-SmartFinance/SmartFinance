import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getDashboardSummary,
  getDashboardCategories,
  getDashboardTrends,
} from "./dashboard.service.js";
import { ServiceError } from "../errors.js";
import { Prisma } from "@prisma/client";

vi.mock("../repositories/dashboard.repository.js", () => ({
  getSummary: vi.fn(),
  getCategoryTotals: vi.fn(),
  listDailyTrends: vi.fn(),
  // The service imports the real `dateStringToId`. Provide a real
  // implementation in the mock module so call paths that use it still work.
  dateStringToId: (dateStr: string) => {
    const parts = dateStr.split("-");
    if (parts.length !== 3) throw new Error(`bad date: ${dateStr}`);
    const [y, m, d] = parts.map(Number);
    return (y as number) * 10000 + (m as number) * 100 + (d as number);
  },
}));

import * as repo from "../repositories/dashboard.repository.js";

const mockRepo = vi.mocked(repo);

function makeAgg(amount: string | null) {
  return { _sum: { amount: amount !== null ? new Prisma.Decimal(amount) : null } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getDashboardSummary", () => {
  it("returns correct totals for a known set of transactions", async () => {
    mockRepo.getSummary.mockResolvedValue({
      incomeAgg: makeAgg("1500.00"),
      expenseAgg: makeAgg("-800.00"),
      transactionCount: 5,
    });

    const result = await getDashboardSummary("user-1", "2025-01-01", "2025-01-31");

    expect(result.totalIncome).toBe(1500);
    expect(result.totalExpenses).toBe(-800);
    expect(result.netBalance).toBe(700);
    expect(result.transactionCount).toBe(5);
  });

  it("returns zeros when there are no transactions in the range", async () => {
    mockRepo.getSummary.mockResolvedValue({
      incomeAgg: makeAgg(null),
      expenseAgg: makeAgg(null),
      transactionCount: 0,
    });

    const result = await getDashboardSummary("user-1", "2025-01-01", "2025-01-31");

    expect(result.totalIncome).toBe(0);
    expect(result.totalExpenses).toBe(0);
    expect(result.netBalance).toBe(0);
    expect(result.transactionCount).toBe(0);
  });

  it("throws 400 for a startDate that overflows into the next month (2025-02-30)", async () => {
    await expect(getDashboardSummary("user-1", "2025-02-30", "2025-03-01")).rejects.toThrow(
      new ServiceError(400, "startDate and endDate must be valid calendar dates"),
    );

    expect(mockRepo.getSummary).not.toHaveBeenCalled();
  });

  it("throws 400 for an endDate that overflows into the next month (2025-04-31)", async () => {
    await expect(getDashboardSummary("user-1", "2025-01-01", "2025-04-31")).rejects.toThrow(
      new ServiceError(400, "startDate and endDate must be valid calendar dates"),
    );

    expect(mockRepo.getSummary).not.toHaveBeenCalled();
  });

  it("throws 400 when startDate is a semantically invalid calendar date", async () => {
    await expect(getDashboardSummary("user-1", "2025-13-40", "2025-12-31")).rejects.toThrow(
      new ServiceError(400, "startDate and endDate must be valid calendar dates"),
    );

    expect(mockRepo.getSummary).not.toHaveBeenCalled();
  });

  it("throws 400 when endDate is a semantically invalid calendar date", async () => {
    await expect(getDashboardSummary("user-1", "2025-01-01", "2025-00-01")).rejects.toThrow(
      new ServiceError(400, "startDate and endDate must be valid calendar dates"),
    );

    expect(mockRepo.getSummary).not.toHaveBeenCalled();
  });

  it("throws 400 when startDate is after endDate", async () => {
    await expect(getDashboardSummary("user-1", "2025-02-01", "2025-01-01")).rejects.toThrow(
      new ServiceError(400, "startDate must not be after endDate"),
    );
  });

  it("does not call the repository when startDate is after endDate", async () => {
    await expect(getDashboardSummary("user-1", "2025-12-31", "2025-01-01")).rejects.toThrow(
      ServiceError,
    );

    expect(mockRepo.getSummary).not.toHaveBeenCalled();
  });

  it("handles income-only period correctly", async () => {
    mockRepo.getSummary.mockResolvedValue({
      incomeAgg: makeAgg("2000.00"),
      expenseAgg: makeAgg(null),
      transactionCount: 3,
    });

    const result = await getDashboardSummary("user-1", "2025-01-01", "2025-03-31");

    expect(result.totalIncome).toBe(2000);
    expect(result.totalExpenses).toBe(0);
    expect(result.netBalance).toBe(2000);
  });

  it("handles expense-only period correctly", async () => {
    mockRepo.getSummary.mockResolvedValue({
      incomeAgg: makeAgg(null),
      expenseAgg: makeAgg("-350.50"),
      transactionCount: 2,
    });

    const result = await getDashboardSummary("user-1", "2025-01-01", "2025-03-31");

    expect(result.totalIncome).toBe(0);
    expect(result.totalExpenses).toBe(-350.5);
    expect(result.netBalance).toBe(-350.5);
  });

  it("accepts a same-day range (startDate equals endDate)", async () => {
    mockRepo.getSummary.mockResolvedValue({
      incomeAgg: makeAgg("42.00"),
      expenseAgg: makeAgg("-10.00"),
      transactionCount: 2,
    });

    const result = await getDashboardSummary("user-1", "2025-06-15", "2025-06-15");

    expect(result.netBalance).toBe(32);
    expect(result.transactionCount).toBe(2);
  });

  it("passes userId and date range to the repository", async () => {
    mockRepo.getSummary.mockResolvedValue({
      incomeAgg: makeAgg("0"),
      expenseAgg: makeAgg("0"),
      transactionCount: 0,
    });

    await getDashboardSummary("user-42", "2025-06-01", "2025-06-30");

    expect(mockRepo.getSummary).toHaveBeenCalledWith(
      "user-42",
      "2025-06-01",
      "2025-06-30",
      undefined,
    );
  });

  it("forwards the account filter to the repository", async () => {
    mockRepo.getSummary.mockResolvedValue({
      incomeAgg: { _sum: { amount: null } },
      expenseAgg: { _sum: { amount: null } },
      transactionCount: 0,
    });

    await getDashboardSummary("user-1", "2025-06-01", "2025-06-30", "acc-9");

    expect(mockRepo.getSummary).toHaveBeenCalledWith("user-1", "2025-06-01", "2025-06-30", "acc-9");
  });
});

describe("getDashboardCategories", () => {
  it("returns the category totals from the repository", async () => {
    const mockData = [{ categoryId: "cat-1", categoryName: "Test", total: 100 }];
    mockRepo.getCategoryTotals.mockResolvedValue(mockData);

    const result = await getDashboardCategories("user-1", "2025-01-01", "2025-01-31");

    expect(result).toEqual(mockData);
    expect(mockRepo.getCategoryTotals).toHaveBeenCalledWith(
      "user-1",
      "2025-01-01",
      "2025-01-31",
      undefined,
    );
  });

  it("returns an empty array when the repository has no matching transactions", async () => {
    mockRepo.getCategoryTotals.mockResolvedValue([]);

    const result = await getDashboardCategories("user-1", "2025-01-01", "2025-01-31");

    expect(result).toEqual([]);
  });

  it("accepts a same-day range (startDate equals endDate)", async () => {
    mockRepo.getCategoryTotals.mockResolvedValue([]);

    await expect(getDashboardCategories("user-1", "2025-06-15", "2025-06-15")).resolves.toEqual([]);
    expect(mockRepo.getCategoryTotals).toHaveBeenCalledWith(
      "user-1",
      "2025-06-15",
      "2025-06-15",
      undefined,
    );
  });

  it("passes userId, date range, and account filter to the repository unchanged", async () => {
    mockRepo.getCategoryTotals.mockResolvedValue([]);

    await getDashboardCategories("user-42", "2025-06-01", "2025-06-30", "acc-9");

    expect(mockRepo.getCategoryTotals).toHaveBeenCalledWith(
      "user-42",
      "2025-06-01",
      "2025-06-30",
      "acc-9",
    );
  });

  it("throws 400 when startDate is after endDate", async () => {
    await expect(getDashboardCategories("user-1", "2025-02-01", "2025-01-01")).rejects.toThrow(
      new ServiceError(400, "startDate must not be after endDate"),
    );
    expect(mockRepo.getCategoryTotals).not.toHaveBeenCalled();
  });

  it("throws 400 for invalid dates", async () => {
    await expect(getDashboardCategories("user-1", "not-a-date", "2025-01-01")).rejects.toThrow(
      new ServiceError(400, "startDate and endDate must be valid calendar dates"),
    );
  });

  it("throws 400 for startDate that overflows into the next month (2025-02-30)", async () => {
    await expect(getDashboardCategories("user-1", "2025-02-30", "2025-03-01")).rejects.toThrow(
      new ServiceError(400, "startDate and endDate must be valid calendar dates"),
    );
    expect(mockRepo.getCategoryTotals).not.toHaveBeenCalled();
  });

  it("throws 400 for endDate that overflows into the next month (2025-04-31)", async () => {
    await expect(getDashboardCategories("user-1", "2025-01-01", "2025-04-31")).rejects.toThrow(
      new ServiceError(400, "startDate and endDate must be valid calendar dates"),
    );
    expect(mockRepo.getCategoryTotals).not.toHaveBeenCalled();
  });

  it("wraps repository errors with contextual information and preserves the cause", async () => {
    const dbErr = new Error("connection refused");
    mockRepo.getCategoryTotals.mockRejectedValue(dbErr);

    const thrown = await getDashboardCategories("user-1", "2025-01-01", "2025-01-31").catch(
      (err: unknown) => err,
    );

    expect(thrown).toBeInstanceOf(Error);
    const wrapped = thrown as Error;
    expect(wrapped.message).toContain("user-1");
    expect(wrapped.message).toContain("2025-01-01");
    expect(wrapped.message).toContain("2025-01-31");
    expect(wrapped.cause).toBe(dbErr);
  });
});

describe("getDashboardTrends", () => {
  it("returns one entry per day in the range, gap-filling missing days with zeros", async () => {
    // Repo returns only the days that actually have transactions.
    mockRepo.listDailyTrends.mockResolvedValue([
      { date: "2025-01-02", income: 100, expenses: 40 },
      { date: "2025-01-04", income: 0, expenses: 25 },
    ]);

    const result = await getDashboardTrends("user-1", "2025-01-01", "2025-01-05");

    expect(result).toHaveLength(5);
    expect(result.map((r) => r.date)).toEqual([
      "2025-01-01",
      "2025-01-02",
      "2025-01-03",
      "2025-01-04",
      "2025-01-05",
    ]);
    expect(result[0]).toEqual({ date: "2025-01-01", income: 0, expenses: 0 });
    expect(result[1]).toEqual({ date: "2025-01-02", income: 100, expenses: 40 });
    expect(result[2]).toEqual({ date: "2025-01-03", income: 0, expenses: 0 });
    expect(result[3]).toEqual({ date: "2025-01-04", income: 0, expenses: 25 });
    expect(result[4]).toEqual({ date: "2025-01-05", income: 0, expenses: 0 });
  });

  it("returns a single zero-filled day for a same-day range with no transactions", async () => {
    mockRepo.listDailyTrends.mockResolvedValue([]);

    const result = await getDashboardTrends("user-1", "2025-06-15", "2025-06-15");

    expect(result).toEqual([{ date: "2025-06-15", income: 0, expenses: 0 }]);
  });

  it("handles a year-boundary range correctly", async () => {
    mockRepo.listDailyTrends.mockResolvedValue([
      { date: "2024-12-31", income: 50, expenses: 10 },
      { date: "2025-01-01", income: 60, expenses: 20 },
    ]);

    const result = await getDashboardTrends("user-1", "2024-12-31", "2025-01-01");

    expect(result).toEqual([
      { date: "2024-12-31", income: 50, expenses: 10 },
      { date: "2025-01-01", income: 60, expenses: 20 },
    ]);
  });

  it("returns all-zero days when the user has no transactions in the range", async () => {
    mockRepo.listDailyTrends.mockResolvedValue([]);

    const result = await getDashboardTrends("user-1", "2025-03-01", "2025-03-03");

    expect(result).toEqual([
      { date: "2025-03-01", income: 0, expenses: 0 },
      { date: "2025-03-02", income: 0, expenses: 0 },
      { date: "2025-03-03", income: 0, expenses: 0 },
    ]);
  });

  it("passes userId and computed dateIds to the repository", async () => {
    mockRepo.listDailyTrends.mockResolvedValue([]);

    await getDashboardTrends("user-42", "2025-06-15", "2025-06-17");

    expect(mockRepo.listDailyTrends).toHaveBeenCalledWith({
      userId: "user-42",
      startDateId: 20250615,
      endDateId: 20250617,
      accountId: undefined,
    });
  });

  it("forwards the account filter to the repository", async () => {
    mockRepo.listDailyTrends.mockResolvedValue([]);

    await getDashboardTrends("user-1", "2025-06-15", "2025-06-17", "acc-9");

    expect(mockRepo.listDailyTrends).toHaveBeenCalledWith({
      userId: "user-1",
      startDateId: 20250615,
      endDateId: 20250617,
      accountId: "acc-9",
    });
  });

  it("throws 400 when startDate is after endDate (does not call the repository)", async () => {
    await expect(getDashboardTrends("user-1", "2025-02-01", "2025-01-01")).rejects.toThrow(
      new ServiceError(400, "startDate must not be after endDate"),
    );
    expect(mockRepo.listDailyTrends).not.toHaveBeenCalled();
  });

  it("throws 400 for an invalid calendar date (does not call the repository)", async () => {
    await expect(getDashboardTrends("user-1", "2025-02-30", "2025-03-01")).rejects.toThrow(
      new ServiceError(400, "startDate and endDate must be valid calendar dates"),
    );
    expect(mockRepo.listDailyTrends).not.toHaveBeenCalled();
  });
});
