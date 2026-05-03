import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Link } from "react-router";
import { useDashboardTrends } from "../lib/queries/dashboard";
import { formatCurrency } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const LINK_CLASSES =
  "group col-span-1 sm:col-span-2 lg:col-span-3 block rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

const CARD_CLASSES =
  "cursor-pointer transition-all duration-200 group-hover:border-primary/50 group-hover:bg-accent/5 group-hover:shadow-md";

function ChartHeader() {
  return (
    <CardHeader>
      <CardTitle className="text-xs font-semibold uppercase tracking-wider">
        Monthly Spending Trend
      </CardTitle>
    </CardHeader>
  );
}

export function SpendingTrendChart() {
  const { data, isLoading, error } = useDashboardTrends();
  const chartData = Array.isArray(data) ? data : [];

  if (error) {
    return (
      <div className="col-span-1 sm:col-span-2 lg:col-span-3 rounded border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load spending trend data. Please try again.
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <Link to="/transactions" aria-label="View transactions" className={LINK_CLASSES}>
        <Card className={CARD_CLASSES}>
          <ChartHeader />
          <CardContent>
            <div className="flex min-h-64 items-center justify-center rounded bg-muted/30">
              <div className="text-sm text-muted-foreground">Loading chart…</div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <Link to="/transactions" aria-label="View transactions" className={LINK_CLASSES}>
      <Card className={CARD_CLASSES}>
        <ChartHeader />
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
    </Link>
  );
}
