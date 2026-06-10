import { useEffect, useMemo, useRef } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useCategories } from "../lib/queries/categories";
import { useBudgets, type CategorySpending } from "../lib/queries/budgets";
import { formatAmount } from "@/lib/format";
import { CardContent, CardHeader, CardTitle } from "./ui/card";
import { DashboardTileLink } from "./DashboardTileLink";
import { useTranslation } from "react-i18next";

// Theme tokens (oklch) resolved at paint time — adapt to light/dark automatically.
const OUTER_COLORS = {
  spent: "var(--primary)",
  remaining: "var(--muted)",
  over: "var(--destructive)",
} as const;

const INNER_COLORS = [
  "var(--chart-cat-1)",
  "var(--chart-cat-2)",
  "var(--chart-cat-3)",
  "var(--chart-cat-4)",
  "var(--chart-cat-5)",
  "var(--chart-cat-6)",
];

/** Number of categories shown in the inner ring and legend before collapsing into a "+N more" row. */
const TOP_CATEGORY_LIMIT = 4;

interface PeriodSnapshot {
  label: string;
  totalLimit: number;
  totalSpent: number;
  spentWithinLimit: number;
  remaining: number;
  overBudget: number;
  hasInvalidValue: boolean;
  categories: Array<{ categoryId: string; spending: number }>;
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
  const categories: Array<{ categoryId: string; spending: number }> = [];

  for (const c of tracked) {
    const limit = toNumber(c.scaledLimit);
    const spending = toNumber(c.spending);
    if (limit === null || spending === null) {
      hasInvalidValue = true;
      continue;
    }
    totalLimit += limit;
    totalSpent += spending;
    if (spending > 0) categories.push({ categoryId: c.categoryId, spending });
  }

  categories.sort((a, b) => b.spending - a.spending);

  return {
    label,
    totalLimit,
    totalSpent,
    spentWithinLimit: Math.min(totalSpent, totalLimit),
    remaining: Math.max(totalLimit - totalSpent, 0),
    overBudget: Math.max(totalSpent - totalLimit, 0),
    hasInvalidValue,
    categories,
  };
}

function getCategoryColor(index: number): string {
  return INNER_COLORS[index % INNER_COLORS.length] ?? INNER_COLORS[0]!;
}

export function BudgetProgressWidget() {
  const daily = useBudgets({ period: "DAILY" });
  const monthly = useBudgets({ period: "MONTHLY" });
  const yearly = useBudgets({ period: "YEARLY" });
  const categoriesQuery = useCategories();
  const loggedMissingCategoryIdsRef = useRef<Set<string>>(new Set());
  const { t, i18n } = useTranslation();

  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categoriesQuery.data ?? []) {
      map.set(c.id, c.categoryName);
    }
    return map;
  }, [categoriesQuery.data]);

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
  const error = periodErrors[0]?.error ?? categoriesQuery.error;

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

  const missingCategoryIds = useMemo(() => {
    if (!categoriesQuery.isSuccess) return [] as string[];
    const seen = new Set<string>();
    for (const snapshot of snapshots) {
      for (const cat of snapshot.categories) {
        if (!categoryNames.has(cat.categoryId)) seen.add(cat.categoryId);
      }
    }
    return [...seen];
  }, [snapshots, categoryNames, categoriesQuery.isSuccess]);

  useEffect(() => {
    for (const categoryId of missingCategoryIds) {
      if (loggedMissingCategoryIdsRef.current.has(categoryId)) continue;
      loggedMissingCategoryIdsRef.current.add(categoryId);
      console.warn("BudgetProgressWidget: missing category name for categoryId", { categoryId });
    }
  }, [missingCategoryIds]);

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
            const outerData = [
              {
                name: t("components.budgetProgress.chart.spent", "Spent"),
                value: snapshot.spentWithinLimit,
                fill: OUTER_COLORS.spent,
              },
              {
                name: t("components.budgetProgress.chart.remaining", "Remaining"),
                value: snapshot.remaining,
                fill: OUTER_COLORS.remaining,
              },
              ...(snapshot.overBudget > 0
                ? [
                    {
                      name: t("components.budgetProgress.chart.over", "Over"),
                      value: snapshot.overBudget,
                      fill: OUTER_COLORS.over,
                    },
                  ]
                : []),
            ].filter((d) => d.value > 0);

            const innerData =
              snapshot.categories.length > 0
                ? snapshot.categories.map((c, index) => ({
                    name: getCategoryLabel(c.categoryId),
                    value: c.spending,
                    fill: getCategoryColor(index),
                  }))
                : [
                    {
                      name: t("components.budgetProgress.chart.noSpending", "No category spending"),
                      value: 1,
                      fill: "var(--muted)",
                    },
                  ];

            const lng = i18n.resolvedLanguage;
            const topCategories = snapshot.categories.slice(0, TOP_CATEGORY_LIMIT);
            const overflowCount = snapshot.categories.length - topCategories.length;
            const categoriesPart =
              snapshot.categories.length > 0
                ? t("components.budgetProgress.aria.categories", "Top categories: {{list}}.", {
                    list: topCategories
                      .map(
                        (c) => `${getCategoryLabel(c.categoryId)} ${formatAmount(c.spending, lng)}`,
                      )
                      .join(", "),
                  })
                : t("components.budgetProgress.aria.noCategories", "No category spending.");
            const overPart =
              snapshot.overBudget > 0
                ? t("components.budgetProgress.aria.over", " Over budget by {{amount}}.", {
                    amount: formatAmount(snapshot.overBudget, lng),
                  })
                : "";
            const chartAriaLabel = t(
              "components.budgetProgress.aria.label",
              "{{period}} budget: spent {{spent}} of {{limit}}.{{over}} {{categories}}",
              {
                period: snapshot.label,
                spent: formatAmount(snapshot.totalSpent, lng),
                limit: formatAmount(snapshot.totalLimit, lng),
                over: overPart,
                categories: categoriesPart,
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
                        data={outerData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={80}
                        stroke="none"
                      >
                        {outerData.map((entry) => (
                          <Cell key={`${snapshot.label}-${entry.name}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Pie
                        data={innerData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={54}
                        stroke="none"
                      >
                        {innerData.map((entry) => (
                          <Cell key={`${snapshot.label}-${entry.name}-inner`} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </figure>

                {snapshot.categories.length > 0 ? (
                  <ul className="mt-3 space-y-1">
                    {topCategories.map((cat, index) => (
                      <li
                        key={`${snapshot.label}-${cat.categoryId}`}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: getCategoryColor(index) }}
                            aria-hidden="true"
                          />
                          {getCategoryLabel(cat.categoryId)}
                        </span>
                        <span className="font-medium">{formatAmount(cat.spending, lng)}</span>
                      </li>
                    ))}
                    {overflowCount > 0 && (
                      <li className="pt-0.5 text-xs text-muted-foreground">
                        {t("components.budgetProgress.moreCategories", "+{{count}} more", {
                          count: overflowCount,
                        })}
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {" "}
                    {t("components.budgetProgress.noCategorySpending", "No category spending yet.")}
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {t("components.budgetProgress.spent", "Spent")}
                  </span>
                  <span className="font-medium">
                    {formatAmount(snapshot.totalSpent, i18n.resolvedLanguage)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {t("components.budgetProgress.trackedTotal", "Tracked total")}
                  </span>
                  <span className="font-medium">
                    {formatAmount(snapshot.totalLimit, i18n.resolvedLanguage)}
                  </span>
                </div>
                {snapshot.overBudget > 0 && (
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-destructive">
                      {t("components.budgetProgress.overBudget", "Over budget")}
                    </span>
                    <span className="font-medium text-destructive">
                      - {formatAmount(snapshot.overBudget, i18n.resolvedLanguage)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </DashboardTileLink>
  );
}
