import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("../prisma.js", () => ({
  prisma: {
    dimUser: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    dimCategory: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import {
  findById,
  findByIdWithPassword,
  findByEmail,
  findByEmailWithPassword,
  updatePassword,
  createUserAtomic,
  updateProfileAtomic,
} from "./user.repository.js";
import { prisma } from "../prisma.js";
import { EmailConflictError } from "../errors.js";

const mockFindUnique = vi.mocked(prisma.dimUser.findUnique);
const mockUpdate = vi.mocked(prisma.dimUser.update);
const mockTransaction = vi.mocked(prisma.$transaction);

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

// ── createUserAtomic ──────────────────────────────────────────────────────────

interface UserTxStub {
  count: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
}

interface CategoryTxStub {
  createMany: ReturnType<typeof vi.fn>;
}

function makeTxStub(opts: {
  count?: number;
  existing?: { id: string } | null;
  createResult?: unknown;
  createReject?: unknown;
}): { dimUser: UserTxStub; dimCategory: CategoryTxStub } {
  return {
    dimUser: {
      count: vi.fn().mockResolvedValue(opts.count ?? 0),
      findUnique: vi.fn().mockResolvedValue(opts.existing ?? null),
      create: opts.createReject
        ? vi.fn().mockRejectedValue(opts.createReject)
        : vi.fn().mockResolvedValue(opts.createResult),
    },
    dimCategory: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

describe("createUserAtomic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "test";
  });

  const baseInput = {
    email: "new@example.com",
    password: "hash",
    defaultCurrencyId: "currency-1",
  };

  const createdUser = {
    id: "user-1",
    email: "new@example.com",
    name: null,
    role: "ADMIN" as const,
    createdAt: new Date("2026-01-01"),
  };

  it("forces ADMIN role on the bootstrap user even when a USER role was supplied", async () => {
    const tx = makeTxStub({ count: 0, createResult: { ...createdUser, role: "ADMIN" } });
    // @ts-expect-error -- partial TransactionClient stub
    mockTransaction.mockImplementation((cb) => cb(tx));

    await createUserAtomic({ ...baseInput, role: "USER" }, () => {});

    expect(tx.dimUser.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "ADMIN" }) }),
    );
  });

  it("invokes authorize with the current user count and propagates its throw", async () => {
    const tx = makeTxStub({ count: 5, createResult: createdUser });
    // @ts-expect-error -- partial TransactionClient stub
    mockTransaction.mockImplementation((cb) => cb(tx));

    const authorize = vi.fn(() => {
      throw new Error("forbidden");
    });

    await expect(createUserAtomic(baseInput, authorize)).rejects.toThrow("forbidden");
    expect(authorize).toHaveBeenCalledWith(5);
    expect(tx.dimUser.create).not.toHaveBeenCalled();
  });

  it("throws EmailConflictError from the in-tx pre-check when the email already exists", async () => {
    const tx = makeTxStub({ count: 1, existing: { id: "other" } });
    // @ts-expect-error -- partial TransactionClient stub
    mockTransaction.mockImplementation((cb) => cb(tx));

    await expect(createUserAtomic(baseInput, () => {})).rejects.toBeInstanceOf(EmailConflictError);
    expect(tx.dimUser.create).not.toHaveBeenCalled();
  });

  it("maps Prisma P2002 (unique constraint) to EmailConflictError", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "5.0.0",
    });
    const tx = makeTxStub({ count: 1, createReject: p2002 });
    // @ts-expect-error -- partial TransactionClient stub
    mockTransaction.mockImplementation((cb) => cb(tx));

    await expect(createUserAtomic(baseInput, () => {})).rejects.toBeInstanceOf(EmailConflictError);
  });

  it("retries on Prisma P2034 serialization failure and returns the next attempt's result", async () => {
    const p2034 = new Prisma.PrismaClientKnownRequestError("could not serialize access", {
      code: "P2034",
      clientVersion: "5.0.0",
    });

    let attempts = 0;
    mockTransaction.mockImplementation(async (cb) => {
      attempts += 1;
      if (attempts === 1) throw p2034;
      const tx = makeTxStub({ count: 1, createResult: createdUser });
      // @ts-expect-error -- partial TransactionClient stub
      return cb(tx);
    });

    const result = await createUserAtomic(baseInput, () => {});

    expect(attempts).toBe(2);
    expect(result).toEqual(createdUser);
  });

  it("retries when the error message contains the Postgres serialization text but no P2034 code", async () => {
    const wrapped = new Error("could not serialize access due to concurrent update");

    let attempts = 0;
    mockTransaction.mockImplementation(async (cb) => {
      attempts += 1;
      if (attempts < 3) throw wrapped;
      const tx = makeTxStub({ count: 1, createResult: createdUser });
      // @ts-expect-error -- partial TransactionClient stub
      return cb(tx);
    });

    const result = await createUserAtomic(baseInput, () => {});

    expect(attempts).toBe(3);
    expect(result).toEqual(createdUser);
  });

  it("rethrows the original serialization error after exhausting all retries", async () => {
    const p2034 = new Prisma.PrismaClientKnownRequestError("could not serialize access", {
      code: "P2034",
      clientVersion: "5.0.0",
    });

    let attempts = 0;
    mockTransaction.mockImplementation(async () => {
      attempts += 1;
      throw p2034;
    });

    await expect(createUserAtomic(baseInput, () => {})).rejects.toBe(p2034);
    expect(attempts).toBe(5);
  });

  it("inserts default categories inside the same transaction", async () => {
    const tx = makeTxStub({ count: 0, createResult: createdUser });
    // @ts-expect-error -- partial TransactionClient stub
    mockTransaction.mockImplementation((cb) => cb(tx));

    await createUserAtomic({ ...baseInput, defaultCategories: ["Food", "Rent"] }, () => {});

    expect(tx.dimCategory.createMany).toHaveBeenCalledWith({
      data: [
        { categoryName: "Food", userId: createdUser.id },
        { categoryName: "Rent", userId: createdUser.id },
      ],
    });
  });

  it("does not call createMany when defaultCategories is empty", async () => {
    const tx = makeTxStub({ count: 0, createResult: createdUser });
    // @ts-expect-error -- partial TransactionClient stub
    mockTransaction.mockImplementation((cb) => cb(tx));

    await createUserAtomic({ ...baseInput, defaultCategories: [] }, () => {});

    expect(tx.dimCategory.createMany).not.toHaveBeenCalled();
  });
});

// ── updateProfileAtomic ───────────────────────────────────────────────────────

describe("updateProfileAtomic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "test";
  });

  const updatedRow = {
    id: "user-1",
    email: "new@example.com",
    name: "New Name",
    role: "USER" as const,
  };

  function makeProfileTxStub(opts: {
    conflict?: { id: string } | null;
    updateResult?: unknown;
    updateReject?: unknown;
  }) {
    return {
      dimUser: {
        findFirst: vi.fn().mockResolvedValue(opts.conflict ?? null),
        update: opts.updateReject
          ? vi.fn().mockRejectedValue(opts.updateReject)
          : vi.fn().mockResolvedValue(opts.updateResult ?? updatedRow),
      },
    };
  }

  it("runs the in-tx conflict check against another user's id when email is provided", async () => {
    const tx = makeProfileTxStub({});
    // @ts-expect-error -- partial TransactionClient stub
    mockTransaction.mockImplementation((cb) => cb(tx));

    await updateProfileAtomic("user-1", { email: "new@example.com" });

    expect(tx.dimUser.findFirst).toHaveBeenCalledWith({
      where: { email: "new@example.com", NOT: { id: "user-1" } },
      select: { id: true },
    });
  });

  it("throws EmailConflictError when the in-tx pre-check finds another user with the email", async () => {
    const tx = makeProfileTxStub({ conflict: { id: "user-2" } });
    // @ts-expect-error -- partial TransactionClient stub
    mockTransaction.mockImplementation((cb) => cb(tx));

    await expect(
      updateProfileAtomic("user-1", { email: "taken@example.com" }),
    ).rejects.toBeInstanceOf(EmailConflictError);
    expect(tx.dimUser.update).not.toHaveBeenCalled();
  });

  it("maps Prisma P2002 from the update step to EmailConflictError", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "5.0.0",
    });
    const tx = makeProfileTxStub({ updateReject: p2002 });
    // @ts-expect-error -- partial TransactionClient stub
    mockTransaction.mockImplementation((cb) => cb(tx));

    await expect(
      updateProfileAtomic("user-1", { email: "new@example.com" }),
    ).rejects.toBeInstanceOf(EmailConflictError);
  });

  it("skips the conflict check when no email is provided", async () => {
    const tx = makeProfileTxStub({});
    // @ts-expect-error -- partial TransactionClient stub
    mockTransaction.mockImplementation((cb) => cb(tx));

    await updateProfileAtomic("user-1", { name: "Name only" });

    expect(tx.dimUser.findFirst).not.toHaveBeenCalled();
    expect(tx.dimUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: { name: "Name only" },
      }),
    );
  });

  it("rethrows non-P2002 Prisma errors unchanged", async () => {
    const other = new Prisma.PrismaClientKnownRequestError("Some other failure", {
      code: "P2025",
      clientVersion: "5.0.0",
    });
    const tx = makeProfileTxStub({ updateReject: other });
    // @ts-expect-error -- partial TransactionClient stub
    mockTransaction.mockImplementation((cb) => cb(tx));

    await expect(updateProfileAtomic("user-1", { email: "new@example.com" })).rejects.toBe(other);
  });
});
