import * as categoryRuleRepository from "../repositories/category-rule.repository.js";
import * as transactionRepository from "../repositories/transaction.repository.js";

export type RuleForMatching = {
  pattern: string;
  matchType: string;
  categoryId: string;
};

/**
 * Matches a merchant name against a list of rules (sorted by priority descending).
 * Returns the categoryId of the first matching rule, or null if none match.
 */
export function matchTransaction(merchantName: string, rules: RuleForMatching[]): string | null {
  const name = merchantName.toLowerCase();
  for (const rule of rules) {
    const pattern = rule.pattern.toLowerCase();
    if (rule.matchType === "exact" && name === pattern) {
      return rule.categoryId;
    }
    if (rule.matchType === "contains" && name.includes(pattern)) {
      return rule.categoryId;
    }
  }
  return null;
}

/**
 * Applies category rules to all uncategorized, non-manual-override transactions
 * for the given user. Returns the number of transactions that were categorized.
 */
export async function autoCategorize(userId: string): Promise<{ categorized: number }> {
  const rules = await categoryRuleRepository.findAllByUser(userId);
  if (rules.length === 0) return { categorized: 0 };

  const transactions = await transactionRepository.findUncategorizedForUser(userId);
  if (transactions.length === 0) return { categorized: 0 };

  // Compute merchant → categoryId mapping to avoid redundant rule evaluation
  const merchantCategoryMap = new Map<string, string>();
  for (const tx of transactions) {
    const name = tx.merchant.name;
    if (!merchantCategoryMap.has(name)) {
      const categoryId = matchTransaction(name, rules);
      if (categoryId !== null) {
        merchantCategoryMap.set(name, categoryId);
      }
    }
  }

  const updates = transactions
    .filter((tx) => merchantCategoryMap.has(tx.merchant.name))
    .map((tx) => ({ id: tx.id, categoryId: merchantCategoryMap.get(tx.merchant.name)! }));

  if (updates.length > 0) {
    await transactionRepository.bulkSetCategory(updates);
  }

  return { categorized: updates.length };
}
