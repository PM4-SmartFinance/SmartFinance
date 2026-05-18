import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

export async function createAuditLog(
  params: {
    action: string;
    userId?: string | null | undefined;
    transactionId?: string | null | undefined;
    previousValues?: Record<string, unknown> | null | undefined;
    changedValues?: Record<string, unknown> | null | undefined;
    reason?: string | null | undefined;
  },
  tx?: Prisma.TransactionClient,
) {
  const data: Prisma.AuditLogCreateInput = {
    action: params.action,
    userId: params.userId ?? null,
    transactionId: params.transactionId ?? null,
    previousValues: (params.previousValues ?? null) as Prisma.InputJsonValue,
    changedValues: (params.changedValues ?? null) as Prisma.InputJsonValue,
    reason: params.reason ?? null,
  };
  const client = tx ?? prisma;
  return client.auditLog.create({ data });
}

export async function findAuditLogs(params: {
  skip: number;
  take: number;
  userId?: string | undefined;
  action?: string | undefined;
  transactionId?: string | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
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
