import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { ServiceError } from "../errors.js";
import * as transactionRepository from "../repositories/transaction.repository.js";
import { autoCategorize, recategorizeRange } from "./categorization.service.js";
import { logEventCritical } from "./audit.service.js";

export async function getTransaction(id: string, userId: string) {
  return transactionRepository.findByIdForUser(id, userId);
}

export async function updateTransaction(
  id: string,
  userId: string,
  data: {
    categoryId?: string | null;
    notes?: string;
    date?: string;
    amount?: number;
    reason?: string;
  },
  isAdmin = false,
) {
  return prisma.$transaction(async (tx) => {
    const previous = await transactionRepository.findByIdForUser(id, userId, isAdmin, tx);

    const updateData: Record<string, unknown> = { ...data };
    delete updateData.reason;

    if (data.categoryId !== undefined) {
      // Clearing the category (null) restores the fresh-from-import state so
      // a subsequent auto-categorize run can re-evaluate. Setting a category
      // explicitly marks the row as user-edited and excludes it from auto-cat.
      updateData.manualOverride = data.categoryId !== null;
    }
    if (data.date !== undefined) {
      updateData.dateId = dateStringToId(data.date);
      delete updateData.date;
    }

    const updated = await transactionRepository.updateById(id, userId, updateData, isAdmin, tx);

    const changedValues: Record<string, unknown> = {};
    if (data.categoryId !== undefined && data.categoryId !== previous.categoryId) {
      changedValues.categoryId = data.categoryId;
    }
    if (data.notes !== undefined && data.notes !== previous.notes) {
      changedValues.notes = data.notes;
    }
    if (data.amount !== undefined && data.amount !== Number(previous.amount)) {
      changedValues.amount = data.amount;
    }
    if (data.date !== undefined && data.date !== dateIdToIso(previous.dateId)) {
      changedValues.date = data.date;
    }

    if (Object.keys(changedValues).length > 0) {
      const previousValues: Record<string, unknown> = {};
      for (const key of Object.keys(changedValues)) {
        if (key === "date") previousValues.date = dateIdToIso(previous.dateId);
        else if (key === "amount") previousValues.amount = Number(previous.amount);
        else previousValues[key] = (previous as Record<string, unknown>)[key];
      }

      // When an admin edits another user's transaction, record the owning
      // user as `targetUserId` so per-user audit reconstruction does not need
      // to join the soft-deleted row.
      if (isAdmin && previous.userId !== userId) {
        changedValues.targetUserId = previous.userId;
      }

      await logEventCritical(
        {
          action: "TRANSACTION_EDIT",
          userId,
          transactionId: id,
          previousValues,
          changedValues,
          reason: data.reason,
        },
        tx,
      );
    }

    return updated;
  });
}

export async function deleteTransaction(
  id: string,
  userId: string,
  reason?: string,
  isAdmin = false,
) {
  await prisma.$transaction(async (tx) => {
    const previous = await transactionRepository.findByIdForUser(id, userId, isAdmin, tx);

    await transactionRepository.deleteById(id, userId, isAdmin, tx);

    const previousValues: Record<string, unknown> = {
      amount: Number(previous.amount),
      date: dateIdToIso(previous.dateId),
      merchant: previous.merchant.name,
      categoryId: previous.categoryId,
    };
    const changedValues: Record<string, unknown> = { isDeleted: true };
    if (isAdmin && previous.userId !== userId) {
      changedValues.targetUserId = previous.userId;
    }

    await logEventCritical(
      {
        action: "TRANSACTION_DELETE",
        userId,
        transactionId: id,
        previousValues,
        changedValues,
        reason,
      },
      tx,
    );
  });
}

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
  accountId?: string;
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

export async function recategorizeTransactionsInRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<{ recategorized: number }> {
  return recategorizeRange(userId, startDate, endDate);
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
    accountId,
    minAmount,
    maxAmount,
    search,
  } = params;

  if (minAmount !== undefined && maxAmount !== undefined && minAmount > maxAmount) {
    throw new ServiceError(400, "minAmount must not exceed maxAmount");
  }

  // Only transactions belonging to active accounts are shown; deactivating an
  // account hides its transactions from the view without deleting them (KAN-169).
  const where: Prisma.FactTransactionsWhereInput = { userId, account: { active: true } };

  if (accountId) {
    where.accountId = accountId;
  }

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

  if (search) {
    where.merchant = { name: { contains: search, mode: "insensitive" as const } };
  }

  // A transaction is "in" a category either directly (explicit / manual override
  // on FactTransactions.categoryId) or implicitly via the user's merchant→category
  // mapping. Match both so the filter is consistent with how the response
  // resolves `categoryName` (see `data.map` below).
  if (categoryId) {
    where.OR = [
      { categoryId },
      { categoryId: null, merchant: { mappings: { some: { userId, categoryId } } } },
    ];
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

  const data = rows.map((row) => {
    // Prefer transaction.categoryId, fallback to merchant mappings
    const finalCategoryId = row.categoryId ?? row.merchant.mappings[0]?.category?.id ?? null;
    const finalCategoryName =
      row.category?.categoryName ?? row.merchant.mappings[0]?.category?.categoryName ?? null;

    return {
      id: row.id,
      amount: row.amount.toString(),
      date: dateIdToIso(row.dateId),
      accountId: row.accountId,
      merchantId: row.merchant.id,
      merchant: row.merchant.name,
      categoryId: finalCategoryId,
      categoryName: finalCategoryName,
    };
  });

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
