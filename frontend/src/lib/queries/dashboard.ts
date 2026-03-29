import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore, type AppState } from "@/store/appStore";

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

// Dashboard Summary Hook
export function useDashboardSummary() {
  const startDate = useAppStore((s: AppState) => s.startDate);
  const endDate = useAppStore((s: AppState) => s.endDate);

  return useQuery({
    queryKey: ["dashboard", "summary", { startDate, endDate }] as const,
    queryFn: () => {
      const params = new URLSearchParams({ startDate, endDate });
      return api.get<DashboardSummary>(`/dashboard/summary?${params}`);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Monthly Trends Hook
export function useDashboardTrends() {
  const startDate = useAppStore((s: AppState) => s.startDate);
  const endDate = useAppStore((s: AppState) => s.endDate);

  return useQuery({
    queryKey: ["dashboard", "trends", { startDate, endDate }] as const,
    queryFn: () => {
      const params = new URLSearchParams({ startDate, endDate });
      return api.get<TrendDataPoint[]>(`/dashboard/trends?${params}`);
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Category Breakdown Hook
export function useDashboardCategories() {
  const startDate = useAppStore((s: AppState) => s.startDate);
  const endDate = useAppStore((s: AppState) => s.endDate);

  return useQuery({
    queryKey: ["dashboard", "categories", { startDate, endDate }] as const,
    queryFn: () => {
      const params = new URLSearchParams({ startDate, endDate });
      return api.get<CategoryBreakdown[]>(`/dashboard/categories?${params}`);
    },
    staleTime: 5 * 60 * 1000,
  });
}
