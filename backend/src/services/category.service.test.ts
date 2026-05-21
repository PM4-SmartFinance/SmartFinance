import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLogger = { warn: vi.fn(), error: vi.fn() };

vi.mock("../repositories/category.repository.js", () => ({
  create: vi.fn().mockResolvedValue({ id: "cat-1", categoryName: "Food", userId: "user-1" }),
  findAllForUser: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  deleteById: vi.fn(),
}));

vi.mock("../repositories/transaction.repository.js", () => ({
  clearCategoryAssignments: vi.fn(),
}));

vi.mock("./module-registry.service.js", () => ({
  fireCategoryAdded: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../logger.js", () => ({
  getLogger: vi.fn(() => mockLogger),
}));

import { createCategory, uncategorizeAllForCategory } from "./category.service.js";
import * as categoryRepository from "../repositories/category.repository.js";
import * as transactionRepository from "../repositories/transaction.repository.js";
import * as moduleRegistry from "./module-registry.service.js";
import { ServiceError } from "../errors.js";

const mockCategoryRepo = vi.mocked(categoryRepository);
const mockTxRepo = vi.mocked(transactionRepository);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(moduleRegistry.fireCategoryAdded).mockResolvedValue(undefined);
  vi.mocked(categoryRepository.create).mockResolvedValue({
    // @ts-expect-error -- partial fixture
    id: "cat-1",
    categoryName: "Food",
    userId: "user-1",
  });
});

describe("createCategory lifecycle hook", () => {
  it("fires the onCategoryAdded lifecycle hook after repository create", async () => {
    await createCategory("Food", "user-1");
    expect(vi.mocked(moduleRegistry.fireCategoryAdded)).toHaveBeenCalledExactlyOnceWith({
      userId: "user-1",
      categoryId: "cat-1",
      categoryName: "Food",
    });
  });

  it("returns the created category", async () => {
    const result = await createCategory("Food", "user-1");
    expect(result).toEqual({ id: "cat-1", categoryName: "Food", userId: "user-1" });
  });

  it("swallows a registry failure and logs a warning", async () => {
    const err = new Error("registry bug");
    vi.mocked(moduleRegistry.fireCategoryAdded).mockRejectedValueOnce(err);
    await expect(createCategory("Food", "user-1")).resolves.toBeDefined();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err }),
      "fireCategoryAdded unexpectedly threw",
    );
  });
});

describe("uncategorizeAllForCategory", () => {
  it("throws ServiceError 404 when the category does not exist", async () => {
    mockCategoryRepo.findById.mockResolvedValue(null);
    await expect(uncategorizeAllForCategory("missing", "user-1")).rejects.toThrow(
      new ServiceError(404, "Category not found"),
    );
    expect(mockTxRepo.clearCategoryAssignments).not.toHaveBeenCalled();
  });

  it("throws ServiceError 404 when the category belongs to another user (IDOR guard)", async () => {
    // @ts-expect-error -- partial fixture
    mockCategoryRepo.findById.mockResolvedValue({ id: "cat-1", userId: "other-user" });
    await expect(uncategorizeAllForCategory("cat-1", "user-1")).rejects.toThrow(
      new ServiceError(404, "Category not found"),
    );
    expect(mockTxRepo.clearCategoryAssignments).not.toHaveBeenCalled();
  });

  it("rejects when the category is a global one (userId is null)", async () => {
    // Global categories cannot be modified or unassigned from in bulk by
    // individual users — preserve the existing read-only contract.
    // @ts-expect-error -- partial fixture
    mockCategoryRepo.findById.mockResolvedValue({ id: "cat-1", userId: null });
    await expect(uncategorizeAllForCategory("cat-1", "user-1")).rejects.toThrow(
      new ServiceError(404, "Category not found"),
    );
    expect(mockTxRepo.clearCategoryAssignments).not.toHaveBeenCalled();
  });

  it("calls the repository to clear assignments and returns the count", async () => {
    // @ts-expect-error -- partial fixture
    mockCategoryRepo.findById.mockResolvedValue({ id: "cat-1", userId: "user-1" });
    mockTxRepo.clearCategoryAssignments.mockResolvedValue(3);
    const result = await uncategorizeAllForCategory("cat-1", "user-1");
    expect(mockTxRepo.clearCategoryAssignments).toHaveBeenCalledExactlyOnceWith("user-1", "cat-1");
    expect(result).toEqual({ uncategorized: 3 });
  });
});
