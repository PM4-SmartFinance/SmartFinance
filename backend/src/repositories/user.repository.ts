import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

export class BootstrapUnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "BootstrapUnauthorizedError";
  }
}

export class BootstrapForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "BootstrapForbiddenError";
  }
}

export async function findByEmail(email: string) {
  return prisma.dimUser.findUnique({ where: { email } });
}

export async function findCurrencyByCode(code: string) {
  return prisma.dimCurrency.findUnique({ where: { code } });
}

export async function findById(id: string) {
  return prisma.dimUser.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  });
}

export async function listUsers(opts: { limit?: number; offset?: number; active?: boolean } = {}) {
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = Math.max(opts.offset ?? 0, 0);
  const where = opts.active !== undefined ? { active: opts.active } : {};
  const [items, total] = await Promise.all([
    prisma.dimUser.findMany({
      where,
      take: limit,
      skip: offset,
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.dimUser.count({ where }),
  ]);
  return { items, total, limit, offset };
}

export async function countTotalUsers() {
  return prisma.dimUser.count();
}

export async function createUser(data: {
  email: string;
  name?: string;
  password: string;
  role?: string;
  defaultCurrencyId: string;
}): Promise<{ id: string; email: string; name: string | null; role: string; createdAt: Date }> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const count = await tx.dimUser.count();
    const role = count === 0 ? "ADMIN" : (data.role ?? "USER");
    return tx.dimUser.create({
      data: { ...data, role, name: data.name ?? null },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  });
}

/**
 * Atomic bootstrap-aware user creation.
 *
 * Runs the count check, authorization gate, email-uniqueness check and insert
 * inside a single serializable transaction so two concurrent unauthenticated
 * bootstrap requests cannot both succeed, and so concurrent duplicate-email
 * inserts are always reported as a 409 instead of a generic 500.
 *
 * Throws:
 * - BootstrapUnauthorizedError — post-bootstrap call without a session
 * - BootstrapForbiddenError    — post-bootstrap call from a non-admin
 * - EmailConflictError         — duplicate email (either the in-tx check or
 *                                the DB unique constraint via Prisma P2002)
 */
export async function createUserAtomic(
  requestingUser: { id: string; role: string } | null,
  data: {
    email: string;
    name?: string;
    password: string;
    role?: string;
    defaultCurrencyId: string;
  },
): Promise<{ id: string; email: string; name: string | null; role: string; createdAt: Date }> {
  // A serializable transaction guarantees that two concurrent callers cannot
  // both observe `count === 0` and both succeed; the second committer will
  // receive a serialization failure (Prisma P2034 / Postgres 40001), which we
  // retry so the loser re-reads the now-populated table and hits the normal
  // post-bootstrap auth gate.
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const count = await tx.dimUser.count();

          if (count > 0) {
            if (!requestingUser) throw new BootstrapUnauthorizedError();
            if (requestingUser.role !== "ADMIN") throw new BootstrapForbiddenError();
          }

          const existing = await tx.dimUser.findUnique({ where: { email: data.email } });
          if (existing) throw new EmailConflictError();

          // Bootstrap: first user is always ADMIN regardless of caller input.
          const role = count === 0 ? "ADMIN" : (data.role ?? "USER");

          return tx.dimUser.create({
            data: { ...data, role, name: data.name ?? null },
            select: { id: true, email: true, name: true, role: true, createdAt: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      // Map Prisma unique-constraint violation to a domain conflict error so the
      // service layer can return a clean 409 instead of a generic 500.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new EmailConflictError();
      }
      // Retry on serialization failure. Postgres reports these with SQLSTATE
      // 40001 ("could not serialize access") and Prisma surfaces them either
      // as a known request error with code P2034 or as an unknown request
      // error whose message contains the Postgres text — catch both.
      const message = err instanceof Error ? err.message : "";
      const isSerializationFailure =
        (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") ||
        /could not serialize access|deadlock detected|40001/i.test(message);
      if (isSerializationFailure && attempt < MAX_ATTEMPTS) {
        continue;
      }
      throw err;
    }
  }
  // Unreachable — the loop either returns or throws.
  throw new Error("createUserAtomic: exhausted retries without resolving");
}

export async function updateUserRole(email: string, role: string) {
  return prisma.dimUser.update({ where: { email }, data: { role } });
}

export async function updateUserById(
  id: string,
  data: Partial<{
    email: string;
    name: string | null;
    role: string;
    password: string;
    defaultCurrencyId: string;
    active: boolean;
  }>,
) {
  return prisma.dimUser.update({
    where: { id },
    data,
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  });
}

export async function deleteUserById(id: string) {
  return prisma.dimUser.delete({ where: { id } });
}

export async function deleteUsersByEmails(emails: string[]) {
  return prisma.dimUser.deleteMany({ where: { email: { in: emails } } });
}

export async function findByIdWithPassword(id: string) {
  return prisma.dimUser.findUnique({ where: { id }, select: { id: true, password: true } });
}

export async function findByEmailExcluding(email: string, excludeId: string) {
  return prisma.dimUser.findFirst({ where: { email, NOT: { id: excludeId } } });
}

export class EmailConflictError extends Error {
  constructor() {
    super("Email already in use");
    this.name = "EmailConflictError";
  }
}

export async function updateProfileAtomic(id: string, data: { name?: string; email?: string }) {
  return prisma.$transaction(async (tx) => {
    if (data.email !== undefined) {
      const conflict = await tx.dimUser.findFirst({ where: { email: data.email, NOT: { id } } });
      if (conflict) throw new EmailConflictError();
    }
    return tx.dimUser.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true },
    });
  });
}

export async function updateProfile(id: string, data: { name?: string; email?: string }) {
  return prisma.dimUser.update({
    where: { id },
    data,
    select: { id: true, email: true, name: true, role: true },
  });
}

export async function updatePassword(id: string, hashedPassword: string) {
  return prisma.dimUser.update({
    where: { id },
    data: { password: hashedPassword },
    select: { id: true },
  });
}
