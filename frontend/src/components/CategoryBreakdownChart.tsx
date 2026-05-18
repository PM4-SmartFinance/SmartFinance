import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ApiError } from "../lib/api";
import { useDashboardCategories } from "../lib/queries/dashboard";
import { formatAmount } from "@/lib/format";
import { CardContent, CardHeader, CardTitle } from "./ui/card";
import { DashboardTileLink } from "./DashboardTileLink";
import { useTranslation } from "react-i18next";

function CategoryHeader() {
  const { t } = useTranslation();
  return (
    <CardHeader>
      <CardTitle className="text-xs font-semibold uppercase tracking-wider">
        {t("components.categoryBreakdownChart.title", "Spending by Category")}
      </CardTitle>
    </CardHeader>
  );
}

export function CategoryBreakdownChart() {
  const { data, isLoading, error } = useDashboardCategories();
  const chartData = Array.isArray(data) ? data : [];
  const isNotFoundError = error instanceof ApiError && error.status === 404;
  // Show the empty-state copy only when there is genuinely nothing to plot —
  // i.e. no rows or every row is a zero-spend category with no Uncategorized
  // bucket. Once any spend exists (categorized or not), render the chart.
  const hasAnySpend = chartData.some((row) => row.total > 0);
  const { t, i18n } = useTranslation();

  if (error && !isNotFoundError) {
    return (
      <div className="col-span-1 sm:col-span-2 lg:col-span-3 rounded border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        {t(
          "components.categoryBreakdownChart.error",
          "Failed to load category breakdown data. Please try again.",
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <DashboardTileLink
        to="/categories"
        ariaLabel={t("components.categoryBreakdownChart.viewCategoriesAria", "View categories")}
      >
        <CategoryHeader />
        <CardContent>
          <div className="flex min-h-64 items-center justify-center rounded bg-muted/30">
            <div className="text-sm text-muted-foreground">
              {t("components.categoryBreakdownChart.loading", "Loading chart…")}
            </div>
          </div>
        </CardContent>
      </DashboardTileLink>
    );
  }

  if (isNotFoundError || chartData.length === 0 || !hasAnySpend) {
    return (
      <DashboardTileLink
        to="/categories"
        ariaLabel={t("components.categoryBreakdownChart.viewCategoriesAria", "View categories")}
      >
        <CategoryHeader />
        <CardContent>
          <div className="flex min-h-64 items-center justify-center rounded bg-muted/30 p-4 text-center">
            <div className="max-w-sm text-sm text-muted-foreground">
              {t(
                "components.categoryBreakdownChart.empty",
                "No category breakdown yet. Import transactions or a CSV to see spending by category.",
              )}
            </div>
          </div>
        </CardContent>
      </DashboardTileLink>
    );
  }

  return (
    <DashboardTileLink
      to="/categories"
      ariaLabel={t("components.categoryBreakdownChart.viewCategoriesAria", "View categories")}
    >
      <CategoryHeader />
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 20 }}>
              <CartesianGrid stroke="var(--border)" />
              <XAxis
                type="number"
                stroke="var(--border)"
                tick={{ fill: "var(--foreground)" }}
                style={{ fontSize: "12px" }}
              />
              <YAxis
                dataKey="categoryName"
                type="category"
                stroke="var(--border)"
                tick={{ fill: "var(--foreground)" }}
                style={{ fontSize: "12px" }}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                }}
                labelStyle={{ color: "var(--foreground)" }}
                formatter={(value) => [
                  formatAmount(Number(value), i18n.resolvedLanguage),
                  t("components.categoryBreakdownChart.tooltipSpent", "Spent"),
                ]}
              />
              <Bar dataKey="total">
                {chartData.map((row) => (
                  <Cell
                    key={row.categoryId ?? "uncategorized"}
                    fill={row.isUncategorized ? "var(--muted-foreground)" : "var(--primary)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </DashboardTileLink>
  );
}
