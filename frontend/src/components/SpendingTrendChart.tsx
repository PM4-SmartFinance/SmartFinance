import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useDashboardTrends } from "../lib/queries/dashboard";
import { formatCurrency } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

/** Format date string (YYYY-MM-DD) to readable month label (Jan 2026) */
function formatMonthLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Format Y-axis currency values */
function formatYAxisValue(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${Math.round(value)}`;
}

export function SpendingTrendChart() {
  const { data, isLoading, error } = useDashboardTrends();
  const chartData = Array.isArray(data) ? data : [];
  const hasData = chartData.length > 0;

  if (error) {
    return (
      <Card className="col-span-1 sm:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wider">
            Monthly Spending Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load spending trend data. Please try again.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <Card className="col-span-1 sm:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wider">
            Monthly Spending Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-80 items-center justify-center rounded bg-muted/30">
            <div className="text-sm text-muted-foreground">Loading chart…</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Handle edge case: no data for selected period
  if (!hasData) {
    return (
      <Card className="col-span-1 sm:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wider">
            Monthly Spending Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-80 items-center justify-center rounded bg-muted/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No spending data available for the selected period. Import transactions to see your
              trends.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-1 sm:col-span-2 lg:col-span-3">
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wider">
          Monthly Spending Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: -20, bottom: 8 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--muted-foreground) / 0.2)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatMonthLabel}
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: "13px" }}
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis
                tickFormatter={formatYAxisValue}
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: "13px" }}
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                labelFormatter={(label) => formatMonthLabel(String(label))}
                formatter={(value) => [formatCurrency(Number(value)), "Monthly Spending"]}
                cursor={{ stroke: "hsl(var(--primary) / 0.2)" }}
              />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={{ fill: "hsl(var(--primary))", r: 5, strokeWidth: 0 }}
                activeDot={{ r: 7, strokeWidth: 0 }}
                isAnimationActive={true}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          {chartData.length === 1 ? (
            <p>Showing data for 1 month. Add more transactions to see trends over time.</p>
          ) : (
            <p>
              Showing spending trend for {chartData.length} month{chartData.length !== 1 ? "s" : ""}
              .
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
