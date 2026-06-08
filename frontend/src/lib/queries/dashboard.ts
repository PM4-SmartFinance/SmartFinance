import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/appStore";
import type { Budget } from "./budgets";

// Dashboard data changes infrequently — use a longer stale time than the global
// default (30s) to reduce unnecessary refetches when switching between pages.
const DASHBOARD_STALE_TIME = 5 * 60 * 1000; // 5 minutes

// Query key for all dashboard-related queries
export const DASHBOARD_QUERY_KEY = ["dashboard"] as const;

// Type definitions for API responses
export interface DashboardSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  transactionCount: number;
}

/**
 * One day of aggregated income/expenses. Backend `/dashboard/trends` returns these
 * gap-filled across the entire selected range (a row per day, zero-filled where
 * no transactions occurred).
 */
export interface TrendDataPoint {
  date: string; // YYYY-MM-DD
  income: number;
  expenses: number;
}

export interface CategoryBreakdown {
  categoryId: string | null;
  categoryName: string;
  total: number;
  isUncategorized?: boolean;
}

// Re-export for consumers that import Budget from dashboard queries
export type { Budget };

// Dashboard Summary Hook
export function useDashboardSummary() {
  const startDate = useAppStore((s) => s.startDate);
  const endDate = useAppStore((s) => s.endDate);
  const accountId = useAppStore((s) => s.accountId);

  return useQuery({
    queryKey: ["dashboard", "summary", { startDate, endDate, accountId }] as const,
    queryFn: () => {
      const params = new URLSearchParams({ startDate, endDate });
      if (accountId) params.set("accountId", accountId);
      return api.get<DashboardSummary>(`/dashboard/summary?${params}`);
    },
    staleTime: DASHBOARD_STALE_TIME,
  });
}

// Daily Trends Hook — backend already gap-fills across the requested range.
export function useDashboardTrends() {
  const startDate = useAppStore((s) => s.startDate);
  const endDate = useAppStore((s) => s.endDate);
  const accountId = useAppStore((s) => s.accountId);

  return useQuery({
    queryKey: ["dashboard", "trends", { startDate, endDate, accountId }] as const,
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      if (accountId) params.set("accountId", accountId);
      const { data } = await api.get<{ data: TrendDataPoint[] }>(`/dashboard/trends?${params}`);
      return data;
    },
    staleTime: DASHBOARD_STALE_TIME,
  });
}

// Category Breakdown Hook
export function useDashboardCategories() {
  const startDate = useAppStore((s) => s.startDate);
  const endDate = useAppStore((s) => s.endDate);
  const accountId = useAppStore((s) => s.accountId);

  return useQuery({
    queryKey: ["dashboard", "categories", { startDate, endDate, accountId }] as const,
    queryFn: () => {
      const params = new URLSearchParams({ startDate, endDate });
      if (accountId) params.set("accountId", accountId);
      return api.get<CategoryBreakdown[]>(`/dashboard/categories?${params}`);
    },
    staleTime: DASHBOARD_STALE_TIME,
  });
}

// Budgets Hook — reuses the same query key as useBudgets for shared cache
export { useBudgets as useDashboardBudgets } from "./budgets";
