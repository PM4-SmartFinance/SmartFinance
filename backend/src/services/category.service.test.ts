import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLogger = { warn: vi.fn(), error: vi.fn() };

vi.mock("../repositories/category.repository.js", () => ({
  create: vi.fn().mockResolvedValue({ id: "cat-1", categoryName: "Food", userId: "user-1" }),
  findAllForUser: vi.fn(),
  update: vi.fn(),
  deleteById: vi.fn(),
}));

vi.mock("./module-registry.service.js", () => ({
  fireCategoryAdded: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../logger.js", () => ({
  getLogger: vi.fn(() => mockLogger),
}));

import { createCategory } from "./category.service.js";
import * as moduleRegistry from "./module-registry.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(moduleRegistry.fireCategoryAdded).mockResolvedValue(undefined);
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
