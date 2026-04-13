import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/appStore";
import type { Budget } from "./budgets";

// Dashboard data changes infrequently — use a longer stale time than the global
// default (30s) to reduce unnecessary refetches when switching between pages.
const DASHBOARD_STALE_TIME = 5 * 60 * 1000; // 5 minutes

// Type definitions for API responses
export interface DashboardSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  transactionCount: number;
}

export interface TrendDataPoint {
  date: string; // YYYY-MM-DD
  amount: number;
}

interface MonthlyTrendPoint {
  year: number;
  month: number;
  income: number;
  expenses: number;
}

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  total: number;
}

export function toTrendDataPoints(data: MonthlyTrendPoint[]): TrendDataPoint[] {
  return data.map((point) => {
    const month = String(point.month).padStart(2, "0");
    return {
      date: `${point.year}-${month}-01`,
      amount: point.expenses,
    };
  });
}

// Re-export for consumers that import Budget from dashboard queries
export type { Budget };

// Dashboard Summary Hook
export function useDashboardSummary() {
  const startDate = useAppStore((s) => s.startDate);
  const endDate = useAppStore((s) => s.endDate);

  return useQuery({
    queryKey: ["dashboard", "summary", { startDate, endDate }] as const,
    queryFn: () => {
      const params = new URLSearchParams({ startDate, endDate });
      return api.get<DashboardSummary>(`/dashboard/summary?${params}`);
    },
    staleTime: DASHBOARD_STALE_TIME,
  });
}

// Monthly Trends Hook
export function useDashboardTrends() {
  const startDate = useAppStore((s) => s.startDate);
  const endDate = useAppStore((s) => s.endDate);

  return useQuery({
    queryKey: ["dashboard", "trends", { startDate, endDate }] as const,
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const { data } = await api.get<{ data: MonthlyTrendPoint[] }>(`/dashboard/trends?${params}`);
      return toTrendDataPoints(data);
    },
    staleTime: DASHBOARD_STALE_TIME,
  });
}

// Category Breakdown Hook
export function useDashboardCategories() {
  const startDate = useAppStore((s) => s.startDate);
  const endDate = useAppStore((s) => s.endDate);

  return useQuery({
    queryKey: ["dashboard", "categories", { startDate, endDate }] as const,
    queryFn: () => {
      const params = new URLSearchParams({ startDate, endDate });
      return api.get<CategoryBreakdown[]>(`/dashboard/categories?${params}`);
    },
    staleTime: DASHBOARD_STALE_TIME,
  });
}

// Budgets Hook
export function useDashboardBudgets() {
  return useQuery({
    queryKey: ["dashboard", "budgets"] as const,
    queryFn: async () => {
      const res = await api.get<{ budgets: Budget[] }>("/budgets");
      if (!Array.isArray(res.budgets)) {
        throw new Error("Unexpected response shape from /budgets endpoint");
      }
      return res.budgets;
    },
    staleTime: DASHBOARD_STALE_TIME,
  });
}
