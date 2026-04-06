import { type Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

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

export async function deleteUsersByEmails(emails: string[]) {
  return prisma.dimUser.deleteMany({ where: { email: { in: emails } } });
}

export async function findById(id: string) {
  return prisma.dimUser.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
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
