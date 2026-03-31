import { type Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

export async function findByEmail(email: string) {
  return prisma.dimUser.findUnique({ where: { email } });
}

export async function findCurrencyByCode(code: string) {
  return prisma.dimCurrency.findUnique({ where: { code } });
}
export async function findById(id: string) {
  return prisma.dimUser.findUnique({ where: { id } });
}

export async function listUsers(opts: { limit?: number; offset?: number } = {}) {
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = Math.max(opts.offset ?? 0, 0);
  const [items, total] = await Promise.all([
    prisma.dimUser.findMany({
      take: limit,
      skip: offset,
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.dimUser.count(),
  ]);
  return { items, total, limit, offset };
}

export async function createUser(data: {
  email: string;
  password: string;
  defaultCurrencyId: string;
}): Promise<{ id: string; email: string; role: string; createdAt: Date }> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const count = await tx.dimUser.count();
    const role = count === 0 ? "ADMIN" : "USER";
    return tx.dimUser.create({
      data: { ...data, role },
      select: { id: true, email: true, role: true, createdAt: true },
    });
  });
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
    active?: boolean;
  }>,
) {
  return prisma.dimUser.update({ where: { id }, data });
}

export async function deleteUserById(id: string) {
  return prisma.dimUser.delete({ where: { id } });
}

export async function deleteUsersByEmails(emails: string[]) {
  return prisma.dimUser.deleteMany({ where: { email: { in: emails } } });
}
