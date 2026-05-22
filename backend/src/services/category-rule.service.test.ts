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
  findPreviewMatchesForUser: vi.fn(),
}));

// KAN-154: createRule/updateRule now run autoCategorize as a best-effort
// follow-up. The categorization path is exercised end-to-end in the
// integration spec; here we mock it so the unit tests stay focused on the
// rule lifecycle and don't need a real logger/database.
vi.mock("./categorization.service.js", () => ({
  autoCategorize: vi.fn().mockResolvedValue({ categorized: 0 }),
}));

vi.mock("../logger.js", () => ({
  getLogger: vi.fn(() => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() })),
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
    it("returns all rules for user with isValid=true for non-regex rules", async () => {
      mockRepo.findAllByUser.mockResolvedValue([sampleRule] as never);

      const result = await service.listRules("user-1");

      expect(result).toEqual([{ ...sampleRule, isValid: true }]);
      expect(mockRepo.findAllByUser).toHaveBeenCalledWith("user-1");
    });

    it("marks regex rules with invalid patterns as isValid=false", async () => {
      mockRepo.findAllByUser.mockResolvedValue([
        { ...sampleRule, id: "rule-good", matchType: "regex", pattern: "^Migros.*" },
        { ...sampleRule, id: "rule-bad", matchType: "regex", pattern: "[invalid(" },
      ] as never);

      const result = await service.listRules("user-1");

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: "rule-good", isValid: true });
      expect(result[1]).toMatchObject({ id: "rule-bad", isValid: false });
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

    it("accepts a valid regex pattern", async () => {
      mockRepo.findCategoryForUser.mockResolvedValue({ id: "cat-1" });
      mockRepo.create.mockResolvedValue(sampleRule as never);

      await expect(
        service.createRule("user-1", "cat-1", "Migros.*Online", "regex", 10),
      ).resolves.toBeDefined();
    });

    it("rejects an invalid regex pattern with a 400 error", async () => {
      const error = await service
        .createRule("user-1", "cat-1", "[invalid(", "regex", 10)
        .catch((e: ServiceError) => e);

      expect(error).toBeInstanceOf(ServiceError);
      expect(error.statusCode).toBe(400);
      expect(mockRepo.findCategoryForUser).not.toHaveBeenCalled();
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it("does not validate regex for exact/contains match types", async () => {
      mockRepo.findCategoryForUser.mockResolvedValue({ id: "cat-1" });
      mockRepo.create.mockResolvedValue(sampleRule as never);

      // "[invalid(" is not a valid regex but is fine as an "exact" pattern
      await expect(
        service.createRule("user-1", "cat-1", "[invalid(", "exact", 10),
      ).resolves.toBeDefined();
    });

    it("rejects a catastrophic-backtracking regex pattern with a 400 error", async () => {
      const error = await service
        .createRule("user-1", "cat-1", "(a+)+b", "regex", 10)
        .catch((e: ServiceError) => e);

      expect(error).toBeInstanceOf(ServiceError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toMatch(/too complex/i);
      expect(mockRepo.findCategoryForUser).not.toHaveBeenCalled();
      expect(mockRepo.create).not.toHaveBeenCalled();
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
      mockRepo.findById.mockResolvedValue(sampleRule as never);
      mockRepo.update.mockRejectedValue(new DuplicateRuleError());

      const error = await service
        .updateRule("rule-1", "user-1", { pattern: "Migros" })
        .catch((e: ServiceError) => e);

      expect(error).toBeInstanceOf(ServiceError);
      expect(error.statusCode).toBe(409);
    });

    it("rejects invalid regex pattern when updating matchType to regex with a new pattern", async () => {
      mockRepo.findById.mockResolvedValue(sampleRule as never);

      const error = await service
        .updateRule("rule-1", "user-1", { matchType: "regex", pattern: "[invalid(" })
        .catch((e: ServiceError) => e);

      expect(error).toBeInstanceOf(ServiceError);
      expect(error.statusCode).toBe(400);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it("accepts valid regex pattern when updating matchType to regex", async () => {
      mockRepo.findById.mockResolvedValue(sampleRule as never);
      mockRepo.update.mockResolvedValue({
        ...sampleRule,
        matchType: "regex",
        pattern: "^Migros.*",
      } as never);

      await expect(
        service.updateRule("rule-1", "user-1", { matchType: "regex", pattern: "^Migros.*" }),
      ).resolves.toBeDefined();
    });

    it("rejects invalid regex when PATCHing pattern only on a rule already stored as regex", async () => {
      mockRepo.findById.mockResolvedValue({
        ...sampleRule,
        matchType: "regex",
        pattern: "^Migros.*",
      } as never);

      const error = await service
        .updateRule("rule-1", "user-1", { pattern: "[invalid(" })
        .catch((e: ServiceError) => e);

      expect(error).toBeInstanceOf(ServiceError);
      expect(error.statusCode).toBe(400);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it("rejects when switching matchType to regex without changing the existing (invalid) pattern", async () => {
      mockRepo.findById.mockResolvedValue({
        ...sampleRule,
        matchType: "contains",
        pattern: "[invalid(",
      } as never);

      const error = await service
        .updateRule("rule-1", "user-1", { matchType: "regex" })
        .catch((e: ServiceError) => e);

      expect(error).toBeInstanceOf(ServiceError);
      expect(error.statusCode).toBe(400);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it("throws 404 from the pre-fetch when rule does not exist and pattern is provided", async () => {
      mockRepo.findById.mockResolvedValue(null);

      const error = await service
        .updateRule("nonexistent", "user-1", { pattern: "Migros" })
        .catch((e: ServiceError) => e);

      expect(error).toBeInstanceOf(ServiceError);
      expect(error.statusCode).toBe(404);
      expect(mockRepo.update).not.toHaveBeenCalled();
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
    it("returns match count and latest samples from repository", async () => {
      mockRepo.findCategoryForUser.mockResolvedValue({ id: "cat-1" } as never);
      mockTransactionRepo.findPreviewMatchesForUser.mockResolvedValue({
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
      expect(mockTransactionRepo.findPreviewMatchesForUser).toHaveBeenCalledWith(
        "user-1",
        "co",
        "contains",
        3,
      );
    });

    it("throws 404 when category does not belong to user", async () => {
      mockRepo.findCategoryForUser.mockResolvedValue(null);

      await expect(
        service.previewRule("user-1", {
          categoryId: "stolen-cat",
          pattern: "co",
          matchType: "contains",
          priority: 0,
        }),
      ).rejects.toThrow(ServiceError);

      expect(mockTransactionRepo.findPreviewMatchesForUser).not.toHaveBeenCalled();
    });

    it("rejects invalid regex pattern with 400 before hitting the repository", async () => {
      const error = await service
        .previewRule("user-1", {
          categoryId: "cat-1",
          pattern: "[invalid(",
          matchType: "regex",
          priority: 0,
        })
        .catch((e: ServiceError) => e);

      expect(error).toBeInstanceOf(ServiceError);
      expect(error.statusCode).toBe(400);
      expect(mockRepo.findCategoryForUser).not.toHaveBeenCalled();
      expect(mockTransactionRepo.findPreviewMatchesForUser).not.toHaveBeenCalled();
    });

    it("calls repository with regex matchType for valid regex patterns", async () => {
      mockRepo.findCategoryForUser.mockResolvedValue({ id: "cat-1" } as never);
      mockTransactionRepo.findPreviewMatchesForUser.mockResolvedValue({
        matchCount: 3,
        matchedTransactions: [],
      });

      await service.previewRule("user-1", {
        categoryId: "cat-1",
        pattern: "Migros.*Online",
        matchType: "regex",
        priority: 0,
      });

      expect(mockTransactionRepo.findPreviewMatchesForUser).toHaveBeenCalledWith(
        "user-1",
        "Migros.*Online",
        "regex",
        3,
      );
    });

    it("returns zero matches when repository finds no match", async () => {
      mockRepo.findCategoryForUser.mockResolvedValue({ id: "cat-1" } as never);
      mockTransactionRepo.findPreviewMatchesForUser.mockResolvedValue({
        matchCount: 0,
        matchedTransactions: [],
      });

      const result = await service.previewRule("user-1", {
        categoryId: "cat-1",
        pattern: "co",
        matchType: "contains",
        priority: 0,
      });

      expect(result).toEqual({ matchCount: 0, matchedTransactions: [] });
    });
  });

  describe("patternsOverlap", () => {
    it("returns true for identical exact patterns (case-insensitive)", () => {
      expect(
        service.patternsOverlap(
          { pattern: "Migros", matchType: "exact" },
          { pattern: "migros", matchType: "exact" },
        ),
      ).toBe(true);
    });

    it("returns false for distinct exact patterns", () => {
      expect(
        service.patternsOverlap(
          { pattern: "Migros", matchType: "exact" },
          { pattern: "Coop", matchType: "exact" },
        ),
      ).toBe(false);
    });

    it("returns true when an exact pattern contains the other contains pattern", () => {
      expect(
        service.patternsOverlap(
          { pattern: "Coop Migros", matchType: "exact" },
          { pattern: "coop", matchType: "contains" },
        ),
      ).toBe(true);
    });

    it("returns true for two contains patterns where one is a substring of the other", () => {
      expect(
        service.patternsOverlap(
          { pattern: "coop", matchType: "contains" },
          { pattern: "coop migros", matchType: "contains" },
        ),
      ).toBe(true);
    });

    it("returns false for two unrelated contains patterns", () => {
      expect(
        service.patternsOverlap(
          { pattern: "coop", matchType: "contains" },
          { pattern: "migros", matchType: "contains" },
        ),
      ).toBe(false);
    });

    it("returns true when contains pattern is a substring of an exact pattern (mirror direction)", () => {
      // Mirrors the exact-vs-contains case to pin both branches independently.
      expect(
        service.patternsOverlap(
          { pattern: "coop", matchType: "contains" },
          { pattern: "Coop Migros", matchType: "exact" },
        ),
      ).toBe(true);
    });

    it("returns false when either pattern is empty (defence-in-depth)", () => {
      // The boundary validates `minLength: 1`, but a stored empty `contains`
      // pattern would otherwise overlap everything via includes("").
      expect(
        service.patternsOverlap(
          { pattern: "", matchType: "contains" },
          { pattern: "anything", matchType: "contains" },
        ),
      ).toBe(false);
      expect(
        service.patternsOverlap(
          { pattern: "anything", matchType: "exact" },
          { pattern: "", matchType: "exact" },
        ),
      ).toBe(false);
    });
  });

  describe("findOverlappingRules", () => {
    it("returns an empty array for an empty pattern", async () => {
      const result = await service.findOverlappingRules("user-1", {
        pattern: "",
        matchType: "contains",
      });
      expect(result).toEqual([]);
      expect(mockRepo.findAllByUser).not.toHaveBeenCalled();
    });

    it("filters out the rule being edited via excludeRuleId", async () => {
      mockRepo.findAllByUser.mockResolvedValue([
        {
          id: "rule-self",
          pattern: "coop",
          matchType: "contains",
          priority: 10,
          categoryId: "cat-1",
          userId: "user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          category: { id: "cat-1", categoryName: "Groceries" },
        },
      ] as never);

      const result = await service.findOverlappingRules("user-1", {
        pattern: "coop",
        matchType: "contains",
        excludeRuleId: "rule-self",
      });

      expect(result).toEqual([]);
    });

    it("skips stored regex rules when computing overlap", async () => {
      mockRepo.findAllByUser.mockResolvedValue([
        {
          id: "rule-regex",
          pattern: "^Coop$",
          matchType: "regex",
          priority: 10,
          categoryId: "cat-grocery",
          userId: "user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          category: { id: "cat-grocery", categoryName: "Groceries" },
        },
      ] as never);

      const result = await service.findOverlappingRules("user-1", {
        pattern: "Coop",
        matchType: "contains",
      });

      expect(result).toEqual([]);
    });

    it("maps overlapping rules with category info", async () => {
      mockRepo.findAllByUser.mockResolvedValue([
        {
          id: "rule-existing",
          pattern: "coop migros",
          matchType: "contains",
          priority: 5,
          categoryId: "cat-other",
          userId: "user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          category: { id: "cat-other", categoryName: "Hobby" },
        },
        {
          id: "rule-unrelated",
          pattern: "spotify",
          matchType: "contains",
          priority: 1,
          categoryId: "cat-music",
          userId: "user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          category: { id: "cat-music", categoryName: "Music" },
        },
      ] as never);

      const result = await service.findOverlappingRules("user-1", {
        pattern: "coop",
        matchType: "contains",
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "rule-existing",
        pattern: "coop migros",
        matchType: "contains",
        priority: 5,
        categoryId: "cat-other",
        categoryName: "Hobby",
      });
    });
  });
});
