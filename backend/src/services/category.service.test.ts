import { describe, it, expect, vi, beforeEach } from "vitest";
import { uncategorizeAllForCategory } from "./category.service.js";
import * as categoryRepository from "../repositories/category.repository.js";
import * as transactionRepository from "../repositories/transaction.repository.js";
import { ServiceError } from "../errors.js";

vi.mock("../repositories/category.repository.js", () => ({
  findById: vi.fn(),
}));

vi.mock("../repositories/transaction.repository.js", () => ({
  clearCategoryAssignments: vi.fn(),
}));

const mockCategoryRepo = vi.mocked(categoryRepository);
const mockTxRepo = vi.mocked(transactionRepository);

describe("uncategorizeAllForCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
