import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ParsedTransaction } from "../services/importers/types.js";

vi.mock("../prisma.js", () => ({
  prisma: {
    $transaction: vi.fn(),
    factTransactions: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { bulkImport, findUncategorizedForUser, bulkSetCategory } from "./transaction.repository.js";
import { prisma } from "../prisma.js";

const mockTransaction = vi.mocked(prisma.$transaction);

function makeTx() {
  return {
    dimDate: {
      upsert: vi
        .fn()
        .mockImplementation(({ where, create }) => Promise.resolve({ id: where.id, ...create })),
    },
    dimMerchant: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: `m-${data.name}`, name: data.name }),
        ),
    },
    factTransactions: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

function parsed(overrides: Partial<ParsedTransaction> = {}): ParsedTransaction {
  return {
    date: new Date("2025-01-15T00:00:00Z"),
    amount: 42,
    description: "Grocery Store",
    subject: "ref",
    ...overrides,
  };
}

describe("bulkImport", () => {
  let tx: ReturnType<typeof makeTx>;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = makeTx();
    // @ts-expect-error -- mock tx is an intentional partial stub of TransactionClient
    mockTransaction.mockImplementation((cb) => cb(tx));
  });

  it("upserts each unique date exactly once", async () => {
    await bulkImport(
      [
        parsed({ date: new Date("2025-01-15T00:00:00Z") }),
        parsed({ date: new Date("2025-01-15T00:00:00Z") }),
        parsed({ date: new Date("2025-03-07T00:00:00Z") }),
      ],
      "u1",
      "a1",
    );

    expect(tx.dimDate.upsert).toHaveBeenCalledTimes(2);
  });

  it("finds or creates each unique merchant exactly once", async () => {
    await bulkImport(
      [
        parsed({ description: "Store A" }),
        parsed({ description: "Store A" }),
        parsed({ description: "Store B" }),
      ],
      "u1",
      "a1",
    );

    expect(tx.dimMerchant.findFirst).toHaveBeenCalledTimes(2);
  });

  it("reuses existing merchants without creating new ones", async () => {
    tx.dimMerchant.findFirst.mockResolvedValue({ id: "existing-id", name: "Known" });

    await bulkImport([parsed({ description: "Known" })], "u1", "a1");

    expect(tx.dimMerchant.create).not.toHaveBeenCalled();
    const { data } = tx.factTransactions.createMany.mock.calls[0]![0] as {
      data: Array<{ merchantId: string }>;
    };
    expect(data[0]!.merchantId).toBe("existing-id");
  });

  it("inserts all rows in a single createMany call", async () => {
    await bulkImport([parsed(), parsed(), parsed()], "u1", "a1");

    expect(tx.factTransactions.createMany).toHaveBeenCalledTimes(1);
    const { data } = tx.factTransactions.createMany.mock.calls[0]![0] as {
      data: unknown[];
    };
    expect(data).toHaveLength(3);
  });

  it("computes dateId as YYYYMMDD from UTC components", async () => {
    await bulkImport([parsed({ date: new Date("2025-03-07T00:00:00Z") })], "u1", "a1");

    const { data } = tx.factTransactions.createMany.mock.calls[0]![0] as {
      data: Array<{ dateId: number }>;
    };
    expect(data[0]!.dateId).toBe(20250307);
  });

  it("maps merchantId from the lookup", async () => {
    await bulkImport([parsed({ description: "Cafe" })], "u1", "a1");

    const { data } = tx.factTransactions.createMany.mock.calls[0]![0] as {
      data: Array<{ merchantId: string }>;
    };
    expect(data[0]!.merchantId).toBe("m-Cafe");
  });

  it("passes userId and accountId to every row", async () => {
    await bulkImport([parsed(), parsed()], "user-42", "acc-99");

    const { data } = tx.factTransactions.createMany.mock.calls[0]![0] as {
      data: Array<{ userId: string; accountId: string }>;
    };
    for (const row of data) {
      expect(row.userId).toBe("user-42");
      expect(row.accountId).toBe("acc-99");
    }
  });

  it("handles an empty array without errors", async () => {
    const result = await bulkImport([], "u1", "a1");

    expect(result).toBe(0);
    expect(tx.factTransactions.createMany).toHaveBeenCalledWith({ data: [] });
  });

  it("returns the count of parsed transactions", async () => {
    const result = await bulkImport([parsed(), parsed()], "u1", "a1");

    expect(result).toBe(2);
  });

  it("handles many rows with the same date and merchant", async () => {
    const rows = Array.from({ length: 100 }, () => parsed());

    await bulkImport(rows, "u1", "a1");

    expect(tx.dimDate.upsert).toHaveBeenCalledTimes(1);
    expect(tx.dimMerchant.findFirst).toHaveBeenCalledTimes(1);
    const { data } = tx.factTransactions.createMany.mock.calls[0]![0] as {
      data: unknown[];
    };
    expect(data).toHaveLength(100);
  });
});

describe("findUncategorizedForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.factTransactions.findMany).mockResolvedValue([]);
  });

  it("filters by userId, categoryId null, and manualOverride false", async () => {
    await findUncategorizedForUser("user-1");

    expect(prisma.factTransactions.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", categoryId: null, manualOverride: false },
      select: {
        id: true,
        amount: true,
        dateId: true,
        merchant: { select: { name: true } },
      },
    });
  });

  it("does not return transactions with manualOverride set — filter is in the query", async () => {
    await findUncategorizedForUser("user-1");

    const [args] = vi.mocked(prisma.factTransactions.findMany).mock.calls[0]!;
    expect(args.where).toMatchObject({ manualOverride: false });
  });

  it("returns the results from the query", async () => {
    const rows = [{ id: "tx-1", amount: -12.5, dateId: 20260412, merchant: { name: "Migros" } }];
    // @ts-expect-error -- mock returns a partial shape
    vi.mocked(prisma.factTransactions.findMany).mockResolvedValue(rows);

    const result = await findUncategorizedForUser("user-1");

    expect(result).toEqual(rows);
  });
});

describe("bulkSetCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 1 }]);
    vi.mocked(prisma.factTransactions.updateMany).mockResolvedValue({ count: 1 });
  });

  it("scopes every update to the requesting userId to prevent cross-user writes", async () => {
    await bulkSetCategory("user-1", [{ id: "tx-1", categoryId: "cat-a" }]);

    expect(prisma.factTransactions.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user-1" }) }),
    );
  });

  it("guards every update with manualOverride: false to never overwrite a manual choice", async () => {
    // Defense in depth: even though findUncategorizedForUser already filters
    // on manualOverride: false, the user can toggle the flag between read and
    // write. The repository must enforce the invariant on the write side.
    await bulkSetCategory("user-1", [
      { id: "tx-1", categoryId: "cat-a" },
      { id: "tx-2", categoryId: "cat-b" },
    ]);

    for (const call of vi.mocked(prisma.factTransactions.updateMany).mock.calls) {
      expect(call[0].where).toMatchObject({ manualOverride: false });
    }
  });

  it("groups updates by categoryId for batch efficiency", async () => {
    await bulkSetCategory("user-1", [
      { id: "tx-1", categoryId: "cat-a" },
      { id: "tx-2", categoryId: "cat-a" },
      { id: "tx-3", categoryId: "cat-b" },
    ]);

    expect(prisma.factTransactions.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.factTransactions.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["tx-1", "tx-2"] }, userId: "user-1", manualOverride: false },
      data: { categoryId: "cat-a" },
    });
    expect(prisma.factTransactions.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["tx-3"] }, userId: "user-1", manualOverride: false },
      data: { categoryId: "cat-b" },
    });
  });

  it("does not call updateMany or $transaction when updates array is empty", async () => {
    const result = await bulkSetCategory("user-1", []);

    expect(result).toBe(0);
    expect(prisma.factTransactions.updateMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("wraps all updates in a single $transaction call", async () => {
    await bulkSetCategory("user-1", [
      { id: "tx-1", categoryId: "cat-a" },
      { id: "tx-2", categoryId: "cat-b" },
    ]);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("returns the sum of affected rows reported by Prisma, not updates.length", async () => {
    // 2 manual overrides slipped through between read and write -> only 1 row
    // was actually updated even though we asked for 3.
    vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 1 }, { count: 0 }]);

    const result = await bulkSetCategory("user-1", [
      { id: "tx-1", categoryId: "cat-a" },
      { id: "tx-2", categoryId: "cat-a" },
      { id: "tx-3", categoryId: "cat-b" },
    ]);

    expect(result).toBe(1);
  });

  it("chunks large id lists into 1000-element batches to stay under bind-parameter limits", async () => {
    const updates = Array.from({ length: 2500 }, (_, i) => ({
      id: `tx-${i}`,
      categoryId: "cat-a",
    }));
    vi.mocked(prisma.$transaction).mockResolvedValue(
      Array.from({ length: 3 }, () => ({ count: 1000 })),
    );

    await bulkSetCategory("user-1", updates);

    // 2500 ids in a single category -> ceil(2500 / 1000) = 3 chunks.
    expect(prisma.factTransactions.updateMany).toHaveBeenCalledTimes(3);
    const callArgs = vi.mocked(prisma.factTransactions.updateMany).mock.calls;
    const idLists = callArgs.map((c) => (c[0].where as { id: { in: string[] } }).id.in);
    expect(idLists[0]).toHaveLength(1000);
    expect(idLists[1]).toHaveLength(1000);
    expect(idLists[2]).toHaveLength(500);
  });
});
