import { useQuery } from "@tanstack/react-query";
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
  minAmount?: number;
  maxAmount?: number;
}

const TRANSACTIONS_QUERY_KEY = ["transactions"] as const;

export const transactionsQueryConfig = (filters: TransactionsFilters = {}) => ({
  queryKey: [TRANSACTIONS_QUERY_KEY, filters] as const,
  queryFn: async () => {
    const params = new URLSearchParams();
    if (filters.page) params.append("page", filters.page.toString());
    if (filters.limit) params.append("limit", filters.limit.toString());
    if (filters.sortBy) params.append("sortBy", filters.sortBy);
    if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);
    if (filters.startDate) params.append("startDate", filters.startDate);
    if (filters.endDate) params.append("endDate", filters.endDate);
    if (filters.categoryId) params.append("categoryId", filters.categoryId);
    if (filters.minAmount !== undefined) params.append("minAmount", filters.minAmount.toString());
    if (filters.maxAmount !== undefined) params.append("maxAmount", filters.maxAmount.toString());

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
