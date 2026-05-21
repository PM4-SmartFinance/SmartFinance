import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };

vi.mock("../logger.js", () => ({
  getLogger: vi.fn(() => mockLogger),
}));

import {
  registerModule,
  getModule,
  getAllModules,
  fireTransactionImported,
  fireBudgetCreated,
  fireCategoryAdded,
  clearRegistry,
} from "./module-registry.service.js";
import type { SmartFinanceModule } from "../types/module.js";

function makeModule(overrides: Partial<SmartFinanceModule> = {}): SmartFinanceModule {
  return {
    id: "test-mod",
    name: "Test Module",
    requiredRole: "USER",
    init: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn().mockReturnValue({ initialized: true }),
    ...overrides,
  };
}

beforeEach(() => {
  clearRegistry();
  vi.clearAllMocks();
});

describe("registerModule / getModule", () => {
  it("stores and retrieves a module by id", () => {
    const mod = makeModule();
    registerModule(mod);
    expect(getModule("test-mod")).toBe(mod);
  });

  it("returns undefined for an unregistered module id", () => {
    expect(getModule("does-not-exist")).toBeUndefined();
  });

  it("logs an error and overwrites when registering a duplicate module id", () => {
    const mod1 = makeModule({ name: "Original" });
    const mod2 = makeModule({ name: "Duplicate" });
    registerModule(mod1);
    registerModule(mod2);
    expect(mockLogger.error).toHaveBeenCalledWith(
      { moduleId: "test-mod" },
      "module registration conflict — duplicate id, overwriting",
    );
    expect(getModule("test-mod")).toBe(mod2);
  });
});

describe("getAllModules", () => {
  it("returns all registered modules with their status", () => {
    const mod = makeModule({ id: "mod-a", name: "Mod A" });
    registerModule(mod);
    const result = getAllModules();
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "mod-a",
      name: "Mod A",
      requiredRole: "USER",
      status: { initialized: true },
    });
  });

  it("returns empty array when no modules are registered", () => {
    expect(getAllModules()).toEqual([]);
  });
});

describe("fireTransactionImported", () => {
  it("calls onTransactionImported on modules that implement it", async () => {
    const hook = vi.fn().mockResolvedValue(undefined);
    registerModule(makeModule({ onTransactionImported: hook }));
    await fireTransactionImported({ userId: "u1", accountId: "a1", imported: 5 });
    expect(hook).toHaveBeenCalledExactlyOnceWith({ userId: "u1", accountId: "a1", imported: 5 });
  });

  it("skips modules that do not implement onTransactionImported", async () => {
    const mod = makeModule();
    registerModule(mod);
    await expect(
      fireTransactionImported({ userId: "u1", accountId: "a1", imported: 3 }),
    ).resolves.toBeUndefined();
  });

  it("logs the error and continues when a module hook throws", async () => {
    const err = new Error("hook boom");
    const failingHook = vi.fn().mockRejectedValue(err);
    const passingHook = vi.fn().mockResolvedValue(undefined);
    registerModule(makeModule({ id: "mod-fail", onTransactionImported: failingHook }));
    registerModule(makeModule({ id: "mod-pass", onTransactionImported: passingHook }));

    await fireTransactionImported({ userId: "u1", accountId: "a1", imported: 1 });

    expect(mockLogger.error).toHaveBeenCalledWith(
      { err, moduleId: "mod-fail" },
      "module hook onTransactionImported failed",
    );
    expect(passingHook).toHaveBeenCalled();
  });
});

describe("fireBudgetCreated", () => {
  it("calls onBudgetCreated on modules that implement it", async () => {
    const hook = vi.fn().mockResolvedValue(undefined);
    registerModule(makeModule({ onBudgetCreated: hook }));
    await fireBudgetCreated({ userId: "u1", budgetId: "b1", categoryId: "c1" });
    expect(hook).toHaveBeenCalledExactlyOnceWith({
      userId: "u1",
      budgetId: "b1",
      categoryId: "c1",
    });
  });

  it("skips modules that do not implement onBudgetCreated", async () => {
    registerModule(makeModule());
    await expect(
      fireBudgetCreated({ userId: "u1", budgetId: "b1", categoryId: "c1" }),
    ).resolves.toBeUndefined();
  });

  it("logs the error and continues when a module hook throws", async () => {
    const err = new Error("budget hook fail");
    registerModule(makeModule({ id: "mod-fail", onBudgetCreated: vi.fn().mockRejectedValue(err) }));
    await fireBudgetCreated({ userId: "u1", budgetId: "b1", categoryId: "c1" });
    expect(mockLogger.error).toHaveBeenCalledWith(
      { err, moduleId: "mod-fail" },
      "module hook onBudgetCreated failed",
    );
  });
});

describe("fireCategoryAdded", () => {
  it("calls onCategoryAdded on modules that implement it", async () => {
    const hook = vi.fn().mockResolvedValue(undefined);
    registerModule(makeModule({ onCategoryAdded: hook }));
    await fireCategoryAdded({ userId: "u1", categoryId: "c1", categoryName: "Food" });
    expect(hook).toHaveBeenCalledExactlyOnceWith({
      userId: "u1",
      categoryId: "c1",
      categoryName: "Food",
    });
  });

  it("skips modules that do not implement onCategoryAdded", async () => {
    registerModule(makeModule());
    await expect(
      fireCategoryAdded({ userId: "u1", categoryId: "c1", categoryName: "Food" }),
    ).resolves.toBeUndefined();
  });

  it("logs the error and continues when a module hook throws", async () => {
    const err = new Error("category hook fail");
    registerModule(makeModule({ id: "mod-fail", onCategoryAdded: vi.fn().mockRejectedValue(err) }));
    await fireCategoryAdded({ userId: "u1", categoryId: "c1", categoryName: "Food" });
    expect(mockLogger.error).toHaveBeenCalledWith(
      { err, moduleId: "mod-fail" },
      "module hook onCategoryAdded failed",
    );
  });
});
