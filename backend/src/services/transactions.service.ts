import * as transactionsRepository from "../repositories/transactions.repository.js";

export async function getTransaction(id: string, userId: string) {
  return transactionsRepository.findByIdForUser(id, userId);
}

export async function updateTransaction(
  id: string,
  userId: string,
  data: { categoryId?: string; notes?: string },
) {
  const updateData: { categoryId?: string; notes?: string; manualOverride?: boolean } = {
    ...data,
  };
  if (data.categoryId !== undefined) {
    updateData.manualOverride = true;
  }

  return transactionsRepository.updateById(id, userId, updateData);
}

export async function deleteTransaction(id: string, userId: string) {
  await transactionsRepository.deleteById(id, userId);
}
