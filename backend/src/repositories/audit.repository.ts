import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

export async function createAuditLog(data: {
  action: string;
  userId?: string | null;
  transactionId?: string | null;
  previousValues?: Record<string, unknown> | null;
  changedValues?: Record<string, unknown> | null;
  reason?: string | null;
}) {
  return prisma.auditLog.create({ data });
}

export async function findAuditLogs(params: {
  skip: number;
  take: number;
  userId?: string;
  action?: string;
  transactionId?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const { skip, take, userId, action, transactionId, startDate, endDate } = params;
  const where: Prisma.AuditLogWhereInput = {};

  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (transactionId) where.transactionId = transactionId;
  if (startDate || endDate) {
    where.createdAt = {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {}),
    };
  }

  const [logs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}
