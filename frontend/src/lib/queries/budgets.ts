import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export type BudgetType =
  | "DAILY"
  | "MONTHLY"
  | "YEARLY"
  | "SPECIFIC_MONTH"
  | "SPECIFIC_YEAR"
  | "SPECIFIC_MONTH_YEAR";

export type PeriodFilter = "DAILY" | "MONTHLY" | "YEARLY" | "DATE_RANGE";

export interface Budget {
  id: string;
  categoryId: string;
  type: BudgetType;
  month: number;
  year: number;
  limitAmount: string;
  /** DB soft-delete flag — whether this budget record is enabled */
  active: boolean;
  /** Computed by backend: whether this budget's time period includes the current date */
  isActive: boolean;
  /** Computed by backend: specificity rank (higher = more specific type) */
  priority: number;
  currentSpending: string;
  percentageUsed: number;
  remainingAmount: string;
  isOverBudget: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategorySpending {
  categoryId: string;
  spending: string;
  /** Budget limit scaled to the view period (null only if no budget exists) */
  scaledLimit: string | null;
  sourceBudgetType: BudgetType | null;
}

export interface CreateBudgetInput {
  categoryId: string;
  type: BudgetType;
  limitAmount: number;
  month?: number;
  year?: number;
}

export interface UpdateBudgetInput {
  limitAmount?: number;
  categoryId?: string;
  type?: BudgetType;
  month?: number;
  year?: number;
  active?: boolean;
}

export interface BudgetsParams {
  period?: PeriodFilter;
  startDate?: string;
  endDate?: string;
}

interface BudgetsResponse {
  budgets: Budget[];
  categorySpending?: CategorySpending[];
}

const BUDGETS_KEY_PREFIX = ["budgets"] as const;

export function useBudgets(params?: BudgetsParams) {
  return useQuery({
    queryKey: [...BUDGETS_KEY_PREFIX, params ?? {}] as const,
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.period) searchParams.set("period", params.period);
      if (params?.startDate) searchParams.set("startDate", params.startDate);
      if (params?.endDate) searchParams.set("endDate", params.endDate);
      const qs = searchParams.toString();
      const url = qs ? `/budgets?${qs}` : "/budgets";
      return api.get<BudgetsResponse>(url);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBudgetInput) => api.post<{ budget: Budget }>("/budgets", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUDGETS_KEY_PREFIX });
    },
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBudgetInput }) =>
      api.patch<{ budget: Budget }>(`/budgets/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUDGETS_KEY_PREFIX });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/budgets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUDGETS_KEY_PREFIX });
    },
  });
}

/** Pick the single most specific active budget from a list (highest priority wins).
 *  Skips budgets where `active` (DB flag) is false or `isActive` (time-based) is false. */
export function getMostSpecificActiveBudget(budgets: Budget[]): Budget | null {
  let best: Budget | null = null;
  for (const b of budgets) {
    if (!b.active || !b.isActive) continue;
    if (!best || b.priority > best.priority) {
      best = b;
    }
  }
  return best;
}

/** Human-readable label for a budget type + month/year combo */
export function getBudgetTypeLabel(type: BudgetType, month: number, year: number): string {
  switch (type) {
    case "DAILY":
      return "Daily Budget";
    case "MONTHLY":
      return "Monthly Budget";
    case "YEARLY":
      return "Yearly Budget";
    case "SPECIFIC_MONTH": {
      const name = new Date(2000, month - 1).toLocaleDateString("en-US", { month: "long" });
      return `${name} (recurring)`;
    }
    case "SPECIFIC_YEAR":
      return `${year}`;
    case "SPECIFIC_MONTH_YEAR": {
      const name = new Date(year, month - 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      return name;
    }
  }
}
