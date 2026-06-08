import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAccount, createAccount, updateAccount, deleteAccount } from "./account.service.js";
import * as accountRepository from "../repositories/account.repository.js";
import { DuplicateAccountError, ServiceError } from "../errors.js";

vi.mock("../repositories/account.repository.js", () => ({
  findAccountsByUser: vi.fn(),
  findById: vi.fn(),
  findUserDefaultCurrencyId: vi.fn(),
  countTransactions: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

const mockRepo = vi.mocked(accountRepository);

const ACCOUNT = { id: "acc-1", name: "Main", iban: "CH93 0076 2011 6238 5295 7" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAccount", () => {
  it("returns the account when it belongs to the user", async () => {
    mockRepo.findById.mockResolvedValue(ACCOUNT);
    await expect(getAccount("acc-1", "user-1")).resolves.toEqual(ACCOUNT);
    expect(mockRepo.findById).toHaveBeenCalledWith("acc-1", "user-1");
  });

  it("throws 404 when the account is missing", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(getAccount("acc-1", "user-1")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("createAccount", () => {
  it("creates with the user's default currency", async () => {
    mockRepo.findUserDefaultCurrencyId.mockResolvedValue("cur-chf");
    mockRepo.create.mockResolvedValue(ACCOUNT);

    const result = await createAccount("user-1", { name: "Main", iban: "CH93..." });

    expect(result).toEqual(ACCOUNT);
    expect(mockRepo.create).toHaveBeenCalledWith({
      userId: "user-1",
      name: "Main",
      iban: "CH93...",
      currencyId: "cur-chf",
    });
  });

  it("throws 400 when the user has no default currency", async () => {
    mockRepo.findUserDefaultCurrencyId.mockResolvedValue(null);
    await expect(createAccount("user-1", { name: "Main", iban: "CH93..." })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("maps a duplicate IBAN to a 409", async () => {
    mockRepo.findUserDefaultCurrencyId.mockResolvedValue("cur-chf");
    mockRepo.create.mockRejectedValue(new DuplicateAccountError());

    await expect(createAccount("user-1", { name: "Main", iban: "CH93..." })).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe("updateAccount", () => {
  it("returns the updated account", async () => {
    const updated = { ...ACCOUNT, name: "Renamed" };
    mockRepo.update.mockResolvedValue(updated);

    const result = await updateAccount("acc-1", "user-1", { name: "Renamed" });

    expect(result).toEqual(updated);
    expect(mockRepo.update).toHaveBeenCalledWith("acc-1", "user-1", { name: "Renamed" });
  });

  it("throws 404 when the account is missing or not owned", async () => {
    mockRepo.update.mockResolvedValue(null);
    await expect(updateAccount("acc-1", "user-1", { name: "Renamed" })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("maps a duplicate IBAN to a 409", async () => {
    mockRepo.update.mockRejectedValue(new DuplicateAccountError());
    await expect(updateAccount("acc-1", "user-1", { iban: "CH00..." })).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe("deleteAccount", () => {
  it("deletes when the account has no transactions", async () => {
    mockRepo.findById.mockResolvedValue(ACCOUNT);
    mockRepo.countTransactions.mockResolvedValue(0);
    mockRepo.remove.mockResolvedValue(true);

    await deleteAccount("acc-1", "user-1");

    expect(mockRepo.remove).toHaveBeenCalledWith("acc-1", "user-1");
  });

  it("throws 404 when the account is missing", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(deleteAccount("acc-1", "user-1")).rejects.toMatchObject({ statusCode: 404 });
    expect(mockRepo.remove).not.toHaveBeenCalled();
  });

  it("blocks deletion with a 409 when transactions reference the account", async () => {
    mockRepo.findById.mockResolvedValue(ACCOUNT);
    mockRepo.countTransactions.mockResolvedValue(7);

    await expect(deleteAccount("acc-1", "user-1")).rejects.toMatchObject({
      statusCode: 409,
      details: { code: "ACCOUNT_HAS_TRANSACTIONS", transactionCount: 7 },
    });
    expect(mockRepo.remove).not.toHaveBeenCalled();
  });

  it("surfaces ServiceError instances unchanged", async () => {
    mockRepo.findById.mockResolvedValue(ACCOUNT);
    mockRepo.countTransactions.mockResolvedValue(1);
    const err = await deleteAccount("acc-1", "user-1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceError);
  });
});
