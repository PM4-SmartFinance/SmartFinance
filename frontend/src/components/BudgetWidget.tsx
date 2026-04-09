import { Link } from "react-router";
import { useDashboardBudgets } from "../lib/queries/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function getBudgetStatus(percentageUsed: number): "on-track" | "approaching" | "exceeded" {
  if (percentageUsed >= 100) return "exceeded";
  if (percentageUsed >= 70) return "approaching";
  return "on-track";
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

  // Get current month and year
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Filter budgets for current month
  const currentMonthBudgets =
    data?.filter((b) => b.month === currentMonth && b.year === currentYear) || [];

  // Count budgets by status
  const statusCounts = currentMonthBudgets.reduce(
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
          {currentMonthBudgets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No budgets set for {currentMonth}/{currentYear}. Click to create one.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {statusCounts["on-track"]} on track, {statusCounts["approaching"]} approaching
                limit, {statusCounts["exceeded"]} exceeded
              </p>
              <p className="text-xs text-muted-foreground">
                {currentMonthBudgets.length} active budget
                {currentMonthBudgets.length !== 1 ? "s" : ""} for {currentMonth}/{currentYear}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );

  // NOTE: Future enhancement (next sprint) — detailed granular view can be added here
  // by creating a separate BudgetDetailedWidget component that shows individual
  // budget cards, spending breakdown, and progress bars. Both would use the same
  // useDashboardBudgets() hook and getBudgetStatus() helper for consistency.
}
