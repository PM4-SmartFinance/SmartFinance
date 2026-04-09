import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma.js", () => ({
  prisma: {
    dimAccount: { findMany: vi.fn() },
  },
}));

import { findAccountsByUser } from "./account.repository.js";
import { prisma } from "../prisma.js";

const mockFindMany = vi.mocked(prisma.dimAccount.findMany);

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

  it("selects only id, name, and iban fields", async () => {
    mockFindMany.mockResolvedValue([]);

    await findAccountsByUser("user-1");

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: { id: true, name: true, iban: true } }),
    );
  });

  it("orders results by name ascending", async () => {
    mockFindMany.mockResolvedValue([]);

    await findAccountsByUser("user-1");

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: "asc" } }),
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
