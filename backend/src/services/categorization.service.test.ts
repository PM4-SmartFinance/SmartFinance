import { describe, it, expect, vi, beforeEach } from "vitest";
import { matchTransaction, autoCategorize } from "./categorization.service.js";

vi.mock("../repositories/category-rule.repository.js", () => ({
  findAllByUser: vi.fn(),
}));

vi.mock("../repositories/transaction.repository.js", () => ({
  findUncategorizedForUser: vi.fn(),
  bulkSetCategory: vi.fn(),
}));

import * as ruleRepo from "../repositories/category-rule.repository.js";
import * as txRepo from "../repositories/transaction.repository.js";

const mockRuleRepo = vi.mocked(ruleRepo);
const mockTxRepo = vi.mocked(txRepo);

// Helper to build a rule stub
function rule(
  pattern: string,
  matchType: "exact" | "contains",
  categoryId: string,
  priority: number,
) {
  return { pattern, matchType, categoryId, priority };
}

describe("matchTransaction", () => {
  it("returns null when rules list is empty", () => {
    expect(matchTransaction("Migros", [])).toBeNull();
  });

  it("returns null when no rule matches", () => {
    const rules = [rule("Coop", "contains", "cat-food", 10)];
    expect(matchTransaction("Migros", rules)).toBeNull();
  });

  it("matches an exact rule (case-insensitive)", () => {
    const rules = [rule("migros", "exact", "cat-1", 10)];
    expect(matchTransaction("Migros", rules)).toBe("cat-1");
    expect(matchTransaction("MIGROS", rules)).toBe("cat-1");
    expect(matchTransaction("migros", rules)).toBe("cat-1");
  });

  it("does not match exact rule when merchant has extra characters", () => {
    const rules = [rule("Migros", "exact", "cat-1", 10)];
    expect(matchTransaction("Migros Online", rules)).toBeNull();
  });

  it("matches a contains rule when pattern appears anywhere in name", () => {
    const rules = [rule("migros", "contains", "cat-1", 10)];
    expect(matchTransaction("Migros Online", rules)).toBe("cat-1");
    expect(matchTransaction("My Migros", rules)).toBe("cat-1");
    expect(matchTransaction("MIGROS", rules)).toBe("cat-1");
  });

  it("returns null when contains pattern is not in name", () => {
    const rules = [rule("coop", "contains", "cat-1", 10)];
    expect(matchTransaction("Migros", rules)).toBeNull();
  });

  it("returns categoryId of highest-priority matching rule", () => {
    // Rules already sorted by priority desc (as returned by findAllByUser)
    const rules = [
      rule("migros", "contains", "cat-high", 20),
      rule("migros", "contains", "cat-low", 5),
    ];
    expect(matchTransaction("Migros", rules)).toBe("cat-high");
  });

  it("falls through to lower-priority rule when higher one does not match", () => {
    const rules = [
      rule("coop", "contains", "cat-coop", 20),
      rule("migros", "contains", "cat-migros", 5),
    ];
    expect(matchTransaction("Migros", rules)).toBe("cat-migros");
  });

  it("prefers exact over contains when exact has higher priority", () => {
    const rules = [
      rule("Migros", "exact", "cat-exact", 15),
      rule("migros", "contains", "cat-contains", 5),
    ];
    expect(matchTransaction("Migros", rules)).toBe("cat-exact");
  });

  it("uses contains rule when exact does not match but contains does", () => {
    const rules = [
      rule("Migros Market", "exact", "cat-exact", 15),
      rule("migros", "contains", "cat-contains", 5),
    ];
    expect(matchTransaction("Migros", rules)).toBe("cat-contains");
  });
});

describe("autoCategorize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { categorized: 0 } when user has no rules", async () => {
    mockRuleRepo.findAllByUser.mockResolvedValue([]);

    const result = await autoCategorize("user-1");

    expect(result).toEqual({ categorized: 0 });
    expect(mockTxRepo.findUncategorizedForUser).not.toHaveBeenCalled();
    expect(mockTxRepo.bulkSetCategory).not.toHaveBeenCalled();
  });

  it("returns { categorized: 0 } when there are no uncategorized transactions", async () => {
    mockRuleRepo.findAllByUser.mockResolvedValue([
      {
        ...rule("Migros", "contains", "cat-1", 10),
        id: "r1",
        userId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: "cat-1", categoryName: "Groceries" },
      },
    ] as unknown as Awaited<ReturnType<typeof ruleRepo.findAllByUser>>);
    mockTxRepo.findUncategorizedForUser.mockResolvedValue([]);

    const result = await autoCategorize("user-1");

    expect(result).toEqual({ categorized: 0 });
    expect(mockTxRepo.bulkSetCategory).not.toHaveBeenCalled();
  });

  it("categorizes matching uncategorized transactions", async () => {
    mockRuleRepo.findAllByUser.mockResolvedValue([
      {
        ...rule("Migros", "contains", "cat-groceries", 10),
        id: "r1",
        userId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: "cat-groceries", categoryName: "Groceries" },
      },
    ] as unknown as Awaited<ReturnType<typeof ruleRepo.findAllByUser>>);
    mockTxRepo.findUncategorizedForUser.mockResolvedValue([
      { id: "tx-1", merchant: { name: "Migros Online" } },
      { id: "tx-2", merchant: { name: "Migros Bahnhof" } },
    ] as unknown as Awaited<ReturnType<typeof txRepo.findUncategorizedForUser>>);
    mockTxRepo.bulkSetCategory.mockResolvedValue(undefined);

    const result = await autoCategorize("user-1");

    expect(result).toEqual({ categorized: 2 });
    expect(mockTxRepo.bulkSetCategory).toHaveBeenCalledWith("user-1", [
      { id: "tx-1", categoryId: "cat-groceries" },
      { id: "tx-2", categoryId: "cat-groceries" },
    ]);
  });

  it("skips transactions whose merchant does not match any rule", async () => {
    mockRuleRepo.findAllByUser.mockResolvedValue([
      {
        ...rule("Coop", "exact", "cat-coop", 10),
        id: "r1",
        userId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: "cat-coop", categoryName: "Groceries" },
      },
    ] as unknown as Awaited<ReturnType<typeof ruleRepo.findAllByUser>>);
    mockTxRepo.findUncategorizedForUser.mockResolvedValue([
      { id: "tx-1", merchant: { name: "Migros" } },
      { id: "tx-2", merchant: { name: "Coop" } },
    ] as unknown as Awaited<ReturnType<typeof txRepo.findUncategorizedForUser>>);
    mockTxRepo.bulkSetCategory.mockResolvedValue(undefined);

    const result = await autoCategorize("user-1");

    expect(result).toEqual({ categorized: 1 });
    expect(mockTxRepo.bulkSetCategory).toHaveBeenCalledWith("user-1", [
      { id: "tx-2", categoryId: "cat-coop" },
    ]);
  });

  it("does not call bulkSetCategory when no transactions match", async () => {
    mockRuleRepo.findAllByUser.mockResolvedValue([
      {
        ...rule("Netflix", "exact", "cat-entertainment", 10),
        id: "r1",
        userId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: "cat-entertainment", categoryName: "Entertainment" },
      },
    ] as unknown as Awaited<ReturnType<typeof ruleRepo.findAllByUser>>);
    mockTxRepo.findUncategorizedForUser.mockResolvedValue([
      { id: "tx-1", merchant: { name: "Migros" } },
    ] as unknown as Awaited<ReturnType<typeof txRepo.findUncategorizedForUser>>);

    const result = await autoCategorize("user-1");

    expect(result).toEqual({ categorized: 0 });
    expect(mockTxRepo.bulkSetCategory).not.toHaveBeenCalled();
  });

  it("applies highest-priority rule when multiple rules match the same merchant", async () => {
    // Sorted by priority desc (as findAllByUser returns them)
    mockRuleRepo.findAllByUser.mockResolvedValue([
      {
        ...rule("Migros", "contains", "cat-groceries", 20),
        id: "r1",
        userId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: "cat-groceries", categoryName: "Groceries" },
      },
      {
        ...rule("migros", "contains", "cat-food", 5),
        id: "r2",
        userId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: "cat-food", categoryName: "Food" },
      },
    ] as unknown as Awaited<ReturnType<typeof ruleRepo.findAllByUser>>);
    mockTxRepo.findUncategorizedForUser.mockResolvedValue([
      { id: "tx-1", merchant: { name: "Migros Online" } },
    ] as unknown as Awaited<ReturnType<typeof txRepo.findUncategorizedForUser>>);
    mockTxRepo.bulkSetCategory.mockResolvedValue(undefined);

    await autoCategorize("user-1");

    expect(mockTxRepo.bulkSetCategory).toHaveBeenCalledWith("user-1", [
      { id: "tx-1", categoryId: "cat-groceries" },
    ]);
  });

  it("skips transactions with a null merchant without throwing", async () => {
    mockRuleRepo.findAllByUser.mockResolvedValue([
      {
        ...rule("Migros", "contains", "cat-1", 10),
        id: "r1",
        userId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: "cat-1", categoryName: "Groceries" },
      },
    ] as unknown as Awaited<ReturnType<typeof ruleRepo.findAllByUser>>);
    mockTxRepo.findUncategorizedForUser.mockResolvedValue([
      { id: "tx-1", merchant: null },
      { id: "tx-2", merchant: { name: "Migros" } },
    ] as unknown as Awaited<ReturnType<typeof txRepo.findUncategorizedForUser>>);
    mockTxRepo.bulkSetCategory.mockResolvedValue(undefined);

    const result = await autoCategorize("user-1");

    expect(result).toEqual({ categorized: 1 });
    expect(mockTxRepo.bulkSetCategory).toHaveBeenCalledWith("user-1", [
      { id: "tx-2", categoryId: "cat-1" },
    ]);
  });

  it("only evaluates each unique merchant name once across multiple transactions", async () => {
    mockRuleRepo.findAllByUser.mockResolvedValue([
      {
        ...rule("Migros", "contains", "cat-1", 10),
        id: "r1",
        userId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: "cat-1", categoryName: "Groceries" },
      },
    ] as unknown as Awaited<ReturnType<typeof ruleRepo.findAllByUser>>);
    mockTxRepo.findUncategorizedForUser.mockResolvedValue([
      { id: "tx-1", merchant: { name: "Migros" } },
      { id: "tx-2", merchant: { name: "Migros" } },
      { id: "tx-3", merchant: { name: "Migros" } },
    ] as unknown as Awaited<ReturnType<typeof txRepo.findUncategorizedForUser>>);
    mockTxRepo.bulkSetCategory.mockResolvedValue(undefined);

    const result = await autoCategorize("user-1");

    expect(result).toEqual({ categorized: 3 });
    // All three transactions should be categorized
    expect(mockTxRepo.bulkSetCategory).toHaveBeenCalledWith("user-1", [
      { id: "tx-1", categoryId: "cat-1" },
      { id: "tx-2", categoryId: "cat-1" },
      { id: "tx-3", categoryId: "cat-1" },
    ]);
  });
});
