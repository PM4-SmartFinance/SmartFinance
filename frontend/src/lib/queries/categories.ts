import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { DASHBOARD_QUERY_KEY } from "./dashboard";

export interface Category {
  id: string;
  categoryName: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryRule {
  id: string;
  userId: string;
  categoryId: string;
  pattern: string;
  matchType: "exact" | "contains" | "regex";
  priority: number;
  createdAt: string;
  updatedAt: string;
  isValid: boolean;
}

export interface RuleDraft {
  pattern: string;
  matchType: "exact" | "contains" | "regex";
  categoryId: string;
  priority: number;
}

const CATEGORIES_QUERY_KEY = ["categories"] as const;
const CATEGORY_RULES_QUERY_KEY = ["category-rules"] as const;

export interface CategoryMutationOptions {
  onInvalidationFailure?: (failedKeys: readonly (readonly unknown[])[]) => void;
}

async function invalidateAll(
  queryClient: ReturnType<typeof useQueryClient>,
  keys: readonly (readonly unknown[])[],
  onInvalidationFailure?: CategoryMutationOptions["onInvalidationFailure"],
) {
  const results = await Promise.allSettled(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
  const failed: (readonly unknown[])[] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      const key = keys[i]!;
      failed.push(key);
      console.error(
        `Category mutation: failed to invalidate query '${key.join("/")}' after success`,
        r.reason,
      );
    }
  });
  if (failed.length > 0) onInvalidationFailure?.(failed);
}

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: async () => {
      const response = await api.get<{ categories: Category[] }>("/categories");
      if (!Array.isArray(response.categories)) {
        throw new Error("Unexpected response shape from /categories endpoint");
      }
      return response.categories;
    },
    staleTime: 60_000,
  });
}

export function useCategoryRules() {
  return useQuery({
    queryKey: CATEGORY_RULES_QUERY_KEY,
    queryFn: async () => {
      const response = await api.get<{ rules: CategoryRule[] }>("/category-rules");
      if (!Array.isArray(response.rules)) {
        throw new Error("Unexpected response shape from /category-rules endpoint");
      }
      return response.rules;
    },
    staleTime: 60_000,
  });
}

export function useCreateCategory(options?: CategoryMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryName: string) =>
      api.post<{ category: Category }>("/categories", { categoryName }),
    onSuccess: () =>
      invalidateAll(
        queryClient,
        [CATEGORIES_QUERY_KEY, DASHBOARD_QUERY_KEY],
        options?.onInvalidationFailure,
      ),
  });
}

export function useUpdateCategory(options?: CategoryMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, categoryName }: { id: string; categoryName: string }) =>
      api.patch<{ category: Category }>(`/categories/${id}`, { categoryName }),
    onSuccess: () =>
      invalidateAll(
        queryClient,
        [CATEGORIES_QUERY_KEY, CATEGORY_RULES_QUERY_KEY, DASHBOARD_QUERY_KEY],
        options?.onInvalidationFailure,
      ),
  });
}

export function useDeleteCategory(options?: CategoryMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () =>
      invalidateAll(
        queryClient,
        [CATEGORIES_QUERY_KEY, CATEGORY_RULES_QUERY_KEY, DASHBOARD_QUERY_KEY],
        options?.onInvalidationFailure,
      ),
  });
}

export function useCreateCategoryRule(options?: CategoryMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (draft: RuleDraft) => api.post<{ rule: CategoryRule }>("/category-rules", draft),
    // KAN-154: creating a rule retroactively categorizes uncategorized
    // transactions on the backend, so the transactions cache must be
    // invalidated for the Transactions page to reflect the new assignments.
    onSuccess: () =>
      invalidateAll(
        queryClient,
        [CATEGORY_RULES_QUERY_KEY, DASHBOARD_QUERY_KEY, ["transactions"]],
        options?.onInvalidationFailure,
      ),
  });
}

export function useUpdateCategoryRule(options?: CategoryMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: Partial<RuleDraft> }) =>
      api.patch<{ rule: CategoryRule }>(`/category-rules/${id}`, draft),
    // KAN-154: updating a rule's pattern/category re-runs auto-categorize
    // server-side; mirror the invalidation set from useCreateCategoryRule.
    onSuccess: () =>
      invalidateAll(
        queryClient,
        [CATEGORY_RULES_QUERY_KEY, DASHBOARD_QUERY_KEY, ["transactions"]],
        options?.onInvalidationFailure,
      ),
  });
}

export function useDeleteCategoryRule(options?: CategoryMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/category-rules/${id}`),
    onSuccess: () =>
      invalidateAll(
        queryClient,
        [CATEGORY_RULES_QUERY_KEY, DASHBOARD_QUERY_KEY],
        options?.onInvalidationFailure,
      ),
  });
}

export interface RuleConflict {
  id: string;
  pattern: string;
  matchType: "exact" | "contains" | "regex";
  priority: number;
  categoryId: string;
  categoryName: string;
}

export function useRuleOverlap(
  pattern: string,
  matchType: "exact" | "contains" | "regex",
  excludeRuleId?: string,
) {
  const trimmed = pattern.trim();
  return useQuery<RuleConflict[]>({
    queryKey: [
      "category-rules",
      "overlap",
      { pattern: trimmed, matchType, excludeRuleId },
    ] as const,
    queryFn: async () => {
      // matchType is narrowed by `enabled` below — never "regex" here.
      const params = new URLSearchParams({ pattern: trimmed, matchType });
      if (excludeRuleId) params.set("excludeRuleId", excludeRuleId);
      const response = await api.get<{ conflicts: RuleConflict[] }>(
        `/category-rules/overlap?${params}`,
      );
      return response.conflicts;
    },
    // The overlap endpoint rejects regex patterns (no useful literal-substring
    // comparison). Skip the call entirely instead of letting it 400.
    enabled: trimmed.length > 0 && matchType !== "regex",
    staleTime: 5_000,
  });
}

export function useAutoCategorize(options?: CategoryMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api.post<{ categorized: number }>("/transactions/auto-categorize", null as never),
    onSuccess: () =>
      invalidateAll(
        queryClient,
        [["transactions"], DASHBOARD_QUERY_KEY],
        options?.onInvalidationFailure,
      ),
  });
}

export function useRecategorizeRange(options?: CategoryMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (range: { startDate: string; endDate: string }) =>
      api.post<{ recategorized: number }>("/transactions/recategorize", range),
    onSuccess: () =>
      invalidateAll(
        queryClient,
        [["transactions"], DASHBOARD_QUERY_KEY],
        options?.onInvalidationFailure,
      ),
  });
}

// KAN-156: bulk-clear category from every transaction in a personal category
// so the user can subsequently delete the category or rerun auto-categorize.
export function useUncategorizeCategoryTransactions(options?: CategoryMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryId: string) =>
      api.post<{ uncategorized: number }>(
        `/categories/${categoryId}/uncategorize-transactions`,
        null as never,
      ),
    onSuccess: () =>
      invalidateAll(
        queryClient,
        [["transactions"], DASHBOARD_QUERY_KEY],
        options?.onInvalidationFailure,
      ),
  });
}
