import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/appStore";

// Dashboard data changes infrequently — use a longer stale time than the global
// default (30s) to reduce unnecessary refetches when switching between pages.
const DASHBOARD_STALE_TIME = 5 * 60 * 1000; // 5 minutes

// Type definitions for API responses
export interface DashboardSummary {
  accountBalance: number;
  monthlyExpenses: number;
  incomeThisMonth: number;
}

export interface TrendDataPoint {
  date: string; // YYYY-MM-DD
  amount: number;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
}

export interface Budget {
  id: string;
  categoryId: string;
  month: number;
  year: number;
  limitAmount: string; // Returned as string from API for precision
  currentSpending: string;
  percentageUsed: number;
  remainingAmount: string;
  isOverBudget: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

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
    queryFn: () => {
      const params = new URLSearchParams({ startDate, endDate });
      return api.get<TrendDataPoint[]>(`/dashboard/trends?${params}`);
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
    queryFn: () => api.get<{ budgets: Budget[] }>("/budgets").then((res) => res.budgets),
    staleTime: DASHBOARD_STALE_TIME,
  });
}
