import { DuplicateRuleError, ServiceError } from "../errors.js";
import * as categoryRuleRepository from "../repositories/category-rule.repository.js";

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
  matchType: string,
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
  data: { pattern?: string; matchType?: string; categoryId?: string; priority?: number },
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
