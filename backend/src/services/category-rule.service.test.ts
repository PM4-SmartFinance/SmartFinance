import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/category-rule.repository.js", () => ({
  findAllByUser: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  findCategoryForUser: vi.fn(),
}));

vi.mock("../repositories/transaction.repository.js", () => ({
  findUncategorizedForUser: vi.fn(),
}));

import * as service from "./category-rule.service.js";
import * as repo from "../repositories/category-rule.repository.js";
import * as transactionRepo from "../repositories/transaction.repository.js";
import { DuplicateRuleError, ServiceError } from "../errors.js";

const mockRepo = vi.mocked(repo);
const mockTransactionRepo = vi.mocked(transactionRepo);

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

describe("category-rule.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listRules", () => {
    it("returns all rules for user", async () => {
      mockRepo.findAllByUser.mockResolvedValue([sampleRule] as never);

      const result = await service.listRules("user-1");

      expect(result).toEqual([sampleRule]);
      expect(mockRepo.findAllByUser).toHaveBeenCalledWith("user-1");
    });
  });

  describe("getRule", () => {
    it("returns rule when found", async () => {
      mockRepo.findById.mockResolvedValue(sampleRule as never);

      const result = await service.getRule("rule-1", "user-1");

      expect(result).toEqual(sampleRule);
    });

    it("throws 404 when rule not found", async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.getRule("nonexistent", "user-1")).rejects.toThrow(ServiceError);
    });
  });

  describe("createRule", () => {
    it("creates rule when category exists for user", async () => {
      mockRepo.findCategoryForUser.mockResolvedValue({ id: "cat-1" });
      mockRepo.create.mockResolvedValue(sampleRule as never);

      const result = await service.createRule("user-1", "cat-1", "Migros", "contains", 10);

      expect(result).toEqual(sampleRule);
      expect(mockRepo.findCategoryForUser).toHaveBeenCalledWith("cat-1", "user-1");
    });

    it("throws 404 when category does not exist", async () => {
      mockRepo.findCategoryForUser.mockResolvedValue(null);

      await expect(
        service.createRule("user-1", "invalid-cat", "Migros", "contains", 10),
      ).rejects.toThrow(ServiceError);

      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it("throws 409 when rule is a duplicate", async () => {
      mockRepo.findCategoryForUser.mockResolvedValue({ id: "cat-1" });
      mockRepo.create.mockRejectedValue(new DuplicateRuleError());

      await expect(service.createRule("user-1", "cat-1", "Migros", "contains", 10)).rejects.toThrow(
        ServiceError,
      );

      await expect(
        service.createRule("user-1", "cat-1", "Migros", "contains", 10),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe("updateRule", () => {
    it("updates rule without category change", async () => {
      mockRepo.update.mockResolvedValue({ ...sampleRule, priority: 20 } as never);

      const result = await service.updateRule("rule-1", "user-1", { priority: 20 });

      expect(result).toEqual({ ...sampleRule, priority: 20 });
      expect(mockRepo.findCategoryForUser).not.toHaveBeenCalled();
    });

    it("validates category when categoryId is provided", async () => {
      mockRepo.findCategoryForUser.mockResolvedValue({ id: "cat-2" });
      mockRepo.update.mockResolvedValue({ ...sampleRule, categoryId: "cat-2" } as never);

      await service.updateRule("rule-1", "user-1", { categoryId: "cat-2" });

      expect(mockRepo.findCategoryForUser).toHaveBeenCalledWith("cat-2", "user-1");
    });

    it("throws 404 when updated category does not exist", async () => {
      mockRepo.findCategoryForUser.mockResolvedValue(null);

      await expect(
        service.updateRule("rule-1", "user-1", { categoryId: "invalid" }),
      ).rejects.toThrow(ServiceError);
    });

    it("throws 404 when rule not found", async () => {
      mockRepo.update.mockResolvedValue(null);

      await expect(service.updateRule("nonexistent", "user-1", { priority: 5 })).rejects.toThrow(
        ServiceError,
      );
    });

    it("throws 409 when update causes duplicate", async () => {
      mockRepo.update.mockRejectedValue(new DuplicateRuleError());

      const error = await service
        .updateRule("rule-1", "user-1", { pattern: "Migros" })
        .catch((e: ServiceError) => e);

      expect(error).toBeInstanceOf(ServiceError);
      expect(error.statusCode).toBe(409);
    });
  });

  describe("deleteRule", () => {
    it("deletes a rule", async () => {
      mockRepo.remove.mockResolvedValue(true);

      await expect(service.deleteRule("rule-1", "user-1")).resolves.toBeUndefined();
      expect(mockRepo.remove).toHaveBeenCalledWith("rule-1", "user-1");
    });

    it("throws 404 when rule not found", async () => {
      mockRepo.remove.mockResolvedValue(false);

      await expect(service.deleteRule("nonexistent", "user-1")).rejects.toThrow(ServiceError);
    });
  });

  describe("previewRule", () => {
    it("returns match count and top matching transaction samples", async () => {
      mockTransactionRepo.findUncategorizedForUser.mockResolvedValue([
        { id: "tx-1", amount: -12.5, dateId: 20260412, merchant: { name: "Coop" } },
        { id: "tx-2", amount: -8.75, dateId: 20260413, merchant: { name: "Coop City" } },
        { id: "tx-3", amount: -19.9, dateId: 20260414, merchant: { name: "Migros" } },
      ] as never);

      const result = await service.previewRule("user-1", {
        categoryId: "cat-1",
        pattern: "co",
        matchType: "contains",
        priority: 0,
      });

      expect(result).toEqual({
        matchCount: 2,
        matchedTransactions: [
          {
            id: "tx-2",
            merchantName: "Coop City",
            amount: -8.75,
            dateId: 20260413,
          },
          {
            id: "tx-1",
            merchantName: "Coop",
            amount: -12.5,
            dateId: 20260412,
          },
        ],
      });
    });

    it("returns the three newest matching transaction samples", async () => {
      mockTransactionRepo.findUncategorizedForUser.mockResolvedValue([
        { id: "tx-1", amount: -1, dateId: 20260410, merchant: { name: "Coop" } },
        { id: "tx-2", amount: -2, dateId: 20260416, merchant: { name: "Coop" } },
        { id: "tx-3", amount: -3, dateId: 20260412, merchant: { name: "Coop Pronto" } },
        { id: "tx-4", amount: -4, dateId: 20260415, merchant: { name: "Coop City" } },
        { id: "tx-5", amount: -5, dateId: 20260414, merchant: { name: "Coop Bau" } },
        { id: "tx-6", amount: -6, dateId: 20260411, merchant: { name: "Coop Restaurant" } },
        { id: "tx-7", amount: -7, dateId: 20260413, merchant: { name: "Coop Extra" } },
      ] as never);

      const result = await service.previewRule("user-1", {
        categoryId: "cat-1",
        pattern: "co",
        matchType: "contains",
        priority: 0,
      });

      expect(result.matchCount).toBe(7);
      expect(result.matchedTransactions).toHaveLength(3);
      expect(result.matchedTransactions[0]).toMatchObject({ id: "tx-2", merchantName: "Coop" });
      expect(result.matchedTransactions[1]).toMatchObject({
        id: "tx-4",
        merchantName: "Coop City",
      });
      expect(result.matchedTransactions[2]).toMatchObject({
        id: "tx-5",
        merchantName: "Coop Bau",
      });
    });
  });
});
