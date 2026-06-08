import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma.js", () => {
  const dimAccount = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  };
  return {
    prisma: {
      dimAccount,
      dimUser: { findUnique: vi.fn() },
      factTransactions: { count: vi.fn() },
      // Run the callback against the same mocked client so the transactional
      // update path exercises dimAccount.findFirst/update.
      $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb({ dimAccount })),
    },
  };
});

import {
  findAccountsByUser,
  findActiveAccountsByUser,
  findActiveAccountByNumberAndUser,
  findById,
  findUserDefaultCurrencyId,
  countTransactions,
  create,
  update,
  remove,
} from "./account.repository.js";
import { prisma } from "../prisma.js";
import { Prisma } from "@prisma/client";
import { DuplicateAccountError } from "../errors.js";

const mockFindMany = vi.mocked(prisma.dimAccount.findMany);
const mockFindFirst = vi.mocked(prisma.dimAccount.findFirst);
const mockCreate = vi.mocked(prisma.dimAccount.create);
const mockUpdate = vi.mocked(prisma.dimAccount.update);
const mockDeleteMany = vi.mocked(prisma.dimAccount.deleteMany);
const mockUserFindUnique = vi.mocked(prisma.dimUser.findUnique);
const mockTxCount = vi.mocked(prisma.factTransactions.count);

function knownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("err", { code, clientVersion: "x" });
}

describe("findAccountsByUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries by userId", async () => {
    mockFindMany.mockResolvedValue([]);

    await findAccountsByUser("user-1");

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
  });

  it("selects the account fields including active and accountNumber", async () => {
    mockFindMany.mockResolvedValue([]);

    await findAccountsByUser("user-1");

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, name: true, iban: true, accountNumber: true, active: true },
      }),
    );
  });

  it("orders active accounts first, then by name ascending", async () => {
    mockFindMany.mockResolvedValue([]);

    await findAccountsByUser("user-1");

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    );
  });

  it("returns the accounts from prisma", async () => {
    const accounts = [
      { id: "acc-1", name: "Main Account", iban: "CH93 0076 2011 6238 5295 7" },
      { id: "acc-2", name: "Savings", iban: "CH56 0483 5012 3456 7800 9" },
    ];
    mockFindMany.mockResolvedValue(accounts as never);

    const result = await findAccountsByUser("user-1");

    expect(result).toEqual(accounts);
  });

  it("returns an empty array when the user has no accounts", async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await findAccountsByUser("user-1");

    expect(result).toEqual([]);
  });
});

describe("findActiveAccountsByUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries only active accounts for the user, ordered by name", async () => {
    mockFindMany.mockResolvedValue([]);

    await findActiveAccountsByUser("user-1");

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", active: true },
        orderBy: { name: "asc" },
      }),
    );
  });

  it("returns the accounts from prisma", async () => {
    const accounts = [
      { id: "acc-1", name: "Main", iban: "CH93", accountNumber: null, active: true },
    ];
    mockFindMany.mockResolvedValue(accounts as never);

    await expect(findActiveAccountsByUser("user-1")).resolves.toEqual(accounts);
  });
});

describe("findActiveAccountByNumberAndUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty array for a whitespace-only number without querying", async () => {
    await expect(findActiveAccountByNumberAndUser("   ", "user-1")).resolves.toEqual([]);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("queries active accounts with a non-null accountNumber for the user", async () => {
    mockFindMany.mockResolvedValue([]);

    await findActiveAccountByNumberAndUser("12345678", "user-1");

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", active: true, accountNumber: { not: null } },
      }),
    );
  });

  it("matches account numbers ignoring whitespace differences", async () => {
    const match = {
      id: "acc-1",
      name: "Main",
      iban: "CH93",
      accountNumber: "12345678 9101",
      active: true,
    };
    const other = {
      id: "acc-2",
      name: "Savings",
      iban: "CH56",
      accountNumber: "9999 9999",
      active: true,
    };
    mockFindMany.mockResolvedValue([match, other] as never);

    const result = await findActiveAccountByNumberAndUser("1234 5678 9101", "user-1");

    expect(result).toEqual([match]);
  });

  it("returns an empty array when no stored number matches", async () => {
    mockFindMany.mockResolvedValue([
      { id: "acc-1", name: "Main", iban: "CH93", accountNumber: "0000", active: true },
    ] as never);

    await expect(findActiveAccountByNumberAndUser("12345678", "user-1")).resolves.toEqual([]);
  });
});

describe("findById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scopes the lookup to id and userId", async () => {
    mockFindFirst.mockResolvedValue(null);
    await findById("acc-1", "user-1");
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "acc-1", userId: "user-1" } }),
    );
  });
});

describe("findUserDefaultCurrencyId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the user's default currency id", async () => {
    mockUserFindUnique.mockResolvedValue({ defaultCurrencyId: "cur-chf" } as never);
    await expect(findUserDefaultCurrencyId("user-1")).resolves.toBe("cur-chf");
  });

  it("returns null when the user is missing", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    await expect(findUserDefaultCurrencyId("user-1")).resolves.toBeNull();
  });
});

describe("countTransactions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts every transaction referencing the account", async () => {
    mockTxCount.mockResolvedValue(5);
    await expect(countTransactions("acc-1")).resolves.toBe(5);
    expect(mockTxCount).toHaveBeenCalledWith({ where: { accountId: "acc-1" } });
  });
});

describe("create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the created account", async () => {
    const created = { id: "acc-1", name: "Main", iban: "CH93" };
    mockCreate.mockResolvedValue(created as never);
    await expect(
      create({ userId: "user-1", name: "Main", iban: "CH93", currencyId: "cur-chf" }),
    ).resolves.toEqual(created);
  });

  it("maps a P2002 unique violation to DuplicateAccountError", async () => {
    mockCreate.mockRejectedValue(knownError("P2002"));
    await expect(
      create({ userId: "user-1", name: "Main", iban: "CH93", currencyId: "cur-chf" }),
    ).rejects.toBeInstanceOf(DuplicateAccountError);
  });
});

describe("update", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when the account is not owned by the user", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(update("acc-1", "user-1", { name: "X" })).resolves.toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("updates and returns the account when owned", async () => {
    mockFindFirst.mockResolvedValue({ id: "acc-1" } as never);
    const updated = { id: "acc-1", name: "X", iban: "CH93" };
    mockUpdate.mockResolvedValue(updated as never);
    await expect(update("acc-1", "user-1", { name: "X" })).resolves.toEqual(updated);
  });

  it("maps a P2002 unique violation to DuplicateAccountError", async () => {
    mockFindFirst.mockResolvedValue({ id: "acc-1" } as never);
    mockUpdate.mockRejectedValue(knownError("P2002"));
    await expect(update("acc-1", "user-1", { iban: "CH93" })).rejects.toBeInstanceOf(
      DuplicateAccountError,
    );
  });
});

describe("remove", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when a row was deleted", async () => {
    mockDeleteMany.mockResolvedValue({ count: 1 });
    await expect(remove("acc-1", "user-1")).resolves.toBe(true);
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { id: "acc-1", userId: "user-1" } });
  });

  it("returns false when nothing matched", async () => {
    mockDeleteMany.mockResolvedValue({ count: 0 });
    await expect(remove("acc-1", "user-1")).resolves.toBe(false);
  });
});
