import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ServiceError } from "../errors.js";
import { registerImporter, clearImporterRegistry } from "./importer-registry.service.js";

vi.mock("../repositories/transaction.repository.js", () => ({
  findAccountByIdAndUser: vi.fn(),
  bulkImport: vi.fn(),
}));

vi.mock("../repositories/account.repository.js", () => ({
  findActiveAccountsByUser: vi.fn(),
  findActiveAccountByNumberAndUser: vi.fn(),
}));

vi.mock("./categorization.service.js", () => ({
  autoCategorize: vi.fn().mockResolvedValue({ categorized: 0 }),
}));

vi.mock("./module-registry.service.js", () => ({
  fireTransactionImported: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../repositories/import-mapping.repository.js", () => ({
  findBySignature: vi.fn(),
  upsertMapping: vi.fn(),
}));

import { importTransactions, detectImport } from "./import.service.js";
import * as repo from "../repositories/transaction.repository.js";
import * as accountRepo from "../repositories/account.repository.js";
import * as categorizationService from "./categorization.service.js";
import * as moduleRegistry from "./module-registry.service.js";
import * as importMappingRepo from "../repositories/import-mapping.repository.js";

// Spy-able no-op logger that satisfies the ImportLogger interface.
const logger = { warn: vi.fn() };

const NEON_HEADER = `"Date";"Amount";"Original amount";"Original currency";"Exchange rate";"Description";"Subject";"Category";"Tags";"Wise";"Spaces"`;
const NEON_ROW = `"2025-01-15";"42.00";"";"";"";"Grocery Store";"ref";"uncategorized";"";"no";"no"`;

const mockRepo = vi.mocked(repo);
const mockAccountRepo = vi.mocked(accountRepo);

beforeEach(() => {
  vi.clearAllMocks();
  mockRepo.findAccountByIdAndUser.mockResolvedValue({ id: "acc-1" } as never);
  mockRepo.bulkImport.mockImplementation((parsed: unknown[]) => Promise.resolve(parsed.length));
  mockAccountRepo.findActiveAccountsByUser.mockResolvedValue([]);
  mockAccountRepo.findActiveAccountByNumberAndUser.mockResolvedValue([]);
  vi.mocked(categorizationService.autoCategorize).mockResolvedValue({ categorized: 0 });
  vi.mocked(moduleRegistry.fireTransactionImported).mockResolvedValue(undefined);
  vi.mocked(importMappingRepo.findBySignature).mockResolvedValue(null);
  vi.mocked(importMappingRepo.upsertMapping).mockResolvedValue(undefined);
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

  it("falls back to the user's single account when no accountId is provided", async () => {
    mockAccountRepo.findActiveAccountsByUser.mockResolvedValue([
      { id: "acc-only", name: "Main", iban: "CH00 0000" },
    ] as never);
    const csv = [NEON_HEADER, NEON_ROW].join("\n");

    const result = await importTransactions({
      csvText: csv,
      format: "neon",
      userId: "user-1",
      logger,
    });

    expect(result.imported).toBe(1);
    const [, , accountIdArg] = mockRepo.bulkImport.mock.calls[0]!;
    expect(accountIdArg).toBe("acc-only");
    expect(mockRepo.findAccountByIdAndUser).not.toHaveBeenCalled();
  });

  it("throws 409 NO_MATCH with empty candidates when the user has no accounts", async () => {
    mockAccountRepo.findActiveAccountsByUser.mockResolvedValue([]);

    await expect(
      importTransactions({
        csvText: [NEON_HEADER, NEON_ROW].join("\n"),
        format: "neon",
        userId: "user-1",
        logger,
      }),
    ).rejects.toMatchObject({
      name: "ServiceError",
      statusCode: 409,
      details: { code: "NO_MATCH", candidates: [] },
    });
    expect(mockRepo.bulkImport).not.toHaveBeenCalled();
  });

  it("throws 409 AMBIGUOUS_ACCOUNT with candidates when the user has multiple accounts", async () => {
    const candidates = [
      { id: "acc-1", name: "Main", iban: "CH00 0001" },
      { id: "acc-2", name: "Savings", iban: "CH00 0002" },
    ];
    mockAccountRepo.findActiveAccountsByUser.mockResolvedValue(candidates as never);

    await expect(
      importTransactions({
        csvText: [NEON_HEADER, NEON_ROW].join("\n"),
        format: "neon",
        userId: "user-1",
        logger,
      }),
    ).rejects.toMatchObject({
      name: "ServiceError",
      statusCode: 409,
      details: { code: "AMBIGUOUS_ACCOUNT", candidates },
    });
    expect(mockRepo.bulkImport).not.toHaveBeenCalled();
  });

  it("auto-matches a UBS import to the account whose Kontonummer the file carries", async () => {
    // Two active accounts → ambiguous, but the UBS Kontonummer (column 0)
    // uniquely identifies acc-2, so resolution must not prompt the user.
    mockAccountRepo.findActiveAccountsByUser.mockResolvedValue([
      { id: "acc-1", name: "Main", iban: "CH00 0001" },
      { id: "acc-2", name: "Cards", iban: "CH00 0002" },
    ] as never);
    mockAccountRepo.findActiveAccountByNumberAndUser.mockResolvedValue([
      { id: "acc-2", name: "Cards", iban: "CH00 0002" },
    ] as never);

    const ubsHeader = `"Kontonummer";"Kartennummer";"Konto-/Karteninhaber";"Einkaufsdatum";"Buchungstext";"Branche";"Betrag";"Originalwährung";"Kurs";"Währung";"Belastung";"Gutschrift";"Buchung"`;
    const ubsRow = `"1234 5678 9101";"9999 99XX XXXX 9999";"M. MUSTERMANN";"21.07.2025";"Laden6";"Shop";"1.7";"CHF";"";"CHF";"1.7";"";"23.07.2025"`;

    const result = await importTransactions({
      csvText: [ubsHeader, ubsRow].join("\n"),
      format: "ubs",
      userId: "user-1",
      logger,
    });

    expect(result.imported).toBe(1);
    expect(mockAccountRepo.findActiveAccountByNumberAndUser).toHaveBeenCalledWith(
      "1234 5678 9101",
      "user-1",
    );
    const [, , accountIdArg] = mockRepo.bulkImport.mock.calls[0]!;
    expect(accountIdArg).toBe("acc-2");
  });

  it("falls back to AMBIGUOUS_ACCOUNT when the UBS Kontonummer matches no account", async () => {
    // Hint is present but no active account carries that number → must prompt the
    // user rather than silently picking one.
    const candidates = [
      { id: "acc-1", name: "Main", iban: "CH00 0001" },
      { id: "acc-2", name: "Cards", iban: "CH00 0002" },
    ];
    mockAccountRepo.findActiveAccountsByUser.mockResolvedValue(candidates as never);
    mockAccountRepo.findActiveAccountByNumberAndUser.mockResolvedValue([]);

    const ubsHeader = `"Kontonummer";"Kartennummer";"Konto-/Karteninhaber";"Einkaufsdatum";"Buchungstext";"Branche";"Betrag";"Originalwährung";"Kurs";"Währung";"Belastung";"Gutschrift";"Buchung"`;
    const ubsRow = `"1234 5678 9101";"9999 99XX XXXX 9999";"M. MUSTERMANN";"21.07.2025";"Laden6";"Shop";"1.7";"CHF";"";"CHF";"1.7";"";"23.07.2025"`;

    await expect(
      importTransactions({
        csvText: [ubsHeader, ubsRow].join("\n"),
        format: "ubs",
        userId: "user-1",
        logger,
      }),
    ).rejects.toMatchObject({
      name: "ServiceError",
      statusCode: 409,
      details: { code: "AMBIGUOUS_ACCOUNT", candidates },
    });
    expect(mockRepo.bulkImport).not.toHaveBeenCalled();
  });

  it("falls back to AMBIGUOUS_ACCOUNT when the UBS Kontonummer matches several accounts", async () => {
    const candidates = [
      { id: "acc-1", name: "Main", iban: "CH00 0001" },
      { id: "acc-2", name: "Cards", iban: "CH00 0002" },
    ];
    mockAccountRepo.findActiveAccountsByUser.mockResolvedValue(candidates as never);
    // Two accounts share the number → not a unique match, so prompt the user.
    mockAccountRepo.findActiveAccountByNumberAndUser.mockResolvedValue(candidates as never);

    const ubsHeader = `"Kontonummer";"Kartennummer";"Konto-/Karteninhaber";"Einkaufsdatum";"Buchungstext";"Branche";"Betrag";"Originalwährung";"Kurs";"Währung";"Belastung";"Gutschrift";"Buchung"`;
    const ubsRow = `"1234 5678 9101";"9999 99XX XXXX 9999";"M. MUSTERMANN";"21.07.2025";"Laden6";"Shop";"1.7";"CHF";"";"CHF";"1.7";"";"23.07.2025"`;

    await expect(
      importTransactions({
        csvText: [ubsHeader, ubsRow].join("\n"),
        format: "ubs",
        userId: "user-1",
        logger,
      }),
    ).rejects.toMatchObject({
      name: "ServiceError",
      statusCode: 409,
      details: { code: "AMBIGUOUS_ACCOUNT", candidates },
    });
    expect(mockRepo.bulkImport).not.toHaveBeenCalled();
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

  it("throws 400 for an unknown format not in registry", async () => {
    await expect(
      importTransactions({
        csvText: "data",
        format: "unknown-bank",
        accountId: "acc-1",
        userId: "user-1",
        logger,
      }),
    ).rejects.toThrow(new ServiceError(400, "Unsupported import format: unknown-bank"));
  });

  describe("plugin format dispatch", () => {
    afterEach(() => {
      clearImporterRegistry();
    });

    it("dispatches to a registered plugin parser", async () => {
      const mockParse = vi
        .fn()
        .mockReturnValue([{ date: new Date(), amount: -10, description: "Test", subject: "" }]);
      registerImporter({ format: "test-bank", label: "Test Bank", parse: mockParse });

      const result = await importTransactions({
        csvText: "some,csv,data",
        format: "test-bank",
        accountId: "acc-1",
        userId: "user-1",
        logger,
      });

      expect(mockParse).toHaveBeenCalledWith("some,csv,data");
      expect(result.imported).toBe(1);
    });

    it("propagates a ServiceError thrown by a plugin parser", async () => {
      registerImporter({
        format: "bad-parser",
        label: "Bad Parser",
        parse: () => {
          throw new ServiceError(422, "bad csv");
        },
      });

      await expect(
        importTransactions({
          csvText: "garbage",
          format: "bad-parser",
          accountId: "acc-1",
          userId: "user-1",
          logger,
        }),
      ).rejects.toThrow(new ServiceError(422, "bad csv"));
    });
  });

  it("fires the onTransactionImported lifecycle hook after bulkImport", async () => {
    mockRepo.bulkImport.mockResolvedValue(2);
    const csv = [NEON_HEADER, NEON_ROW, NEON_ROW].join("\n");

    await importTransactions({
      csvText: csv,
      format: "neon",
      accountId: "acc-1",
      userId: "user-1",
      logger,
    });

    expect(vi.mocked(moduleRegistry.fireTransactionImported)).toHaveBeenCalledExactlyOnceWith({
      userId: "user-1",
      accountId: "acc-1",
      imported: 2,
    });
  });

  it("swallows a fireTransactionImported failure and logs a warning", async () => {
    mockRepo.bulkImport.mockResolvedValue(2);
    const fireErr = new Error("registry blew up");
    vi.mocked(moduleRegistry.fireTransactionImported).mockRejectedValueOnce(fireErr);
    const csv = [NEON_HEADER, NEON_ROW, NEON_ROW].join("\n");

    const result = await importTransactions({
      csvText: csv,
      format: "neon",
      accountId: "acc-1",
      userId: "user-1",
      logger,
    });

    expect(result).toEqual({ imported: 2, categorized: 0 });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: fireErr, userId: "user-1", accountId: "acc-1" }),
      "post-import fireTransactionImported failed",
    );
  });

  describe("custom mapping import (KAN-163)", () => {
    const CSV = ["Date,Name,Amount", "2025-01-15,Shop,-42.50"].join("\n");
    const mapping = { date: "Date", description: "Name", amount: "Amount" };

    it("parses via the generic mapping parser and imports", async () => {
      mockAccountRepo.findActiveAccountsByUser.mockResolvedValue([
        { id: "acc-only", name: "Main", iban: "CH00 0000" },
      ] as never);

      const result = await importTransactions({
        csvText: CSV,
        format: "custom",
        mapping,
        userId: "user-1",
        logger,
      });

      expect(result.imported).toBe(1);
      const [parsedArg] = mockRepo.bulkImport.mock.calls[0]!;
      expect(parsedArg[0]).toMatchObject({ amount: -42.5, description: "Shop" });
    });

    it("persists the mapping keyed by header signature after a successful import", async () => {
      const result = await importTransactions({
        csvText: CSV,
        format: "custom",
        mapping,
        accountId: "acc-1",
        userId: "user-1",
        logger,
      });

      expect(result.imported).toBe(1);
      expect(vi.mocked(importMappingRepo.upsertMapping)).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1", mapping }),
      );
      const [{ headerSignature }] = vi.mocked(importMappingRepo.upsertMapping).mock.calls[0]!;
      expect(headerSignature).not.toBe("");
    });

    it("still succeeds when persisting the mapping fails", async () => {
      const persistErr = new Error("storage down");
      vi.mocked(importMappingRepo.upsertMapping).mockRejectedValueOnce(persistErr);
      const warnSpy = vi.fn();

      const result = await importTransactions({
        csvText: CSV,
        format: "custom",
        mapping,
        accountId: "acc-1",
        userId: "user-1",
        logger: { warn: warnSpy },
      });

      expect(result.imported).toBe(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({ err: persistErr, userId: "user-1" }),
        "post-import persist column mapping failed",
      );
    });

    it("propagates a mapping parse error and does not import", async () => {
      await expect(
        importTransactions({
          csvText: ["Date,Name,Value", "2025-01-01,A,1"].join("\n"),
          format: "custom",
          mapping, // references "Amount", which the file lacks
          accountId: "acc-1",
          userId: "user-1",
          logger,
        }),
      ).rejects.toThrow(ServiceError);
      expect(mockRepo.bulkImport).not.toHaveBeenCalled();
    });
  });
});

describe("detectImport (KAN-163)", () => {
  beforeEach(() => {
    vi.mocked(importMappingRepo.findBySignature).mockResolvedValue(null);
  });

  it("returns a confident built-in detection with no saved mapping", async () => {
    const result = await detectImport({ csvText: [NEON_HEADER, NEON_ROW].join("\n"), userId: "u" });
    expect(result.detectedFormat).toBe("neon");
    expect(result.confidence).toBe(1);
    expect(result.savedMapping).toBeNull();
    expect(result.columns.length).toBeGreaterThan(0);
  });

  it("returns null format plus columns and any saved mapping for an unknown header", async () => {
    const saved = { date: "Datum", description: "Text", amount: "Wert" };
    vi.mocked(importMappingRepo.findBySignature).mockResolvedValue({
      headerSignature: "sig",
      format: null,
      mapping: saved,
    });

    const result = await detectImport({ csvText: "Datum,Text,Wert\n2025-01-01,A,1", userId: "u" });

    expect(result.detectedFormat).toBeNull();
    expect(result.columns).toEqual(["Datum", "Text", "Wert"]);
    expect(result.savedMapping).toEqual(saved);
    expect(vi.mocked(importMappingRepo.findBySignature)).toHaveBeenCalledWith(
      "u",
      result.headerSignature,
    );
  });
});
