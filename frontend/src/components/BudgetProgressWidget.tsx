import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useBudgets, type CategorySpending } from "../lib/queries/budgets";
import { formatAmount } from "@/lib/format";
import { CardContent, CardHeader, CardTitle } from "./ui/card";
import { DashboardTileLink } from "./DashboardTileLink";
import { useTranslation } from "react-i18next";

// A single donut per period shows budget consumption: how much of the tracked
// total is spent, what remains, and any overspend. Per-category breakdown lives
// in the dedicated Spending-by-Category widget, so it is intentionally not
// duplicated here. Theme tokens (oklch) resolve at paint time for light/dark.
const SEGMENT_COLORS = {
  spent: "var(--primary)",
  remaining: "var(--muted)",
  over: "var(--destructive)",
} as const;

interface PeriodSnapshot {
  label: string;
  totalLimit: number;
  totalSpent: number;
  spentWithinLimit: number;
  remaining: number;
  overBudget: number;
  hasInvalidValue: boolean;
}

function toNumber(value: string | null): number | null {
  if (value == null) return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function buildSnapshot(
  label: string,
  categorySpending: CategorySpending[] | undefined,
): PeriodSnapshot {
  const tracked = (categorySpending ?? []).filter((c) => c.scaledLimit !== null);

  let hasInvalidValue = false;
  let totalLimit = 0;
  let totalSpent = 0;

  for (const c of tracked) {
    const limit = toNumber(c.scaledLimit);
    const spending = toNumber(c.spending);
    if (limit === null || spending === null) {
      hasInvalidValue = true;
      continue;
    }
    totalLimit += limit;
    totalSpent += spending;
  }

  return {
    label,
    totalLimit,
    totalSpent,
    spentWithinLimit: Math.min(totalSpent, totalLimit),
    remaining: Math.max(totalLimit - totalSpent, 0),
    overBudget: Math.max(totalSpent - totalLimit, 0),
    hasInvalidValue,
  };
}

export function BudgetProgressWidget() {
  const daily = useBudgets({ period: "DAILY" });
  const monthly = useBudgets({ period: "MONTHLY" });
  const yearly = useBudgets({ period: "YEARLY" });
  const { t, i18n } = useTranslation();

  const periodErrors = useMemo(
    () =>
      [
        { label: t("budgets.periods.daily", "Daily"), error: daily.error },
        { label: t("budgets.periods.monthly", "Monthly"), error: monthly.error },
        { label: t("budgets.periods.yearly", "Yearly"), error: yearly.error },
      ].filter((entry) => entry.error != null),
    [daily.error, monthly.error, yearly.error, t],
  );

  const isLoading = daily.isLoading || monthly.isLoading || yearly.isLoading;
  const error = periodErrors[0]?.error;

  const snapshots = useMemo(
    () => [
      buildSnapshot(t("budgets.periods.daily", "Daily"), daily.data?.categorySpending),
      buildSnapshot(t("budgets.periods.monthly", "Monthly"), monthly.data?.categorySpending),
      buildSnapshot(t("budgets.periods.yearly", "Yearly"), yearly.data?.categorySpending),
    ],
    [
      daily.data?.categorySpending,
      monthly.data?.categorySpending,
      yearly.data?.categorySpending,
      t,
    ],
  );

  const hasInvalidData = snapshots.some((s) => s.hasInvalidValue);

  if (error) {
    return (
      <DashboardTileLink
        to="/budgets"
        ariaLabel={t("components.budgetProgress.viewAll", "View all budgets")}
        linkClassName="block"
      >
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wider">
            {t("components.budgetProgress.title", "Budget Progress")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {t(
              "components.budgetProgress.error",
              "Failed to load budget progress. Please try again.",
            )}
          </div>
        </CardContent>
      </DashboardTileLink>
    );
  }

  if (isLoading) {
    return (
      <DashboardTileLink
        to="/budgets"
        ariaLabel={t("components.budgetProgress.viewAll", "View all budgets")}
        linkClassName="block"
      >
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wider">
            {t("components.budgetProgress.title", "Budget Progress")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-72 items-center justify-center rounded bg-muted/30">
            <p className="text-sm text-muted-foreground">
              {t("components.budgetProgress.loading", "Loading budget progress...")}
            </p>
          </div>
        </CardContent>
      </DashboardTileLink>
    );
  }

  const hasTrackedBudgets = snapshots.some((s) => s.totalLimit > 0);

  if (!hasTrackedBudgets) {
    return (
      <DashboardTileLink
        to="/budgets"
        ariaLabel={t("components.budgetProgress.viewAll", "View all budgets")}
        linkClassName="block"
      >
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wider">
            {t("components.budgetProgress.title", "Budget Progress")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-72 flex-col items-center justify-center gap-2 rounded bg-muted/30 px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {hasInvalidData
                ? t(
                    "components.budgetProgress.parseError",
                    "Some budget values could not be parsed. Please refresh — if the problem persists, contact support.",
                  )
                : t(
                    "components.budgetProgress.empty",
                    "No tracked budget totals yet. Create budgets and import transactions to populate these charts.",
                  )}
            </p>
          </div>
        </CardContent>
      </DashboardTileLink>
    );
  }

  return (
    <DashboardTileLink
      to="/budgets"
      ariaLabel={t("components.budgetProgress.viewAll", "View all budgets")}
      linkClassName="block"
    >
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wider">
          {t("components.budgetProgress.title", "Budget Progress")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasInvalidData && (
          <p
            role="alert"
            className="mb-4 rounded border border-destructive bg-destructive/10 p-2 text-xs text-destructive"
          >
            {t(
              "components.budgetProgress.excludedWarning",
              "Some budget values could not be parsed and were excluded from the totals below.",
            )}
          </p>
        )}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {snapshots.map((snapshot) => {
            const lng = i18n.resolvedLanguage;

            const segments = [
              {
                key: "spent",
                label: t("components.budgetProgress.chart.spent", "Spent"),
                value: snapshot.spentWithinLimit,
                amount: snapshot.totalSpent,
                fill: SEGMENT_COLORS.spent,
                emphasis: false,
              },
              {
                key: "remaining",
                label: t("components.budgetProgress.chart.remaining", "Remaining"),
                value: snapshot.remaining,
                amount: snapshot.remaining,
                fill: SEGMENT_COLORS.remaining,
                emphasis: false,
              },
              ...(snapshot.overBudget > 0
                ? [
                    {
                      key: "over",
                      label: t("components.budgetProgress.chart.over", "Over"),
                      value: snapshot.overBudget,
                      amount: snapshot.overBudget,
                      fill: SEGMENT_COLORS.over,
                      emphasis: true,
                    },
                  ]
                : []),
            ];
            const chartData = segments.filter((s) => s.value > 0);

            const overPart =
              snapshot.overBudget > 0
                ? t("components.budgetProgress.aria.over", " Over budget by {{amount}}.", {
                    amount: formatAmount(snapshot.overBudget, lng),
                  })
                : "";
            const chartAriaLabel = t(
              "components.budgetProgress.aria.label",
              "{{period}} budget: spent {{spent}} of {{limit}}.{{over}}",
              {
                period: snapshot.label,
                spent: formatAmount(snapshot.totalSpent, lng),
                limit: formatAmount(snapshot.totalLimit, lng),
                over: overPart,
              },
            );

            return (
              <div key={snapshot.label} className="rounded border border-border p-4">
                <p className="mb-2 text-sm font-semibold">{snapshot.label}</p>
                <figure
                  role="img"
                  aria-label={chartAriaLabel}
                  className="m-0 h-52 w-full [&_svg]:outline-none"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        stroke="none"
                      >
                        {chartData.map((entry) => (
                          <Cell key={`${snapshot.label}-${entry.key}`} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </figure>

                <ul className="mt-3 space-y-1">
                  {segments.map((segment) => (
                    <li
                      key={`${snapshot.label}-${segment.key}`}
                      className="flex items-center justify-between text-xs"
                    >
                      <span
                        className={`inline-flex items-center gap-2 ${
                          segment.emphasis ? "text-destructive" : "text-muted-foreground"
                        }`}
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: segment.fill }}
                          aria-hidden="true"
                        />
                        {segment.label}
                      </span>
                      <span className={`font-medium ${segment.emphasis ? "text-destructive" : ""}`}>
                        {segment.emphasis ? "- " : ""}
                        {formatAmount(segment.amount, lng)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs">
                  <span className="text-muted-foreground">
                    {t("components.budgetProgress.trackedTotal", "Tracked total")}
                  </span>
                  <span className="font-medium">{formatAmount(snapshot.totalLimit, lng)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </DashboardTileLink>
  );
}
