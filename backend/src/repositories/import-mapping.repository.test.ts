import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma.js", () => ({
  prisma: {
    importColumnMapping: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { findBySignature, findNamedByUser, upsertMapping } from "./import-mapping.repository.js";
import { prisma } from "../prisma.js";
import type { ColumnMapping } from "../services/importers/generic.parser.js";

const mockMapping = vi.mocked(prisma.importColumnMapping);
const mockTransaction = vi.mocked(prisma.$transaction);

const sampleMapping: ColumnMapping = { date: "Date", description: "Name", amount: "Amount" };

describe("import-mapping.repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Run the upsert callback against the mocked client.
    mockTransaction.mockImplementation((cb: unknown) =>
      (cb as (tx: typeof prisma) => unknown)(prisma),
    );
  });

  describe("findBySignature", () => {
    it("returns null without querying when the signature is empty", async () => {
      const result = await findBySignature("user-1", "");
      expect(result).toBeNull();
      expect(mockMapping.findUnique).not.toHaveBeenCalled();
    });

    it("returns null when no row exists", async () => {
      mockMapping.findUnique.mockResolvedValue(null as never);
      expect(await findBySignature("user-1", "sig")).toBeNull();
    });

    it("maps a stored row to a typed SavedImportMapping", async () => {
      mockMapping.findUnique.mockResolvedValue({
        headerSignature: "sig",
        name: "My Bank",
        format: "custom",
        mapping: sampleMapping,
      } as never);

      const result = await findBySignature("user-1", "sig");

      expect(mockMapping.findUnique).toHaveBeenCalledWith({
        where: { userId_headerSignature: { userId: "user-1", headerSignature: "sig" } },
      });
      expect(result).toEqual({
        headerSignature: "sig",
        name: "My Bank",
        format: "custom",
        mapping: sampleMapping,
      });
    });
  });

  describe("findNamedByUser", () => {
    it("returns named mappings, de-duplicated by name (latest wins)", async () => {
      mockMapping.findMany.mockResolvedValue([
        { id: "m2", name: "My Bank", mapping: sampleMapping },
        { id: "m1", name: "My Bank", mapping: { date: "old" } },
        { id: "m3", name: "Other", mapping: sampleMapping },
      ] as never);

      const result = await findNamedByUser("user-1");

      expect(mockMapping.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1", name: { not: null } },
        orderBy: { updatedAt: "desc" },
      });
      expect(result).toEqual([
        { id: "m2", name: "My Bank", mapping: sampleMapping },
        { id: "m3", name: "Other", mapping: sampleMapping },
      ]);
    });
  });

  describe("upsertMapping", () => {
    it("upserts within a transaction, defaulting format and name to null", async () => {
      mockMapping.upsert.mockResolvedValue({} as never);

      await upsertMapping({ userId: "user-1", headerSignature: "sig", mapping: sampleMapping });

      expect(mockTransaction).toHaveBeenCalledOnce();
      expect(mockMapping.upsert).toHaveBeenCalledWith({
        where: { userId_headerSignature: { userId: "user-1", headerSignature: "sig" } },
        create: {
          userId: "user-1",
          headerSignature: "sig",
          name: null,
          format: null,
          mapping: sampleMapping,
        },
        update: { format: null, mapping: sampleMapping },
      });
    });

    it("stores the name in create and update when provided", async () => {
      mockMapping.upsert.mockResolvedValue({} as never);

      await upsertMapping({
        userId: "user-1",
        headerSignature: "sig",
        name: "My Bank",
        mapping: sampleMapping,
      });

      expect(mockMapping.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ name: "My Bank" }),
          update: expect.objectContaining({ name: "My Bank" }),
        }),
      );
    });

    it("persists an explicit format", async () => {
      mockMapping.upsert.mockResolvedValue({} as never);

      await upsertMapping({
        userId: "user-1",
        headerSignature: "sig",
        format: "custom",
        mapping: sampleMapping,
      });

      expect(mockMapping.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ format: "custom" }),
          update: expect.objectContaining({ format: "custom" }),
        }),
      );
    });
  });
});
