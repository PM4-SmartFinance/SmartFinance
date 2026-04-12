import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "react-router";
import { ApiError } from "../lib/api";
import { useDashboardCategories } from "../lib/queries/dashboard";
import { formatCurrency } from "../lib/utils";
import { Card, CardContent, CardHeader } from "./ui/card";

const categoryHeader = (
  <CardHeader>
    <Link
      to="/categories"
      className="text-xs font-semibold uppercase tracking-wider text-foreground hover:text-primary transition-colors"
    >
      Spending by Category
    </Link>
  </CardHeader>
);

export function CategoryBreakdownChart() {
  const { data, isLoading, error } = useDashboardCategories();
  const chartData = Array.isArray(data) ? data : [];
  const isNotFoundError = error instanceof ApiError && error.status === 404;

  if (error && !isNotFoundError) {
    return (
      <Card className="col-span-1 sm:col-span-2 lg:col-span-3">
        {categoryHeader}
        <CardContent>
          <div className="rounded border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load category breakdown data. Please try again.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="col-span-1 sm:col-span-2 lg:col-span-3">
        {categoryHeader}
        <CardContent>
          <div className="flex min-h-64 items-center justify-center rounded bg-muted/30">
            <div className="text-sm text-muted-foreground">Loading chart…</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isNotFoundError || chartData.length === 0) {
    return (
      <Card className="col-span-1 sm:col-span-2 lg:col-span-3">
        {categoryHeader}
        <CardContent>
          <div className="flex min-h-64 items-center justify-center rounded bg-muted/30 p-4 text-center">
            <div className="max-w-sm text-sm text-muted-foreground">
              No category breakdown yet. Import transactions or a CSV to see spending by category.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-1 sm:col-span-2 lg:col-span-3">
      {categoryHeader}
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 20 }}>
              <CartesianGrid stroke="hsl(var(--muted-foreground))" />
              <XAxis
                type="number"
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: "12px" }}
              />
              <YAxis
                dataKey="categoryName"
                type="category"
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: "12px" }}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "4px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value) => [formatCurrency(Number(value)), "Spent"]}
              />
              <Bar dataKey="total" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
