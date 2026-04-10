import { describe, it, expect, vi, beforeEach } from "vitest";
import { importTransactions } from "./import.service.js";
import { ServiceError } from "../errors.js";

vi.mock("../repositories/transaction.repository.js", () => ({
  findAccountByIdAndUser: vi.fn(),
  bulkImport: vi.fn(),
}));

vi.mock("./categorization.service.js", () => ({
  autoCategorize: vi.fn().mockResolvedValue({ categorized: 0 }),
}));

import * as repo from "../repositories/transaction.repository.js";
import * as categorizationService from "./categorization.service.js";

// Spy-able no-op logger that satisfies the ImportLogger interface.
const logger = { warn: vi.fn() };

const NEON_HEADER = `"Date";"Amount";"Original amount";"Original currency";"Exchange rate";"Description";"Subject";"Category";"Tags";"Wise";"Spaces"`;
const NEON_ROW = `"2025-01-15";"42.00";"";"";"";"Grocery Store";"ref";"uncategorized";"";"no";"no"`;

const mockRepo = vi.mocked(repo);

beforeEach(() => {
  vi.clearAllMocks();
  mockRepo.findAccountByIdAndUser.mockResolvedValue({ id: "acc-1" } as never);
  mockRepo.bulkImport.mockImplementation((parsed: unknown[]) => Promise.resolve(parsed.length));
  vi.mocked(categorizationService.autoCategorize).mockResolvedValue({ categorized: 0 });
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
        logger,
      }),
    ).rejects.toThrow(new ServiceError(404, "Account not found"));
  });

  it("returns the correct imported and categorized counts on success", async () => {
    vi.mocked(categorizationService.autoCategorize).mockResolvedValue({ categorized: 2 });
    const csv = [NEON_HEADER, NEON_ROW, NEON_ROW, NEON_ROW].join("\n");

    const result = await importTransactions({
      csvText: csv,
      format: "neon",
      accountId: "acc-1",
      userId: "user-1",
      logger,
    });

    expect(result).toEqual({ imported: 3, categorized: 2 });
  });

  it("calls bulkImport with the parsed transactions and correct ids", async () => {
    const csv = [NEON_HEADER, NEON_ROW, NEON_ROW].join("\n");

    await importTransactions({
      csvText: csv,
      format: "neon",
      accountId: "acc-1",
      userId: "user-1",
      logger,
    });

    const [parsedArg, userIdArg, accountIdArg] = mockRepo.bulkImport.mock.calls[0]!;
    expect(parsedArg).toHaveLength(2);
    expect(parsedArg[0]).toMatchObject({ amount: 42, description: "Grocery Store" });
    expect(userIdArg).toBe("user-1");
    expect(accountIdArg).toBe("acc-1");
  });

  it("propagates a parser ServiceError without wrapping it", async () => {
    await expect(
      importTransactions({
        csvText: "garbage,csv,content",
        format: "neon",
        accountId: "acc-1",
        userId: "user-1",
        logger,
      }),
    ).rejects.toThrow(ServiceError);
  });

  it("delegates all writes to bulkImport exactly once", async () => {
    const csv = [NEON_HEADER, NEON_ROW].join("\n");

    await importTransactions({
      csvText: csv,
      format: "neon",
      accountId: "acc-1",
      userId: "user-1",
      logger,
    });

    expect(mockRepo.bulkImport).toHaveBeenCalledOnce();
  });

  it("runs auto-categorization after import", async () => {
    const csv = [NEON_HEADER, NEON_ROW].join("\n");

    await importTransactions({
      csvText: csv,
      format: "neon",
      accountId: "acc-1",
      userId: "user-1",
      logger,
    });

    expect(vi.mocked(categorizationService.autoCategorize)).toHaveBeenCalledWith("user-1");
  });

  it("still resolves successfully when auto-categorization rejects", async () => {
    // The import transaction has already committed when categorization runs,
    // so a categorization failure must NOT be reported as an import failure.
    vi.mocked(categorizationService.autoCategorize).mockRejectedValueOnce(
      new Error("transient db error"),
    );
    const warnSpy = vi.fn();
    const csv = [NEON_HEADER, NEON_ROW].join("\n");

    const result = await importTransactions({
      csvText: csv,
      format: "neon",
      accountId: "acc-1",
      userId: "user-1",
      logger: { warn: warnSpy },
    });

    expect(result).toEqual({ imported: 1, categorized: 0 });
    expect(warnSpy).toHaveBeenCalledOnce();
    const [logObj, logMsg] = warnSpy.mock.calls[0]!;
    expect(logObj).toMatchObject({ userId: "user-1" });
    expect(logObj.err).toBeInstanceOf(Error);
    expect(logMsg).toMatch(/auto-categorize/i);
  });

  it("works correctly for the zkb format", async () => {
    const zkbHeader = `"Date";"Booking text";"Curr";"Amount details";"ZKB reference";"Reference number";"Debit CHF";"Credit CHF";"Value date";"Balance CHF";"Payment purpose";"Details"`;
    const zkbRow = `"13.03.2026";"Credit TWINT: MAX MUSTER";"";"";"REF1";"";"";"25.00";"13.03.2026";"327.89";"";""`;

    const result = await importTransactions({
      csvText: [zkbHeader, zkbRow].join("\n"),
      format: "zkb",
      accountId: "acc-1",
      userId: "user-1",
      logger,
    });

    expect(result).toEqual({ imported: 1, categorized: 0 });
  });

  it("works correctly for the wise format", async () => {
    const wiseHeader = `"TransferWise ID",Date,"Date Time",Amount,Currency,Description,"Payment Reference","Running Balance","Exchange From","Exchange To","Exchange Rate","Payer Name","Payee Name","Payee Account Number",Merchant,"Card Last Four Digits","Card Holder Full Name",Attachment,Note,"Total fees","Exchange To Amount","Transaction Type","Transaction Details Type"`;
    const wiseRow = `TRANSFER-1,29-01-2025,"29-01-2025 17:23:16.284",-211.27,EUR,"Geld überwiesen",,0.00,,,,,"Max Muster",,,,,,,0.00,,DEBIT,TRANSFER`;

    const result = await importTransactions({
      csvText: [wiseHeader, wiseRow].join("\n"),
      format: "wise",
      accountId: "acc-1",
      userId: "user-1",
      logger,
    });

    expect(result).toEqual({ imported: 1, categorized: 0 });
  });

  it("works correctly for the ubs format", async () => {
    const ubsHeader = `"Kontonummer";"Kartennummer";"Konto-/Karteninhaber";"Einkaufsdatum";"Buchungstext";"Branche";"Betrag";"Originalw\u00e4hrung";"Kurs";"W\u00e4hrung";"Belastung";"Gutschrift";"Buchung"`;
    const ubsRow = `"1234 5678 9101";"9999 99XX XXXX 9999";"M. MUSTERMANN";"21.07.2025";"Laden6";"Shop";"1.7";"CHF";"";"CHF";"1.7";"";"23.07.2025"`;

    const result = await importTransactions({
      csvText: [ubsHeader, ubsRow].join("\n"),
      format: "ubs",
      accountId: "acc-1",
      userId: "user-1",
      logger,
    });

    expect(result).toEqual({ imported: 1, categorized: 0 });
  });
});
