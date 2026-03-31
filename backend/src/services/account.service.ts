import * as accountRepository from "../repositories/account.repository.js";

export async function getAccountsByUser(userId: string) {
  return accountRepository.findAccountsByUser(userId);
}
