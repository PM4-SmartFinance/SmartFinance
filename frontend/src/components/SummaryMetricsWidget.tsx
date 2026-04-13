import { useDashboardSummary } from "../lib/queries/dashboard";
import { formatCurrency } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

function MetricCard({
  title,
  value,
  isLoading,
}: {
  title: string;
  value: string | number;
  isLoading: boolean;
}) {
  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading ? (
          <div className="h-8 w-20 animate-pulse rounded bg-muted" />
        ) : (
          <div className="text-3xl font-bold">{value}</div>
        )}
        <div className="text-xs text-muted-foreground">
          {isLoading ? "Loading…" : "From selected period"}
        </div>
      </CardContent>
    </Card>
  );
}

export function SummaryMetricsWidget() {
  const { data, isLoading, error } = useDashboardSummary();

  if (error) {
    return (
      <div className="rounded border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load summary data. Please try again.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <MetricCard
        title="Net Balance"
        value={data ? formatCurrency(data.netBalance) : "—"}
        isLoading={isLoading}
      />
      <MetricCard
        title="Total Expenses"
        value={data ? formatCurrency(Math.abs(data.totalExpenses)) : "—"}
        isLoading={isLoading}
      />
      <MetricCard
        title="Total Income"
        value={data ? formatCurrency(data.totalIncome) : "—"}
        isLoading={isLoading}
      />
    </div>
  );
}
