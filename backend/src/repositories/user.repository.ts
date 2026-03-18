import type { PrismaClient } from "@prisma/client";
import { prisma } from "../prisma.js";

type TransactionClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export async function findByEmail(email: string) {
  return prisma.dimUser.findUnique({ where: { email } });
}

export async function findCurrencyByCode(code: string) {
  return prisma.dimCurrency.findUnique({ where: { code } });
}

export async function createUser(data: {
  email: string;
  password: string;
  defaultCurrencyId: string;
}): Promise<{ id: string; email: string; role: string; createdAt: Date }> {
  return prisma.$transaction(async (tx: TransactionClient) => {
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

export async function deleteUsersByEmails(emails: string[]) {
  return prisma.dimUser.deleteMany({ where: { email: { in: emails } } });
}
