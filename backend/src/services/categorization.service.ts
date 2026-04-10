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

  // Compute merchant → categoryId mapping once and build the update list in a
  // single pass. Avoids redundant rule evaluation for repeated merchants and
  // sidesteps a non-null assertion that filter+map would require.
  const merchantCategoryMap = new Map<string, string>();
  const updates: Array<{ id: string; categoryId: string }> = [];
  for (const tx of transactions) {
    const name = tx.merchant?.name;
    if (!name) continue;

    let categoryId = merchantCategoryMap.get(name);
    if (categoryId === undefined) {
      const matched = matchTransaction(name, rules);
      if (matched === null) continue;
      categoryId = matched;
      merchantCategoryMap.set(name, categoryId);
    }

    updates.push({ id: tx.id, categoryId });
  }

  if (updates.length === 0) return { categorized: 0 };

  // Use the real affected-row count from the DB rather than `updates.length`,
  // so the response reflects rows that may have been concurrently deleted or
  // had `manualOverride` toggled between the read and the write.
  const categorized = await transactionRepository.bulkSetCategory(userId, updates);
  return { categorized };
}
