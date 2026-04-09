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

interface MonthlyTrendPoint {
  year: number;
  month: number;
  income: number;
  expenses: number;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
}

function extractArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "data" in value &&
    Array.isArray((value as { data?: unknown }).data)
  ) {
    return (value as { data: T[] }).data;
  }

  return [];
}

function toTrendDataPoints(raw: unknown): TrendDataPoint[] {
  const data = extractArray<TrendDataPoint | MonthlyTrendPoint>(raw);

  return data
    .map((point) => {
      if ("date" in point && "amount" in point) {
        return {
          date: point.date,
          amount: Number(point.amount),
        };
      }

      if ("year" in point && "month" in point && "expenses" in point) {
        const month = String(point.month).padStart(2, "0");
        return {
          date: `${point.year}-${month}-01`,
          amount: Number(point.expenses),
        };
      }

      return null;
    })
    .filter((point): point is TrendDataPoint => point !== null);
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
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const response = await api.get<unknown>(`/dashboard/trends?${params}`);
      return toTrendDataPoints(response);
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
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const response = await api.get<unknown>(`/dashboard/categories?${params}`);
      return extractArray<CategoryBreakdown>(response);
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
