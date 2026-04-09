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

function unwrapArrayResponse<T>(response: T[] | { data: T[] }): T[] {
  if (Array.isArray(response)) {
    return response;
  }

  return response.data;
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
      return api
        .get<TrendDataPoint[] | { data: TrendDataPoint[] }>(`/dashboard/trends?${params}`)
        .then(unwrapArrayResponse);
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
      return api
        .get<CategoryBreakdown[] | { data: CategoryBreakdown[] }>(`/dashboard/categories?${params}`)
        .then(unwrapArrayResponse);
    },
    staleTime: DASHBOARD_STALE_TIME,
  });
}
