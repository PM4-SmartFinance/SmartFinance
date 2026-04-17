import { Link } from "react-router";
import { useDashboardBudgets } from "../lib/queries/dashboard";
import type { Budget, BudgetType } from "../lib/queries/budgets";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function getBudgetStatus(percentageUsed: number): "on-track" | "approaching" | "exceeded" {
  if (percentageUsed >= 100) return "exceeded";
  if (percentageUsed >= 70) return "approaching";
  return "on-track";
}

/** Priority order: higher = more specific */
const TYPE_PRIORITY: Record<BudgetType, number> = {
  DAILY: 0,
  YEARLY: 1,
  MONTHLY: 1,
  SPECIFIC_YEAR: 2,
  SPECIFIC_MONTH: 2,
  SPECIFIC_MONTH_YEAR: 3,
};

/**
 * For each category, pick the most specific budget that is active
 * (i.e., whose time period includes the current date).
 */
function getMostSpecificBudgets(budgets: Budget[]): Budget[] {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Filter to budgets whose period covers "now"
  const activeBudgets = budgets.filter((b) => {
    switch (b.type) {
      case "DAILY":
      case "MONTHLY":
      case "YEARLY":
        return true; // general budgets are always active
      case "SPECIFIC_MONTH":
        return b.month === currentMonth;
      case "SPECIFIC_YEAR":
        return b.year === currentYear;
      case "SPECIFIC_MONTH_YEAR":
        return b.month === currentMonth && b.year === currentYear;
    }
  });

  // Group by category, keep highest priority
  const byCategory = new Map<string, Budget>();
  for (const b of activeBudgets) {
    const existing = byCategory.get(b.categoryId);
    if (!existing || TYPE_PRIORITY[b.type] > TYPE_PRIORITY[existing.type]) {
      byCategory.set(b.categoryId, b);
    }
  }

  return [...byCategory.values()];
}

export function BudgetWidget() {
  const { data, isLoading, error } = useDashboardBudgets();

  if (error) {
    return (
      <div className="rounded border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load budget data. Please try again.
      </div>
    );
  }

  if (isLoading) {
    return (
      <Link to="/budgets" className="block hover:opacity-90 transition-opacity">
        <Card className="cursor-pointer">
          <CardHeader>
            <CardTitle className="text-xs font-semibold uppercase tracking-wider">
              Budget Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  const activeBudgets = getMostSpecificBudgets(data ?? []);

  // Count budgets by status
  const statusCounts = activeBudgets.reduce(
    (acc, b) => {
      const status = getBudgetStatus(b.percentageUsed);
      acc[status] += 1;
      return acc;
    },
    { "on-track": 0, approaching: 0, exceeded: 0 },
  );

  return (
    <Link to="/budgets" className="block hover:opacity-90 transition-opacity">
      <Card className="cursor-pointer">
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wider">
            Budget Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeBudgets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active budgets. Click to create one.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {statusCounts["on-track"]} on track, {statusCounts["approaching"]} approaching
                limit, {statusCounts["exceeded"]} exceeded
              </p>
              <p className="text-xs text-muted-foreground">
                {activeBudgets.length} active budget
                {activeBudgets.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
