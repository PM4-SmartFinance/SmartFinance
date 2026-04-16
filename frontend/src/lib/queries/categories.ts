import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export interface Category {
  id: string;
  categoryName: string;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryRule {
  id: string;
  userId: string;
  categoryId: string;
  pattern: string;
  matchType: "exact" | "contains";
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface RuleDraft {
  pattern: string;
  matchType: "exact" | "contains";
  categoryId: string;
  priority: number;
}

const CATEGORIES_QUERY_KEY = ["categories"] as const;
const CATEGORY_RULES_QUERY_KEY = ["category-rules"] as const;

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

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryName: string) =>
      api.post<{ category: Category }>("/categories", { categoryName }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, categoryName }: { id: string; categoryName: string }) =>
      api.patch<{ category: Category }>(`/categories/${id}`, { categoryName }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: CATEGORY_RULES_QUERY_KEY });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: CATEGORY_RULES_QUERY_KEY });
    },
  });
}

export function useCreateCategoryRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (draft: RuleDraft) => api.post<{ rule: CategoryRule }>("/category-rules", draft),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CATEGORY_RULES_QUERY_KEY });
    },
  });
}

export function useUpdateCategoryRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: Partial<RuleDraft> }) =>
      api.patch<{ rule: CategoryRule }>(`/category-rules/${id}`, draft),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CATEGORY_RULES_QUERY_KEY });
    },
  });
}

export function useDeleteCategoryRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/category-rules/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CATEGORY_RULES_QUERY_KEY });
    },
  });
}

export function useRuleMatchPreview() {
  return useMutation({
    mutationFn: (draft: RuleDraft) =>
      api.post<{
        matchCount: number;
        matchedTransactions: Array<{
          id: string;
          merchantName: string;
          amount: number;
          dateId: number;
        }>;
      }>("/category-rules/preview", draft),
  });
}
