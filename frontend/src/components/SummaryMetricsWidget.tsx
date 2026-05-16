import { Link } from "react-router";
import { useDashboardSummary } from "../lib/queries/dashboard";
import { formatAmount } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";

// SummaryMetricsWidget is a Link wrapping a 3-up grid of MetricCards.
// Unlike other dashboard tiles (Card-shaped), this one is a grid layout, so
// it does not use DashboardTileLink — but it shares the focus ring styling.

function MetricCard({
  title,
  value,
  isLoading,
}: {
  title: string;
  value: string | number;
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Card className="flex-1 transition-all duration-200 group-hover:border-primary/50 group-hover:shadow-md group-hover:bg-accent/5">
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
          {isLoading
            ? t("common.loading", "Loading…")
            : t("components.summaryMetricsWidget.fromSelectedPeriod", "From selected period")}
        </div>
      </CardContent>
    </Card>
  );
}

export function SummaryMetricsWidget() {
  const { data, isLoading, error } = useDashboardSummary();
  const { t } = useTranslation();

  if (error) {
    return (
      <div className="rounded border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        {t(
          "components.summaryMetricsWidget.error",
          "Failed to load summary data. Please try again.",
        )}
      </div>
    );
  }

  return (
    <Link
      to="/transactions"
      aria-label={t("components.summaryMetricsWidget.viewTransactionsAria", "View transactions")}
      className="group block rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          title={t("components.summaryMetricsWidget.netBalance", "Net Balance")}
          value={data ? formatAmount(data.netBalance, i18n.resolvedLanguage) : "—"}
          isLoading={isLoading}
        />
        <MetricCard
          title={t("components.summaryMetricsWidget.totalExpenses", "Total Expenses")}
          value={data ? formatAmount(Math.abs(data.totalExpenses), i18n.resolvedLanguage) : "—"}
          isLoading={isLoading}
        />
        <MetricCard
          title={t("components.summaryMetricsWidget.totalIncome", "Total Income")}
          value={data ? formatAmount(data.totalIncome, i18n.resolvedLanguage) : "—"}
          isLoading={isLoading}
        />
      </div>
    </Link>
  );
}
