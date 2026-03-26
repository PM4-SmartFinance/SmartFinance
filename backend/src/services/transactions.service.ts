import { ServiceError } from "../errors.js";
import * as transactionsRepository from "../repositories/transactions.repository.js";

export async function getTransaction(id: string, userId: string) {
  const transaction = await transactionsRepository.findById(id);
  if (!transaction) {
    throw new ServiceError(404, "Transaction not found");
  }
  if (transaction.userId !== userId) {
    throw new ServiceError(404, "Transaction not found");
  }
  return transaction;
}

export async function updateTransaction(
  id: string,
  userId: string,
  data: { categoryId?: string; notes?: string },
) {
  const transaction = await transactionsRepository.findById(id);
  if (!transaction) {
    throw new ServiceError(404, "Transaction not found");
  }
  if (transaction.userId !== userId) {
    throw new ServiceError(404, "Transaction not found");
  }

  const updateData: { categoryId?: string; notes?: string; manualOverride?: boolean } = {
    ...data,
  };
  if (data.categoryId !== undefined) {
    updateData.manualOverride = true;
  }

  return transactionsRepository.updateById(id, updateData);
}

export async function deleteTransaction(id: string, userId: string) {
  const transaction = await transactionsRepository.findById(id);
  if (!transaction) {
    throw new ServiceError(404, "Transaction not found");
  }
  if (transaction.userId !== userId) {
    throw new ServiceError(404, "Transaction not found");
  }
  await transactionsRepository.deleteById(id);
}
