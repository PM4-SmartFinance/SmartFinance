import { describe, it, expect, vi, beforeEach } from "vitest";
import { importTransactions } from "./import.service.js";
import { ServiceError } from "../errors.js";

vi.mock("../repositories/transaction.repository.js", () => ({
  findAccountByIdAndUser: vi.fn(),
  upsertDate: vi.fn(),
  findOrCreateMerchant: vi.fn(),
  insertTransactions: vi.fn(),
}));

vi.mock("../prisma.js", () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn({})),
  },
}));

import * as repo from "../repositories/transaction.repository.js";

const NEON_HEADER = `"Date";"Amount";"Original amount";"Original currency";"Exchange rate";"Description";"Subject";"Category";"Tags";"Wise";"Spaces"`;
const NEON_ROW = `"2025-01-15";"42.00";"";"";"";"Grocery Store";"ref";"uncategorized";"";"no";"no"`;

const mockRepo = vi.mocked(repo);

beforeEach(() => {
  vi.clearAllMocks();
  mockRepo.findAccountByIdAndUser.mockResolvedValue({ id: "acc-1" } as never);
  mockRepo.upsertDate.mockResolvedValue({ id: 20250115 } as never);
  mockRepo.findOrCreateMerchant.mockResolvedValue({ id: "merchant-1" } as never);
  mockRepo.insertTransactions.mockResolvedValue(undefined);
});

describe("importTransactions", () => {
  it("throws 404 when account does not belong to the user", async () => {
    mockRepo.findAccountByIdAndUser.mockResolvedValue(null);

    await expect(
      importTransactions({
        csvText: [NEON_HEADER, NEON_ROW].join("\n"),
        format: "neon",
        accountId: "acc-x",
        userId: "user-1",
      }),
    ).rejects.toThrow(new ServiceError(404, "Account not found"));
  });

  it("returns the correct imported count on success", async () => {
    const csv = [NEON_HEADER, NEON_ROW, NEON_ROW, NEON_ROW].join("\n");

    const result = await importTransactions({
      csvText: csv,
      format: "neon",
      accountId: "acc-1",
      userId: "user-1",
    });

    expect(result).toEqual({ imported: 3 });
  });

  it("calls insertTransactions with the correct number of rows", async () => {
    const csv = [NEON_HEADER, NEON_ROW, NEON_ROW].join("\n");

    await importTransactions({
      csvText: csv,
      format: "neon",
      accountId: "acc-1",
      userId: "user-1",
    });

    const rows = mockRepo.insertTransactions.mock.calls[0]![0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ accountId: "acc-1", userId: "user-1", amount: 42 });
  });

  it("propagates a parser ServiceError without wrapping it", async () => {
    await expect(
      importTransactions({
        csvText: "garbage,csv,content",
        format: "neon",
        accountId: "acc-1",
        userId: "user-1",
      }),
    ).rejects.toThrow(ServiceError);
  });

  it("wraps the writes in a single DB transaction", async () => {
    const { prisma } = await import("../prisma.js");
    const csv = [NEON_HEADER, NEON_ROW].join("\n");

    await importTransactions({
      csvText: csv,
      format: "neon",
      accountId: "acc-1",
      userId: "user-1",
    });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("works correctly for the zkb format", async () => {
    const zkbHeader = `"Date";"Booking text";"Curr";"Amount details";"ZKB reference";"Reference number";"Debit CHF";"Credit CHF";"Value date";"Balance CHF";"Payment purpose";"Details"`;
    const zkbRow = `"13.03.2026";"Credit TWINT: MAX MUSTER";"";"";"REF1";"";"";"25.00";"13.03.2026";"327.89";"";""`;

    const result = await importTransactions({
      csvText: [zkbHeader, zkbRow].join("\n"),
      format: "zkb",
      accountId: "acc-1",
      userId: "user-1",
    });

    expect(result).toEqual({ imported: 1 });
  });

  it("works correctly for the wise format", async () => {
    const wiseHeader = `"TransferWise ID",Date,"Date Time",Amount,Currency,Description,"Payment Reference","Running Balance","Exchange From","Exchange To","Exchange Rate","Payer Name","Payee Name","Payee Account Number",Merchant,"Card Last Four Digits","Card Holder Full Name",Attachment,Note,"Total fees","Exchange To Amount","Transaction Type","Transaction Details Type"`;
    const wiseRow = `TRANSFER-1,29-01-2025,"29-01-2025 17:23:16.284",-211.27,EUR,"Geld überwiesen",,0.00,,,,,"Max Muster",,,,,,,0.00,,DEBIT,TRANSFER`;

    const result = await importTransactions({
      csvText: [wiseHeader, wiseRow].join("\n"),
      format: "wise",
      accountId: "acc-1",
      userId: "user-1",
    });

    expect(result).toEqual({ imported: 1 });
  });
});
