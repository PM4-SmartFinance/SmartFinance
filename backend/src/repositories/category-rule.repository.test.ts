import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("../prisma.js", () => ({
  prisma: {
    categoryRule: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    dimCategory: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import {
  findAllByUser,
  findById,
  create,
  update,
  remove,
  findCategoryForUser,
} from "./category-rule.repository.js";
import { prisma } from "../prisma.js";
import { DuplicateRuleError } from "../errors.js";

const mockCategoryRule = vi.mocked(prisma.categoryRule);
const mockDimCategory = vi.mocked(prisma.dimCategory);
const mockTransaction = vi.mocked(prisma.$transaction);

const sampleRule = {
  id: "rule-1",
  pattern: "Migros",
  matchType: "contains",
  priority: 10,
  categoryId: "cat-1",
  userId: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  category: { id: "cat-1", categoryName: "Groceries" },
};

describe("category-rule.repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findAllByUser", () => {
    it("returns rules ordered by priority desc", async () => {
      mockCategoryRule.findMany.mockResolvedValue([sampleRule] as never);

      const result = await findAllByUser("user-1");

      expect(result).toEqual([sampleRule]);
      expect(mockCategoryRule.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { priority: "desc" },
        include: { category: { select: { id: true, categoryName: true } } },
      });
    });
  });

  describe("findById", () => {
    it("returns rule when found for user", async () => {
      mockCategoryRule.findFirst.mockResolvedValue(sampleRule as never);

      const result = await findById("rule-1", "user-1");

      expect(result).toEqual(sampleRule);
      expect(mockCategoryRule.findFirst).toHaveBeenCalledWith({
        where: { id: "rule-1", userId: "user-1" },
        include: { category: { select: { id: true, categoryName: true } } },
      });
    });

    it("returns null when rule not found", async () => {
      mockCategoryRule.findFirst.mockResolvedValue(null);

      const result = await findById("nonexistent", "user-1");

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("creates a new category rule", async () => {
      mockCategoryRule.create.mockResolvedValue(sampleRule as never);

      const result = await create({
        userId: "user-1",
        categoryId: "cat-1",
        pattern: "Migros",
        matchType: "contains",
        priority: 10,
      });

      expect(result).toEqual(sampleRule);
    });

    it("throws DuplicateRuleError on duplicate pattern+matchType", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      mockCategoryRule.create.mockRejectedValue(prismaError);

      await expect(
        create({
          userId: "user-1",
          categoryId: "cat-1",
          pattern: "Migros",
          matchType: "contains",
          priority: 10,
        }),
      ).rejects.toThrow(DuplicateRuleError);
    });
  });

  describe("update", () => {
    it("updates an existing rule within a transaction", async () => {
      const txClient = {
        categoryRule: {
          findFirst: vi.fn().mockResolvedValue(sampleRule),
          update: vi.fn().mockResolvedValue({ ...sampleRule, priority: 20 }),
        },
      };
      // @ts-expect-error -- mock tx is an intentional partial stub of TransactionClient
      mockTransaction.mockImplementation((cb) => cb(txClient));

      const result = await update("rule-1", "user-1", { priority: 20 });

      expect(result).toEqual({ ...sampleRule, priority: 20 });
    });

    it("returns null when rule not found", async () => {
      const txClient = {
        categoryRule: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };
      // @ts-expect-error -- mock tx is an intentional partial stub of TransactionClient
      mockTransaction.mockImplementation((cb) => cb(txClient));

      const result = await update("nonexistent", "user-1", { priority: 5 });
      expect(result).toBeNull();
    });
  });

  describe("remove", () => {
    it("returns true when rule is deleted", async () => {
      mockCategoryRule.deleteMany.mockResolvedValue({ count: 1 });

      const result = await remove("rule-1", "user-1");
      expect(result).toBe(true);
    });

    it("returns false when rule not found", async () => {
      mockCategoryRule.deleteMany.mockResolvedValue({ count: 0 });

      const result = await remove("nonexistent", "user-1");
      expect(result).toBe(false);
    });
  });

  describe("findCategoryForUser", () => {
    it("returns category belonging to user or global", async () => {
      mockDimCategory.findFirst.mockResolvedValue({ id: "cat-1" } as never);

      const result = await findCategoryForUser("cat-1", "user-1");

      expect(result).toEqual({ id: "cat-1" });
      expect(mockDimCategory.findFirst).toHaveBeenCalledWith({
        where: { id: "cat-1", OR: [{ userId: "user-1" }, { userId: null }] },
        select: { id: true },
      });
    });
  });
});
