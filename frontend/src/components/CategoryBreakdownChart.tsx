import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "react-router";
import { ApiError } from "../lib/api";
import { useDashboardCategories } from "../lib/queries/dashboard";
import { formatCurrency } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const LINK_CLASSES =
  "group col-span-1 sm:col-span-2 lg:col-span-3 block rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

const CARD_CLASSES =
  "cursor-pointer transition-all duration-200 group-hover:border-primary/50 group-hover:bg-accent/5 group-hover:shadow-md";

function CategoryHeader() {
  return (
    <CardHeader>
      <CardTitle className="text-xs font-semibold uppercase tracking-wider">
        Spending by Category
      </CardTitle>
    </CardHeader>
  );
}

export function CategoryBreakdownChart() {
  const { data, isLoading, error } = useDashboardCategories();
  const chartData = Array.isArray(data) ? data : [];
  const isNotFoundError = error instanceof ApiError && error.status === 404;

  if (error && !isNotFoundError) {
    return (
      <div className="col-span-1 sm:col-span-2 lg:col-span-3 rounded border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load category breakdown data. Please try again.
      </div>
    );
  }

  if (isLoading) {
    return (
      <Link to="/categories" aria-label="View categories" className={LINK_CLASSES}>
        <Card className={CARD_CLASSES}>
          <CategoryHeader />
          <CardContent>
            <div className="flex min-h-64 items-center justify-center rounded bg-muted/30">
              <div className="text-sm text-muted-foreground">Loading chart…</div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  if (isNotFoundError || chartData.length === 0) {
    return (
      <Link to="/categories" aria-label="View categories" className={LINK_CLASSES}>
        <Card className={CARD_CLASSES}>
          <CategoryHeader />
          <CardContent>
            <div className="flex min-h-64 items-center justify-center rounded bg-muted/30 p-4 text-center">
              <div className="max-w-sm text-sm text-muted-foreground">
                No category breakdown yet. Import transactions or a CSV to see spending by category.
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <Link to="/categories" aria-label="View categories" className={LINK_CLASSES}>
      <Card className={CARD_CLASSES}>
        <CategoryHeader />
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
    </Link>
  );
}
