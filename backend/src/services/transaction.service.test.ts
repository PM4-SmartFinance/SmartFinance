import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listTransactions,
  getTransaction,
  updateTransaction,
  deleteTransaction,
} from "./transaction.service.js";
import * as transactionRepository from "../repositories/transaction.repository.js";
import { ServiceError } from "../errors.js";
import { logEventCritical } from "./audit.service.js";

vi.mock("./audit.service.js", () => ({
  logEvent: vi.fn(),
  logEventCritical: vi.fn(),
}));

vi.mock("../prisma.js", () => {
  const tx = Symbol("tx-mock");
  return {
    prisma: {
      // Pass the callback a sentinel `tx` so the service can forward it to the
      // repo. The repo is fully mocked in this file, so the sentinel is never
      // dereferenced.
      $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(tx)),
    },
  };
});

vi.mock("../repositories/transaction.repository.js", () => ({
  listTransactions: vi.fn(),
  findByIdForUser: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
}));

const mockRepo = vi.mocked(transactionRepository);

function makeRow(
  overrides: Partial<{
    id: string;
    amount: { toString: () => string };
    dateId: number;
    accountId: string;
    merchant: {
      id: string;
      name: string;
      mappings: Array<{ category: { id: string; categoryName: string } | null }>;
    };
  }> = {},
) {
  return {
    id: "t-1",
    amount: { toString: () => "42.00" },
    dateId: 20250115,
    accountId: "acc-1",
    merchant: {
      id: "m-1",
      name: "Grocery Store",
      mappings: [] as Array<{ category: { id: string; categoryName: string } | null }>,
    },
    ...overrides,
  };
}

const DEFAULT_PARAMS = {
  userId: "user-1",
  page: 1,
  limit: 20,
  sortBy: "date" as const,
  sortOrder: "desc" as const,
};

const mockTx = {
  id: "tx-1",
  amount: "10.50",
  dateId: 20260101,
  merchant: { name: "Merchant" },
  categoryId: "cat-1",
  notes: "old",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRepo.listTransactions.mockResolvedValue([[makeRow()], 1]);
  // @ts-expect-error -- partial mock for testing
  mockRepo.findByIdForUser.mockResolvedValue(mockTx);
});

describe("listTransactions", () => {
  describe("pagination", () => {
    it("page 1 produces skip 0 and take matching limit", async () => {
      await listTransactions({ ...DEFAULT_PARAMS, page: 1, limit: 20 });
      const args = mockRepo.listTransactions.mock.calls[0]![0];
      expect(args.skip).toBe(0);
      expect(args.take).toBe(20);
    });

    it("page 3 limit 10 produces skip 20", async () => {
      await listTransactions({ ...DEFAULT_PARAMS, page: 3, limit: 10 });
      const args = mockRepo.listTransactions.mock.calls[0]![0];
      expect(args.skip).toBe(20);
      expect(args.take).toBe(10);
    });

    it("calculates totalPages rounding up for non-even division", async () => {
      mockRepo.listTransactions.mockResolvedValue([[makeRow()], 21]);
      const result = await listTransactions({ ...DEFAULT_PARAMS, limit: 20 });
      expect(result.meta.totalPages).toBe(2);
    });

    it("totalPages is 0 when totalCount is 0", async () => {
      mockRepo.listTransactions.mockResolvedValue([[], 0]);
      const result = await listTransactions(DEFAULT_PARAMS);
      expect(result.meta.totalPages).toBe(0);
    });

    it("returns correct meta fields", async () => {
      mockRepo.listTransactions.mockResolvedValue([[makeRow(), makeRow()], 42]);
      const result = await listTransactions({ ...DEFAULT_PARAMS, page: 2, limit: 10 });
      expect(result.meta).toEqual({ totalCount: 42, totalPages: 5, page: 2, limit: 10 });
    });
  });

  describe("sorting", () => {
    it("sortBy date maps to dateId orderBy", async () => {
      await listTransactions({ ...DEFAULT_PARAMS, sortBy: "date", sortOrder: "asc" });
      const { orderBy } = mockRepo.listTransactions.mock.calls[0]![0];
      expect(orderBy).toEqual({ dateId: "asc" });
    });

    it("sortBy amount maps to amount orderBy", async () => {
      await listTransactions({ ...DEFAULT_PARAMS, sortBy: "amount", sortOrder: "desc" });
      const { orderBy } = mockRepo.listTransactions.mock.calls[0]![0];
      expect(orderBy).toEqual({ amount: "desc" });
    });

    it("sortBy merchant maps to nested merchant name orderBy", async () => {
      await listTransactions({ ...DEFAULT_PARAMS, sortBy: "merchant", sortOrder: "asc" });
      const { orderBy } = mockRepo.listTransactions.mock.calls[0]![0];
      expect(orderBy).toEqual({ merchant: { name: "asc" } });
    });
  });

  describe("filters", () => {
    it("always scopes where to userId", async () => {
      await listTransactions(DEFAULT_PARAMS);
      const { where } = mockRepo.listTransactions.mock.calls[0]![0];
      expect(where.userId).toBe("user-1");
    });

    it("startDate converts to gte dateId", async () => {
      await listTransactions({ ...DEFAULT_PARAMS, startDate: "2025-01-15" });
      const { where } = mockRepo.listTransactions.mock.calls[0]![0];
      expect(where.dateId).toMatchObject({ gte: 20250115 });
    });

    it("endDate converts to lte dateId", async () => {
      await listTransactions({ ...DEFAULT_PARAMS, endDate: "2025-12-31" });
      const { where } = mockRepo.listTransactions.mock.calls[0]![0];
      expect(where.dateId).toMatchObject({ lte: 20251231 });
    });

    it("startDate and endDate build compound dateId filter", async () => {
      await listTransactions({ ...DEFAULT_PARAMS, startDate: "2025-01-01", endDate: "2025-03-31" });
      const { where } = mockRepo.listTransactions.mock.calls[0]![0];
      expect(where.dateId).toEqual({ gte: 20250101, lte: 20250331 });
    });

    it("minAmount and maxAmount build amount range filter", async () => {
      await listTransactions({ ...DEFAULT_PARAMS, minAmount: 10, maxAmount: 100 });
      const { where } = mockRepo.listTransactions.mock.calls[0]![0];
      expect(where.amount).toEqual({ gte: 10, lte: 100 });
    });

    it("only minAmount builds gte-only amount filter", async () => {
      await listTransactions({ ...DEFAULT_PARAMS, minAmount: 50 });
      const { where } = mockRepo.listTransactions.mock.calls[0]![0];
      expect(where.amount).toEqual({ gte: 50 });
    });

    it("only maxAmount builds lte-only amount filter", async () => {
      await listTransactions({ ...DEFAULT_PARAMS, maxAmount: 200 });
      const { where } = mockRepo.listTransactions.mock.calls[0]![0];
      expect(where.amount).toEqual({ lte: 200 });
    });

    it("categoryId builds OR filter matching direct categoryId or merchant mapping", async () => {
      await listTransactions({ ...DEFAULT_PARAMS, categoryId: "cat-1" });
      const { where } = mockRepo.listTransactions.mock.calls[0]![0];
      expect(where.OR).toEqual([
        { categoryId: "cat-1" },
        {
          categoryId: null,
          merchant: { mappings: { some: { userId: "user-1", categoryId: "cat-1" } } },
        },
      ]);
    });

    it("all filters applied simultaneously", async () => {
      await listTransactions({
        ...DEFAULT_PARAMS,
        startDate: "2025-01-01",
        endDate: "2025-06-30",
        minAmount: 5,
        maxAmount: 500,
        categoryId: "cat-2",
      });
      const { where } = mockRepo.listTransactions.mock.calls[0]![0];
      expect(where.userId).toBe("user-1");
      expect(where.dateId).toEqual({ gte: 20250101, lte: 20250630 });
      expect(where.amount).toEqual({ gte: 5, lte: 500 });
      expect(where.OR).toEqual([
        { categoryId: "cat-2" },
        {
          categoryId: null,
          merchant: { mappings: { some: { userId: "user-1", categoryId: "cat-2" } } },
        },
      ]);
    });

    it("throws ServiceError 400 when minAmount exceeds maxAmount", async () => {
      await expect(
        listTransactions({ ...DEFAULT_PARAMS, minAmount: 100, maxAmount: 50 }),
      ).rejects.toThrow(new ServiceError(400, "minAmount must not exceed maxAmount"));
    });

    it("does not set dateId filter when no date params given", async () => {
      await listTransactions(DEFAULT_PARAMS);
      const { where } = mockRepo.listTransactions.mock.calls[0]![0];
      expect(where.dateId).toBeUndefined();
    });

    it("does not set amount filter when no amount params given", async () => {
      await listTransactions(DEFAULT_PARAMS);
      const { where } = mockRepo.listTransactions.mock.calls[0]![0];
      expect(where.amount).toBeUndefined();
    });

    it("search builds case-insensitive merchant name contains filter", async () => {
      await listTransactions({ ...DEFAULT_PARAMS, search: "Migros" });
      const { where } = mockRepo.listTransactions.mock.calls[0]![0];
      expect(where.merchant).toEqual({
        name: { contains: "Migros", mode: "insensitive" },
      });
    });

    it("search combined with categoryId keeps merchant name filter and adds categoryId OR", async () => {
      await listTransactions({ ...DEFAULT_PARAMS, search: "Coop", categoryId: "cat-1" });
      const { where } = mockRepo.listTransactions.mock.calls[0]![0];
      expect(where.merchant).toEqual({
        name: { contains: "Coop", mode: "insensitive" },
      });
      expect(where.OR).toEqual([
        { categoryId: "cat-1" },
        {
          categoryId: null,
          merchant: { mappings: { some: { userId: "user-1", categoryId: "cat-1" } } },
        },
      ]);
    });
  });

  describe("response shape", () => {
    it("amount is serialized as a string", async () => {
      const result = await listTransactions(DEFAULT_PARAMS);
      expect(typeof result.data[0]!.amount).toBe("string");
      expect(result.data[0]!.amount).toBe("42.00");
    });

    it("dateId 20250115 is converted to ISO date string 2025-01-15", async () => {
      const result = await listTransactions(DEFAULT_PARAMS);
      expect(result.data[0]!.date).toBe("2025-01-15");
    });

    it("dateId with single-digit day and month is zero-padded", async () => {
      mockRepo.listTransactions.mockResolvedValue([[makeRow({ dateId: 20250105 })], 1]);
      const result = await listTransactions(DEFAULT_PARAMS);
      expect(result.data[0]!.date).toBe("2025-01-05");
    });

    it("category fields are null when merchant has no mapping", async () => {
      const result = await listTransactions(DEFAULT_PARAMS);
      expect(result.data[0]!.categoryId).toBeNull();
      expect(result.data[0]!.categoryName).toBeNull();
    });

    it("category fields are populated from the user's merchant mapping", async () => {
      mockRepo.listTransactions.mockResolvedValue([
        [
          makeRow({
            merchant: {
              id: "m-1",
              name: "Grocery Store",
              mappings: [{ category: { id: "cat-1", categoryName: "Food" } }],
            },
          }),
        ],
        1,
      ]);
      const result = await listTransactions(DEFAULT_PARAMS);
      expect(result.data[0]!.categoryId).toBe("cat-1");
      expect(result.data[0]!.categoryName).toBe("Food");
    });

    it("returns an empty data array when repository returns no rows", async () => {
      mockRepo.listTransactions.mockResolvedValue([[], 0]);
      const result = await listTransactions(DEFAULT_PARAMS);
      expect(result.data).toHaveLength(0);
      expect(result.meta.totalCount).toBe(0);
    });
  });
});

function makeTxRow() {
  return { id: "tx-1", userId: "user-1", amount: "42.00", notes: null, manualOverride: false };
}

describe("getTransaction", () => {
  beforeEach(() => {
    mockRepo.findByIdForUser.mockResolvedValue(makeTxRow());
  });

  it("delegates to findByIdForUser with the given id and userId", async () => {
    await getTransaction("tx-1", "user-1");
    expect(mockRepo.findByIdForUser).toHaveBeenCalledExactlyOnceWith("tx-1", "user-1");
  });

  it("returns the repository result unchanged", async () => {
    const row = makeTxRow();
    mockRepo.findByIdForUser.mockResolvedValue(row);
    expect(await getTransaction("tx-1", "user-1")).toBe(row);
  });

  it("propagates ServiceError from the repository", async () => {
    mockRepo.findByIdForUser.mockRejectedValue(new ServiceError(404, "Transaction not found"));
    await expect(getTransaction("missing", "user-1")).rejects.toThrow(
      new ServiceError(404, "Transaction not found"),
    );
  });
});

describe("updateTransaction", () => {
  beforeEach(() => {
    mockRepo.updateById.mockResolvedValue(makeTxRow());
  });

  it("does not add manualOverride when only notes is provided", async () => {
    await updateTransaction("tx-1", "user-1", { notes: "hello" });
    expect(mockRepo.updateById).toHaveBeenCalledExactlyOnceWith(
      "tx-1",
      "user-1",
      {
        notes: "hello",
      },
      false,
      expect.anything(),
    );
  });

  it("calls the repository with manualOverride: true when categoryId is provided", async () => {
    await updateTransaction("tx-1", "user-1", { categoryId: "new-cat" });
    expect(transactionRepository.updateById).toHaveBeenCalledWith(
      "tx-1",
      "user-1",
      expect.objectContaining({ categoryId: "new-cat", manualOverride: true }),
      false,
      expect.anything(),
    );
  });

  it("calls logEventCritical when changes are made", async () => {
    await updateTransaction("tx-1", "user-1", { notes: "new", reason: "test reason" });
    expect(logEventCritical).toHaveBeenCalledWith(
      {
        action: "TRANSACTION_EDIT",
        userId: "user-1",
        transactionId: "tx-1",
        previousValues: { notes: "old" },
        changedValues: { notes: "new" },
        reason: "test reason",
      },
      expect.anything(),
    );
  });

  it("supports date and amount updates with audit logging", async () => {
    await updateTransaction("tx-1", "user-1", { date: "2026-02-02", amount: 99.99 });
    expect(transactionRepository.updateById).toHaveBeenCalledWith(
      "tx-1",
      "user-1",
      expect.objectContaining({ dateId: 20260202, amount: 99.99 }),
      false,
      expect.anything(),
    );
    expect(logEventCritical).toHaveBeenCalledWith(
      expect.objectContaining({
        changedValues: { date: "2026-02-02", amount: 99.99 },
      }),
      expect.anything(),
    );
  });

  it("records targetUserId in changedValues when admin edits another user's transaction", async () => {
    // @ts-expect-error -- partial mock fixture
    mockRepo.findByIdForUser.mockResolvedValue({ ...mockTx, userId: "owner-9" });
    await updateTransaction("tx-1", "admin-1", { notes: "fixed" }, true);
    expect(logEventCritical).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        changedValues: expect.objectContaining({ targetUserId: "owner-9" }),
      }),
      expect.anything(),
    );
  });

  it("emits no audit event when PATCH values match the previous values (no-op)", async () => {
    await updateTransaction("tx-1", "user-1", { notes: "old" });
    expect(logEventCritical).not.toHaveBeenCalled();
  });

  it("returns the repository result unchanged", async () => {
    const row = makeTxRow();
    mockRepo.updateById.mockResolvedValue(row);
    expect(await updateTransaction("tx-1", "user-1", { notes: "x" })).toBe(row);
  });

  it("propagates ServiceError from the repository", async () => {
    mockRepo.updateById.mockRejectedValue(new ServiceError(404, "Transaction not found"));
    await expect(updateTransaction("missing", "user-1", { notes: "x" })).rejects.toThrow(
      new ServiceError(404, "Transaction not found"),
    );
  });
});

describe("deleteTransaction", () => {
  beforeEach(() => {
    mockRepo.deleteById.mockResolvedValue(undefined);
  });

  it("calls the repository with the given id and session user id", async () => {
    await deleteTransaction("tx-1", "user-1");
    expect(transactionRepository.deleteById).toHaveBeenCalledWith(
      "tx-1",
      "user-1",
      false,
      expect.anything(),
    );
  });

  it("calls logEventCritical on deletion", async () => {
    await deleteTransaction("tx-1", "user-1", "oops");
    expect(logEventCritical).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "TRANSACTION_DELETE",
        userId: "user-1",
        transactionId: "tx-1",
        previousValues: expect.objectContaining({ merchant: "Merchant" }),
        changedValues: expect.objectContaining({ isDeleted: true }),
        reason: "oops",
      }),
      expect.anything(),
    );
  });

  it("propagates ServiceError from the repository", async () => {
    mockRepo.deleteById.mockRejectedValue(new ServiceError(404, "Transaction not found"));
    await expect(deleteTransaction("missing", "user-1")).rejects.toThrow(
      new ServiceError(404, "Transaction not found"),
    );
  });
});
