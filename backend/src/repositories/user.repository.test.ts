import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma.js", () => ({
  prisma: {
    dimUser: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import {
  findById,
  findByIdWithPassword,
  findByEmailExcluding,
  updateProfile,
  updatePassword,
} from "./user.repository.js";
import { prisma } from "../prisma.js";

const mockFindUnique = vi.mocked(prisma.dimUser.findUnique);
const mockFindFirst = vi.mocked(prisma.dimUser.findFirst);
const mockUpdate = vi.mocked(prisma.dimUser.update);

const profileRow = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  role: "USER",
  createdAt: new Date("2025-01-01"),
};

beforeEach(() => vi.clearAllMocks());

// ── findById ──────────────────────────────────────────────────────────────────

describe("findById", () => {
  it("queries by id", async () => {
    mockFindUnique.mockResolvedValue(profileRow as never);

    await findById("user-1");

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } }),
    );
  });

  it("selects only safe fields (no password)", async () => {
    mockFindUnique.mockResolvedValue(profileRow as never);

    await findById("user-1");

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      }),
    );
  });

  it("returns null when user is not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await findById("ghost");

    expect(result).toBeNull();
  });
});

// ── findByIdWithPassword ───────────────────────────────────────────────────────

describe("findByIdWithPassword", () => {
  it("queries by id without field restriction", async () => {
    mockFindUnique.mockResolvedValue({ ...profileRow, password: "hash" } as never);

    await findByIdWithPassword("user-1");

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "user-1" } });
  });
});

// ── findByEmailExcluding ──────────────────────────────────────────────────────

describe("findByEmailExcluding", () => {
  it("queries by email excluding the given user id", async () => {
    mockFindFirst.mockResolvedValue(null);

    await findByEmailExcluding("other@example.com", "user-1");

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { email: "other@example.com", NOT: { id: "user-1" } },
    });
  });

  it("returns the conflicting user when found", async () => {
    mockFindFirst.mockResolvedValue({ ...profileRow, email: "other@example.com" } as never);

    const result = await findByEmailExcluding("other@example.com", "user-2");

    expect(result).not.toBeNull();
  });
});

// ── updateProfile ─────────────────────────────────────────────────────────────

describe("updateProfile", () => {
  it("updates name and email", async () => {
    mockUpdate.mockResolvedValue({ ...profileRow, name: "New", email: "new@example.com" } as never);

    await updateProfile("user-1", { name: "New", email: "new@example.com" });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: { name: "New", email: "new@example.com" },
      }),
    );
  });

  it("selects only safe fields in the result", async () => {
    mockUpdate.mockResolvedValue(profileRow as never);

    await updateProfile("user-1", { name: "New" });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, email: true, name: true, role: true },
      }),
    );
  });
});

// ── updatePassword ─────────────────────────────────────────────────────────────

describe("updatePassword", () => {
  it("updates only the password field", async () => {
    mockUpdate.mockResolvedValue({ id: "user-1" } as never);

    await updatePassword("user-1", "new-hash");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: { password: "new-hash" },
      }),
    );
  });
});
