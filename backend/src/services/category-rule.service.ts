import { DuplicateRuleError, ServiceError } from "../errors.js";
import * as categoryRuleRepository from "../repositories/category-rule.repository.js";
import type { MatchType } from "../repositories/category-rule.repository.js";
import * as transactionRepository from "../repositories/transaction.repository.js";

export async function listRules(userId: string) {
  return categoryRuleRepository.findAllByUser(userId);
}

export async function getRule(id: string, userId: string) {
  const rule = await categoryRuleRepository.findById(id, userId);
  if (!rule) {
    throw new ServiceError(404, "Category rule not found");
  }
  return rule;
}

export async function createRule(
  userId: string,
  categoryId: string,
  pattern: string,
  matchType: MatchType,
  priority: number,
) {
  const category = await categoryRuleRepository.findCategoryForUser(categoryId, userId);
  if (!category) {
    throw new ServiceError(404, "Category not found");
  }
  try {
    return await categoryRuleRepository.create({
      userId,
      categoryId,
      pattern,
      matchType,
      priority,
    });
  } catch (err) {
    if (err instanceof DuplicateRuleError) {
      throw new ServiceError(409, err.message);
    }
    throw err;
  }
}

export async function updateRule(
  id: string,
  userId: string,
  data: { pattern?: string; matchType?: MatchType; categoryId?: string; priority?: number },
) {
  if (data.categoryId != null) {
    const category = await categoryRuleRepository.findCategoryForUser(data.categoryId, userId);
    if (!category) {
      throw new ServiceError(404, "Category not found");
    }
  }
  try {
    const rule = await categoryRuleRepository.update(id, userId, data);
    if (!rule) {
      throw new ServiceError(404, "Category rule not found");
    }
    return rule;
  } catch (err) {
    if (err instanceof DuplicateRuleError) {
      throw new ServiceError(409, err.message);
    }
    throw err;
  }
}

export async function deleteRule(id: string, userId: string) {
  const deleted = await categoryRuleRepository.remove(id, userId);
  if (!deleted) {
    throw new ServiceError(404, "Category rule not found");
  }
}

export async function previewRule(
  userId: string,
  rule: { pattern: string; matchType: MatchType; categoryId: string; priority: number },
): Promise<{
  matchCount: number;
  matchedTransactions: Array<{
    id: string;
    merchantName: string;
    amount: number;
    dateId: number;
  }>;
}> {
  const category = await categoryRuleRepository.findCategoryForUser(rule.categoryId, userId);
  if (!category) {
    throw new ServiceError(404, "Category not found");
  }
  return transactionRepository.findPreviewMatchesForUser(userId, rule.pattern, rule.matchType, 3);
}

export interface RuleOverlap {
  id: string;
  pattern: string;
  matchType: MatchType;
  priority: number;
  categoryId: string;
  categoryName: string;
}

/**
 * Two patterns overlap when at least one merchant string can satisfy both
 * rules. Used by the rule editor to warn the user about conflicting rules
 * without blocking the save (priority disambiguates at evaluation time).
 *
 * Heuristic — case-insensitive:
 *  - exact A   vs exact B   : overlap iff A === B
 *  - exact A   vs contains B: overlap iff A includes B
 *  - contains A vs exact B  : overlap iff B includes A
 *  - contains A vs contains B: overlap iff either includes the other
 */
export function patternsOverlap(
  a: { pattern: string; matchType: MatchType },
  b: { pattern: string; matchType: MatchType },
): boolean {
  const ap = a.pattern.toLowerCase();
  const bp = b.pattern.toLowerCase();
  if (a.matchType === "exact" && b.matchType === "exact") return ap === bp;
  if (a.matchType === "exact" && b.matchType === "contains") return ap.includes(bp);
  if (a.matchType === "contains" && b.matchType === "exact") return bp.includes(ap);
  return ap.includes(bp) || bp.includes(ap);
}

export async function findOverlappingRules(
  userId: string,
  candidate: { pattern: string; matchType: MatchType; excludeRuleId?: string },
): Promise<RuleOverlap[]> {
  if (candidate.pattern.trim().length === 0) return [];

  const all = await categoryRuleRepository.findAllByUser(userId);
  return all
    .filter((rule) => rule.id !== candidate.excludeRuleId)
    .filter((rule) =>
      patternsOverlap(
        { pattern: candidate.pattern, matchType: candidate.matchType },
        { pattern: rule.pattern, matchType: rule.matchType as MatchType },
      ),
    )
    .map((rule) => ({
      id: rule.id,
      pattern: rule.pattern,
      matchType: rule.matchType as MatchType,
      priority: rule.priority,
      categoryId: rule.categoryId,
      categoryName: rule.category.categoryName,
    }));
}
