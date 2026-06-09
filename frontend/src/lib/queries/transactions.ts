import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export interface Transaction {
  id: string;
  amount: string;
  date: string;
  accountId: string;
  merchantId: string;
  merchant: string;
  categoryId: string | null;
  categoryName: string | null;
}

export interface TransactionsResponse {
  data: Transaction[];
  meta: {
    totalCount: number;
    totalPages: number;
    page: number;
    limit: number;
  };
}

export interface TransactionsFilters {
  page?: number;
  limit?: number;
  sortBy?: "date" | "amount" | "merchant";
  sortOrder?: "asc" | "desc";
  startDate?: string | null | undefined;
  endDate?: string | null | undefined;
  categoryId?: string | null | undefined;
  accountId?: string | null | undefined;
  minAmount?: number;
  maxAmount?: number;
  search?: string | null | undefined;
}

export const transactionsQueryConfig = (filters: TransactionsFilters = {}) => ({
  queryKey: ["transactions", filters] as const,
  queryFn: async () => {
    const params = new URLSearchParams();
    if (filters.page != null) params.append("page", filters.page.toString());
    if (filters.limit != null) params.append("limit", filters.limit.toString());
    if (filters.sortBy) params.append("sortBy", filters.sortBy);
    if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);
    if (filters.startDate) params.append("startDate", filters.startDate);
    if (filters.endDate) params.append("endDate", filters.endDate);
    if (filters.categoryId) params.append("categoryId", filters.categoryId);
    if (filters.accountId) params.append("accountId", filters.accountId);
    if (filters.minAmount !== undefined) params.append("minAmount", filters.minAmount.toString());
    if (filters.maxAmount !== undefined) params.append("maxAmount", filters.maxAmount.toString());
    if (filters.search) params.append("search", filters.search);

    const queryString = params.toString();
    const url = `/transactions${queryString ? `?${queryString}` : ""}`;
    return api.get<TransactionsResponse>(url);
  },
  retry: 1,
  staleTime: 30 * 1000, // 30 seconds
});

export function useTransactions(filters: TransactionsFilters = {}) {
  return useQuery(transactionsQueryConfig(filters));
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      id: string;
      // `null` clears the category and restores the post-import
      // "uncategorized" state (KAN-156).
      categoryId?: string | null;
      notes?: string;
      date?: string;
      amount?: number;
      reason?: string;
    }) => {
      const { id, ...update } = data;
      return api.patch(`/transactions/${id}`, update);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      // Dashboard and budget aggregates depend on the transaction set.
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      // Reason travels in the request body, not the querystring, to keep
      // free-text out of Pino/reverse-proxy access logs.
      return api.delete(`/transactions/${id}`, reason ? { reason } : undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      // Dashboard and budget aggregates depend on the transaction set.
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}
