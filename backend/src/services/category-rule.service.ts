import safeRegex from "safe-regex2";
import { DuplicateRuleError, ServiceError } from "../errors.js";
import * as categoryRuleRepository from "../repositories/category-rule.repository.js";
import { MatchType } from "../repositories/category-rule.repository.js";
import * as transactionRepository from "../repositories/transaction.repository.js";
import { autoCategorize } from "./categorization.service.js";
import { getLogger } from "../logger.js";

function assertValidRegex(pattern: string) {
  try {
    new RegExp(pattern);
  } catch {
    throw new ServiceError(400, `Invalid regex pattern: ${pattern}`);
  }
  if (!safeRegex(pattern)) {
    throw new ServiceError(400, "Regex pattern is too complex");
  }
}

function isValidRegex(pattern: string): boolean {
  try {
    assertValidRegex(pattern);
    return true;
  } catch {
    return false;
  }
}

export async function listRules(userId: string) {
  const rules = await categoryRuleRepository.findAllByUser(userId);
  // `isValid` lets the UI flag rules that auto-categorize would silently
  // skip — without persisting a per-rule health column.
  return rules.map((rule) => ({
    ...rule,
    isValid: rule.matchType !== "regex" || isValidRegex(rule.pattern),
  }));
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
  if (matchType === "regex") assertValidRegex(pattern);

  const category = await categoryRuleRepository.findCategoryForUser(categoryId, userId);
  if (!category) {
    throw new ServiceError(404, "Category not found");
  }

  let rule;
  try {
    rule = await categoryRuleRepository.create({
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

  // KAN-154: apply the new rule to existing uncategorized rows immediately so
  // the Transactions UI reflects the assignment without forcing the user to
  // open the Auto-categorize button. Best-effort — a failure here must not
  // roll back the rule itself, since the user can always retry manually.
  try {
    await autoCategorize(userId);
  } catch (err) {
    getLogger().warn({ err, userId, ruleId: rule.id }, "post-create auto-categorize failed");
  }

  return rule;
}

export async function updateRule(
  id: string,
  userId: string,
  data: { pattern?: string; matchType?: MatchType; categoryId?: string; priority?: number },
) {
  // Validate against the effective (matchType, pattern) pair so the regex
  // check still runs when only one of the two fields is in the patch.
  if (data.pattern != null || data.matchType != null) {
    const existing = await categoryRuleRepository.findById(id, userId);
    if (!existing) {
      throw new ServiceError(404, "Category rule not found");
    }
    const effectiveMatchType = data.matchType ?? existing.matchType;
    const effectivePattern = data.pattern ?? existing.pattern;
    if (effectiveMatchType === "regex") assertValidRegex(effectivePattern);
  }

  if (data.categoryId != null) {
    const category = await categoryRuleRepository.findCategoryForUser(data.categoryId, userId);
    if (!category) {
      throw new ServiceError(404, "Category not found");
    }
  }
  let rule;
  try {
    rule = await categoryRuleRepository.update(id, userId, data);
    if (!rule) {
      throw new ServiceError(404, "Category rule not found");
    }
  } catch (err) {
    if (err instanceof DuplicateRuleError) {
      throw new ServiceError(409, err.message);
    }
    throw err;
  }

  // KAN-154: a pattern or category change can newly match uncategorized rows,
  // so run auto-categorize as a best-effort follow-up. Mirrors createRule.
  try {
    await autoCategorize(userId);
  } catch (err) {
    getLogger().warn({ err, userId, ruleId: id }, "post-update auto-categorize failed");
  }

  return rule;
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
  if (rule.matchType === "regex") assertValidRegex(rule.pattern);

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
  // Defence-in-depth: the controller validates `minLength: 1`, but a stored
  // empty `contains` pattern would otherwise match every candidate via
  // `includes("")` and report false-positive overlaps.
  if (!ap || !bp) return false;
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
  return (
    all
      .filter((rule) => rule.id !== candidate.excludeRuleId)
      // Regex patterns are not literal strings; comparing them via includes()
      // produces both false positives ("a" in everything) and false negatives
      // ("^Coop$" not in "Coop"). Skip them in the literal-substring heuristic.
      .filter((rule) => rule.matchType !== "regex")
      .filter((rule) =>
        patternsOverlap(
          { pattern: candidate.pattern, matchType: candidate.matchType },
          { pattern: rule.pattern, matchType: rule.matchType },
        ),
      )
      .map((rule) => ({
        id: rule.id,
        pattern: rule.pattern,
        matchType: rule.matchType,
        priority: rule.priority,
        categoryId: rule.categoryId,
        categoryName: rule.category.categoryName,
      }))
  );
}
