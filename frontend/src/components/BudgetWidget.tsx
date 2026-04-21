import { Link } from "react-router";
import { useDashboardBudgets } from "../lib/queries/dashboard";
import type { Budget } from "../lib/queries/budgets";
import { getMostSpecificActiveBudget } from "../lib/queries/budgets";
import { getBudgetStatus } from "./budgetUtils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

/**
 * For each category, pick the most specific active budget.
 */
function getMostSpecificBudgets(budgets: Budget[]): Budget[] {
  const byCategory = new Map<string, Budget[]>();
  for (const b of budgets) {
    const list = byCategory.get(b.categoryId) ?? [];
    list.push(b);
    byCategory.set(b.categoryId, list);
  }

  const result: Budget[] = [];
  for (const categoryBudgets of byCategory.values()) {
    const best = getMostSpecificActiveBudget(categoryBudgets);
    if (best) result.push(best);
  }
  return result;
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
      <Link to="/budgets" className="group block transition-all">
        <Card className="cursor-pointer transition-all duration-200 hover:border-primary/50 hover:shadow-md group-hover:bg-accent/5">
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
    <Link to="/budgets" className="group block transition-all">
      <Card className="cursor-pointer transition-all duration-200 hover:border-primary/50 hover:shadow-md group-hover:bg-accent/5">
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
