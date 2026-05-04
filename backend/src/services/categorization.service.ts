import * as categoryRuleRepository from "../repositories/category-rule.repository.js";
import * as transactionRepository from "../repositories/transaction.repository.js";
import { dateStringToId } from "../repositories/dashboard.repository.js";
import { validateDateRange } from "./date-range.js";
import { getLogger } from "../logger.js";

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
    if (rule.matchType === "exact") {
      if (name === rule.pattern.toLowerCase()) return rule.categoryId;
    } else if (rule.matchType === "contains") {
      if (name.includes(rule.pattern.toLowerCase())) return rule.categoryId;
    } else if (rule.matchType === "regex") {
      try {
        if (new RegExp(rule.pattern, "i").test(merchantName)) return rule.categoryId;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Applies category rules to all uncategorized, non-manual-override transactions
 * for the given user. Returns the number of transactions that were categorized.
 */
export async function autoCategorize(userId: string): Promise<{ categorized: number }> {
  const rawRules = await categoryRuleRepository.findAllByUser(userId);
  if (rawRules.length === 0) return { categorized: 0 };

  const rules = rawRules.filter((rule) => {
    if (rule.matchType !== "regex") return true;
    try {
      new RegExp(rule.pattern, "i");
      return true;
    } catch {
      getLogger().warn(
        { ruleId: rule.id, pattern: rule.pattern },
        "Category rule has invalid regex pattern — skipping",
      );
      return false;
    }
  });

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

/**
 * Re-applies category rules to every non-manual-override transaction in the
 * given date range. Unlike {@link autoCategorize}, this also overwrites rows
 * that already have a category — useful when the user adds a new rule and
 * wants past transactions reclassified.
 *
 * Rules are evaluated in priority-desc order (the order returned by
 * {@link categoryRuleRepository.findAllByUser}) so the highest-weight rule
 * always wins, regardless of category alphabetical order. Transactions whose
 * merchant matches no rule are left untouched (their previous category — if
 * any — is preserved).
 */
export async function recategorizeRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<{ recategorized: number }> {
  validateDateRange(startDate, endDate);

  const rules = await categoryRuleRepository.findAllByUser(userId);
  if (rules.length === 0) return { recategorized: 0 };

  const startDateId = dateStringToId(startDate);
  const endDateId = dateStringToId(endDate);
  const transactions = await transactionRepository.findCategorizableInRange(
    userId,
    startDateId,
    endDateId,
  );
  if (transactions.length === 0) return { recategorized: 0 };

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

    // Skip writes when the row is already in the right category — avoids
    // unnecessary updateMany churn and noisy "0 changes" UI feedback.
    if (tx.categoryId === categoryId) continue;

    updates.push({ id: tx.id, categoryId });
  }

  if (updates.length === 0) return { recategorized: 0 };

  const recategorized = await transactionRepository.bulkSetCategory(userId, updates);
  return { recategorized };
}
