import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { EmailConflictError } from "../errors.js";
import { getLogger } from "../logger.js";

export async function findByEmail(email: string) {
  return prisma.dimUser.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  });
}

export async function findByEmailWithPassword(email: string) {
  return prisma.dimUser.findUnique({
    where: { email },
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

/**
 * Atomic user creation.
 *
 * Runs the count check, caller-supplied authorization gate, email-uniqueness
 * check, user insert, and default-category insert inside a single serializable
 * transaction so two concurrent unauthenticated bootstrap requests cannot both
 * succeed, and so concurrent duplicate-email inserts are always reported as a
 * conflict instead of a generic 500.
 *
 * The `authorize` callback is invoked inside the transaction once the row
 * count is known. The service supplies it so policy (RBAC, bootstrap rules)
 * lives in the service layer; the repository only orchestrates the atomic
 * write. Anything `authorize` throws propagates unchanged to the caller.
 *
 * Throws (in addition to whatever `authorize` may throw):
 * - EmailConflictError — duplicate email (in-tx check or DB unique constraint)
 */
export async function createUserAtomic(
  data: {
    email: string;
    name?: string;
    password: string;
    role?: string;
    defaultCurrencyId: string;
    defaultCategories?: string[];
  },
  authorize: (count: number) => void,
): Promise<{ id: string; email: string; name: string | null; role: string; createdAt: Date }> {
  // A serializable transaction guarantees that two concurrent callers cannot
  // both observe `count === 0` and both succeed; the second committer will
  // receive a serialization failure (Prisma P2034 / Postgres 40001), which we
  // retry so the loser re-reads the now-populated table and hits the normal
  // post-bootstrap auth gate.
  // Retries use jittered backoff so the loser does not re-collide with an
  // in-flight winner before its commit lands (observed flake in slow CI).
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const count = await tx.dimUser.count();

          authorize(count);

          const existing = await tx.dimUser.findUnique({ where: { email: data.email } });
          if (existing) throw new EmailConflictError();

          // Bootstrap: first user is always ADMIN regardless of caller input.
          const role = count === 0 ? "ADMIN" : (data.role ?? "USER");

          const { defaultCategories, ...userData } = data;
          const user = await tx.dimUser.create({
            data: { ...userData, role, name: data.name ?? null },
            select: { id: true, email: true, name: true, role: true, createdAt: true },
          });

          if (defaultCategories?.length) {
            await tx.dimCategory.createMany({
              data: defaultCategories.map((categoryName) => ({
                categoryName,
                userId: user.id,
              })),
            });
          }

          return user;
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
        const backoffMs = 10 * 2 ** (attempt - 1) + Math.floor(Math.random() * 10);
        logRetry(attempt, MAX_ATTEMPTS, backoffMs, message);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      if (isSerializationFailure) {
        logRetryExhausted(MAX_ATTEMPTS, message);
      }
      throw err;
    }
  }
  // Unreachable — the loop either returns or throws.
  throw new Error("createUserAtomic: exhausted retries without resolving");
}

function logRetry(attempt: number, maxAttempts: number, backoffMs: number, message: string) {
  if (process.env.NODE_ENV === "test") return;
  getLogger().warn(
    { attempt, maxAttempts, backoffMs, err: message },
    "createUserAtomic: serialization failure, retrying",
  );
}

function logRetryExhausted(maxAttempts: number, message: string) {
  if (process.env.NODE_ENV === "test") return;
  getLogger().error(
    { maxAttempts, err: message },
    "createUserAtomic: serialization retries exhausted",
  );
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

export async function findByIdWithPassword(id: string) {
  return prisma.dimUser.findUnique({ where: { id }, select: { id: true, password: true } });
}

export async function updateProfileAtomic(id: string, data: { name?: string; email?: string }) {
  try {
    return await prisma.$transaction(async (tx) => {
      if (data.email !== undefined) {
        const conflict = await tx.dimUser.findFirst({
          where: { email: data.email, NOT: { id } },
          select: { id: true },
        });
        if (conflict) throw new EmailConflictError();
      }
      return tx.dimUser.update({
        where: { id },
        data,
        select: { id: true, email: true, name: true, role: true },
      });
    });
  } catch (err) {
    // Map Prisma unique-constraint violation to a domain conflict so the
    // service layer can return a clean 409 even when the in-tx pre-check
    // races with another concurrent update.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new EmailConflictError();
    }
    throw err;
  }
}

export async function updatePassword(id: string, hashedPassword: string) {
  return prisma.dimUser.update({
    where: { id },
    data: { password: hashedPassword },
    select: { id: true },
  });
}
