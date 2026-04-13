import { prisma } from "../prisma.js";

export async function findAccountsByUser(userId: string) {
  return prisma.dimAccount.findMany({
    where: { userId },
    select: { id: true, name: true, iban: true },
    orderBy: { name: "asc" },
  });
}
