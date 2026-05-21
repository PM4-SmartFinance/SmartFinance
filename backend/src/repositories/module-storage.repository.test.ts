import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLogger = { error: vi.fn() };

vi.mock("../prisma.js", () => ({
  prisma: {
    moduleData: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../logger.js", () => ({
  getLogger: vi.fn(() => mockLogger),
}));

import {
  getData,
  setData,
  deleteData,
  listData,
  createStorageAdapter,
} from "./module-storage.repository.js";
import { prisma } from "../prisma.js";

const mockModuleData = vi.mocked(prisma.moduleData);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getData", () => {
  it("returns null and logs an error when the stored value is corrupt JSON", async () => {
    mockModuleData.findUnique.mockResolvedValue({ value: "not-valid-json{" } as never);
    const result = await getData("my-mod", "user-1", "my-key");
    expect(result).toBeNull();
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ moduleName: "my-mod", userId: "user-1", key: "my-key" }),
      "module-storage: corrupt JSON value, returning null",
    );
  });

  it("returns the parsed value when the key exists", async () => {
    mockModuleData.findUnique.mockResolvedValue({ value: JSON.stringify({ count: 3 }) } as never);
    const result = await getData("my-mod", "user-1", "my-key");
    expect(result).toEqual({ count: 3 });
    expect(mockModuleData.findUnique).toHaveBeenCalledWith({
      where: { moduleName_userId_key: { moduleName: "my-mod", userId: "user-1", key: "my-key" } },
      select: { value: true },
    });
  });

  it("returns null when the key does not exist", async () => {
    mockModuleData.findUnique.mockResolvedValue(null);
    const result = await getData("my-mod", "user-1", "missing");
    expect(result).toBeNull();
  });
});

describe("setData", () => {
  it("throws ServiceError 413 when the serialized value exceeds MAX_VALUE_BYTES", async () => {
    const huge = "x".repeat(65_537);
    await expect(setData("my-mod", "user-1", "big-key", huge)).rejects.toMatchObject({
      name: "ServiceError",
      statusCode: 413,
    });
    expect(mockModuleData.upsert).not.toHaveBeenCalled();
  });

  it("upserts with JSON-serialized value", async () => {
    mockModuleData.upsert.mockResolvedValue(undefined as never);
    await setData("my-mod", "user-1", "my-key", { score: 42 });
    expect(mockModuleData.upsert).toHaveBeenCalledWith({
      where: { moduleName_userId_key: { moduleName: "my-mod", userId: "user-1", key: "my-key" } },
      create: {
        moduleName: "my-mod",
        userId: "user-1",
        key: "my-key",
        value: JSON.stringify({ score: 42 }),
      },
      update: { value: JSON.stringify({ score: 42 }) },
    });
  });
});

describe("deleteData", () => {
  it("calls deleteMany with correct filter", async () => {
    mockModuleData.deleteMany.mockResolvedValue({ count: 1 } as never);
    await deleteData("my-mod", "user-1", "my-key");
    expect(mockModuleData.deleteMany).toHaveBeenCalledWith({
      where: { moduleName: "my-mod", userId: "user-1", key: "my-key" },
    });
  });
});

describe("listData", () => {
  it("returns all entries as parsed key-value pairs ordered by key", async () => {
    mockModuleData.findMany.mockResolvedValue([
      { key: "alpha", value: JSON.stringify(1) },
      { key: "beta", value: JSON.stringify("hello") },
    ] as never);

    const result = await listData("my-mod", "user-1");

    expect(result).toEqual([
      { key: "alpha", value: 1 },
      { key: "beta", value: "hello" },
    ]);
    expect(mockModuleData.findMany).toHaveBeenCalledWith({
      where: { moduleName: "my-mod", userId: "user-1" },
      select: { key: true, value: true },
      orderBy: { key: "asc" },
    });
  });

  it("returns empty array when no data exists", async () => {
    mockModuleData.findMany.mockResolvedValue([]);
    const result = await listData("my-mod", "user-1");
    expect(result).toEqual([]);
  });

  it("returns null for a corrupt JSON entry and logs an error", async () => {
    mockModuleData.findMany.mockResolvedValue([
      { key: "good", value: JSON.stringify(1) },
      { key: "bad", value: "{broken" },
    ] as never);
    const result = await listData("my-mod", "user-1");
    expect(result).toEqual([
      { key: "good", value: 1 },
      { key: "bad", value: null },
    ]);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ moduleName: "my-mod", userId: "user-1", key: "bad" }),
      "module-storage: corrupt JSON value, returning null",
    );
  });
});

describe("createStorageAdapter", () => {
  it("delegates get() to getData with the bound module name", async () => {
    mockModuleData.findUnique.mockResolvedValue({ value: '"stored"' } as never);
    const adapter = createStorageAdapter("bound-mod");
    const value = await adapter.get("user-1", "k");
    expect(value).toBe("stored");
    expect(mockModuleData.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { moduleName_userId_key: { moduleName: "bound-mod", userId: "user-1", key: "k" } },
      }),
    );
  });

  it("delegates set() with the bound module name", async () => {
    mockModuleData.upsert.mockResolvedValue(undefined as never);
    const adapter = createStorageAdapter("bound-mod");
    await adapter.set("user-1", "k", "val");
    expect(mockModuleData.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { moduleName_userId_key: { moduleName: "bound-mod", userId: "user-1", key: "k" } },
      }),
    );
  });
});
