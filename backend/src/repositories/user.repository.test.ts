import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma.js", () => ({
  prisma: {
    dimUser: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import {
  findById,
  findByIdWithPassword,
  findByEmail,
  findByEmailWithPassword,
  updatePassword,
} from "./user.repository.js";
import { prisma } from "../prisma.js";

const mockFindUnique = vi.mocked(prisma.dimUser.findUnique);
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
        select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
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
  it("queries by id with select limited to id and password", async () => {
    mockFindUnique.mockResolvedValue({ id: "user-1", password: "hash" } as never);

    await findByIdWithPassword("user-1");

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { id: true, password: true },
    });
  });
});

// ── findByEmail ───────────────────────────────────────────────────────────────

describe("findByEmail", () => {
  it("excludes the password column from the select", async () => {
    mockFindUnique.mockResolvedValue(profileRow as never);

    await findByEmail("test@example.com");

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "test@example.com" },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    });
  });
});

// ── findByEmailWithPassword ───────────────────────────────────────────────────

describe("findByEmailWithPassword", () => {
  it("includes the password column in the select", async () => {
    mockFindUnique.mockResolvedValue({ ...profileRow, password: "hash" } as never);

    await findByEmailWithPassword("test@example.com");

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "test@example.com" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        password: true,
        createdAt: true,
      },
    });
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
