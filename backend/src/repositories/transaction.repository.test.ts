import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ParsedTransaction } from "../services/importers/types.js";

vi.mock("../prisma.js", () => ({
  prisma: { $transaction: vi.fn() },
}));

import { bulkImport } from "./transaction.repository.js";
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
