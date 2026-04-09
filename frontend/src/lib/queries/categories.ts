import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export interface Category {
  id: string;
  categoryName: string;
  userId: string | null; // null for global categories
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES_QUERY_KEY = ["categories"] as const;

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: async () => {
      const response = await api.get<{ categories: Category[] }>("/categories");
      return response.categories;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
