import { useMemo } from "react";
import { useCategories } from "../lib/queries/categories";
import { useBudgets, type CategorySpending } from "../lib/queries/budgets";
import { getBudgetStatus, budgetBarColorClass, budgetTextColorClass } from "./budgetUtils";
import { formatAmount } from "@/lib/format";
import { CardContent, CardHeader, CardTitle } from "./ui/card";
import { DashboardTileLink } from "./DashboardTileLink";
import { useTranslation } from "react-i18next";

// One progress bar per budgeted category per period (Daily / Monthly / Yearly):
// spent / limit, percentage used, and remaining or over-budget. Bars are
// coloured by spend status (blue on track, yellow approaching, red exceeded),
// which carries more signal than a category colour. Every category that has a
// budget for the period is shown — including ones with no spending yet — so the
// widget never collapses to "only the categories you happened to spend in".

interface CategoryUsage {
  categoryId: string;
  spending: number;
  limit: number;
}

interface PeriodSnapshot {
  label: string;
  totalLimit: number;
  hasInvalidValue: boolean;
  categories: CategoryUsage[];
}

function toNumber(value: string | null): number | null {
  if (value == null) return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function usageRatio(c: CategoryUsage): number {
  return c.limit > 0 ? c.spending / c.limit : 0;
}

function buildSnapshot(
  label: string,
  categorySpending: CategorySpending[] | undefined,
): PeriodSnapshot {
  // A non-null scaledLimit means the category has a budget for this period.
  const budgeted = (categorySpending ?? []).filter((c) => c.scaledLimit !== null);

  let hasInvalidValue = false;
  let totalLimit = 0;
  const categories: CategoryUsage[] = [];

  for (const c of budgeted) {
    const limit = toNumber(c.scaledLimit);
    const spending = toNumber(c.spending);
    if (limit === null || spending === null) {
      hasInvalidValue = true;
      continue;
    }
    totalLimit += limit;
    categories.push({ categoryId: c.categoryId, spending, limit });
  }

  // Most-consumed budgets first so the ones nearest their limit lead.
  categories.sort((a, b) => usageRatio(b) - usageRatio(a));

  return { label, totalLimit, hasInvalidValue, categories };
}

export function BudgetProgressWidget() {
  const daily = useBudgets({ period: "DAILY" });
  const monthly = useBudgets({ period: "MONTHLY" });
  const yearly = useBudgets({ period: "YEARLY" });
  const categoriesQuery = useCategories();
  const { t, i18n } = useTranslation();
  const lng = i18n.resolvedLanguage;

  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categoriesQuery.data ?? []) map.set(c.id, c.categoryName);
    return map;
  }, [categoriesQuery.data]);

  const isLoading = daily.isLoading || monthly.isLoading || yearly.isLoading;
  const error = daily.error ?? monthly.error ?? yearly.error ?? categoriesQuery.error;

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

  function getCategoryLabel(categoryId: string): string {
    return categoryNames.get(categoryId) ?? t("common.unknown", "Unknown");
  }

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

  const hasTrackedBudgets = snapshots.some((s) => s.categories.length > 0);

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
          {snapshots.map((snapshot) => (
            <div key={snapshot.label} className="rounded border border-border p-4">
              <p className="mb-3 text-sm font-semibold">{snapshot.label}</p>
              {snapshot.categories.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("components.budgetProgress.noPeriodBudgets", "No budgets for this period.")}
                </p>
              ) : (
                <ul className="space-y-3">
                  {snapshot.categories.map((cat) => {
                    const name = getCategoryLabel(cat.categoryId);
                    const percent = cat.limit > 0 ? (cat.spending / cat.limit) * 100 : 0;
                    const percentRounded = Math.round(percent);
                    const status = getBudgetStatus(percent);
                    const isOverBudget = cat.spending > cat.limit;
                    const remaining = cat.limit - cat.spending;

                    return (
                      <li key={`${snapshot.label}-${cat.categoryId}`}>
                        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                          <span className="truncate font-medium">{name}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {formatAmount(cat.spending, lng)} / {formatAmount(cat.limit, lng)}
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-valuenow={Math.min(percentRounded, 100)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={t(
                            "components.budgetProgress.aria.categoryUsage",
                            "{{category}}: {{percent}}% of budget used",
                            { category: name, percent: percentRounded },
                          )}
                          className="h-2 w-full overflow-hidden rounded-full bg-muted"
                        >
                          <div
                            className={`h-full ${budgetBarColorClass(status)}`}
                            style={{ width: `${Math.min(percent, 100)}%` }}
                          />
                        </div>
                        <div className="mt-1 flex items-baseline justify-between gap-2 text-[11px]">
                          <span className={`font-medium ${budgetTextColorClass(status)}`}>
                            {percentRounded}%
                          </span>
                          <span
                            className={isOverBudget ? "text-destructive" : "text-muted-foreground"}
                          >
                            {isOverBudget
                              ? `${formatAmount(Math.abs(remaining), lng)} ${t("components.budgetCategoryGroup.overBudget", "over budget")}`
                              : `${formatAmount(remaining, lng)} ${t("components.budgetCategoryGroup.remaining", "remaining")}`}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </DashboardTileLink>
  );
}
