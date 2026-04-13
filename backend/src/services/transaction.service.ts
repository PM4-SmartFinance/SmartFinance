import type { Prisma } from "@prisma/client";
import { ServiceError } from "../errors.js";
import * as transactionRepository from "../repositories/transaction.repository.js";
import { autoCategorize } from "./categorization.service.js";

export type SortBy = "date" | "amount" | "merchant";
export type SortOrder = "asc" | "desc";

export interface ListTransactionsParams {
  userId: string;
  page: number;
  limit: number;
  sortBy: SortBy;
  sortOrder: SortOrder;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
}

function dateStringToId(s: string): number {
  return parseInt(s.replace(/-/g, ""), 10);
}

function dateIdToIso(dateId: number): string {
  const year = Math.floor(dateId / 10000);
  const month = Math.floor((dateId % 10000) / 100);
  const day = dateId % 100;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Service-layer entry point for the rule-based categorization engine.
 * Kept as a thin pass-through so the controller depends on `transactionService`
 * (the resource it owns) rather than reaching across to `categorization.service`
 * directly. This is the natural seam for future cross-cutting concerns
 * (metrics, audit logging, authorization) that should wrap the engine.
 */
export async function autoCategorizeTransactions(userId: string): Promise<{ categorized: number }> {
  return autoCategorize(userId);
}

export async function listTransactions(params: ListTransactionsParams) {
  const {
    userId,
    page,
    limit,
    sortBy,
    sortOrder,
    startDate,
    endDate,
    categoryId,
    minAmount,
    maxAmount,
    search,
  } = params;

  if (minAmount !== undefined && maxAmount !== undefined && minAmount > maxAmount) {
    throw new ServiceError(400, "minAmount must not exceed maxAmount");
  }

  const where: Prisma.FactTransactionsWhereInput = { userId };

  if (startDate || endDate) {
    where.dateId = {
      ...(startDate ? { gte: dateStringToId(startDate) } : {}),
      ...(endDate ? { lte: dateStringToId(endDate) } : {}),
    };
  }

  if (minAmount !== undefined || maxAmount !== undefined) {
    where.amount = {
      ...(minAmount !== undefined ? { gte: minAmount } : {}),
      ...(maxAmount !== undefined ? { lte: maxAmount } : {}),
    };
  }

  if (categoryId || search) {
    where.merchant = {
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
      ...(categoryId ? { mappings: { some: { userId, categoryId } } } : {}),
    };
  }

  const orderBy: Prisma.FactTransactionsOrderByWithRelationInput =
    sortBy === "merchant"
      ? { merchant: { name: sortOrder } }
      : sortBy === "amount"
        ? { amount: sortOrder }
        : { dateId: sortOrder };

  const [rows, totalCount] = await transactionRepository.listTransactions({
    userId,
    skip: (page - 1) * limit,
    take: limit,
    orderBy,
    where,
  });

  const data = rows.map((row) => ({
    id: row.id,
    amount: row.amount.toString(),
    date: dateIdToIso(row.dateId),
    accountId: row.accountId,
    merchantId: row.merchant.id,
    merchant: row.merchant.name,
    categoryId: row.merchant.mappings[0]?.category?.id ?? null,
    categoryName: row.merchant.mappings[0]?.category?.categoryName ?? null,
  }));

  return {
    data,
    meta: {
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      page,
      limit,
    },
  };
}
