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

export function SpendingTrendChart() {
  const { data, isLoading, error } = useDashboardTrends();
  const chartData = Array.isArray(data) ? data : [];

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
          <div className="flex min-h-64 items-center justify-center rounded bg-muted/30">
            <div className="text-sm text-muted-foreground">Loading chart…</div>
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
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: "12px" }}
              />
              <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "4px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value) => [formatCurrency(Number(value)), "Spending"]}
              />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
