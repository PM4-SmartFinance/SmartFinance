import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Link } from "react-router";
import { useCategories } from "../lib/queries/categories";
import { useBudgets, type CategorySpending } from "../lib/queries/budgets";
import { formatCurrency } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const OUTER_COLORS = {
  spent: "hsl(var(--primary))",
  remaining: "hsl(var(--muted))",
  over: "#ef4444",
} as const;

const INNER_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

interface PeriodSnapshot {
  label: string;
  totalLimit: number;
  totalSpent: number;
  spentWithinLimit: number;
  remaining: number;
  overBudget: number;
  categories: Array<{ categoryId: string; spending: number }>;
}

function toNumber(value: string | null): number {
  if (value == null) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function buildSnapshot(
  label: string,
  categorySpending: CategorySpending[] | undefined,
): PeriodSnapshot {
  const tracked = (categorySpending ?? []).filter((c) => c.scaledLimit !== null);

  const totalLimit = tracked.reduce((acc, cur) => acc + toNumber(cur.scaledLimit), 0);
  const totalSpent = tracked.reduce((acc, cur) => acc + toNumber(cur.spending), 0);
  const spentWithinLimit = Math.min(totalSpent, totalLimit);
  const remaining = Math.max(totalLimit - totalSpent, 0);
  const overBudget = Math.max(totalSpent - totalLimit, 0);

  const categories = tracked
    .map((c) => ({ categoryId: c.categoryId, spending: toNumber(c.spending) }))
    .filter((c) => c.spending > 0)
    .sort((a, b) => b.spending - a.spending);

  return {
    label,
    totalLimit,
    totalSpent,
    spentWithinLimit,
    remaining,
    overBudget,
    categories,
  };
}

function getCategoryLabel(categoryId: string, names: Map<string, string>): string {
  const known = names.get(categoryId);
  if (known) return known;
  return `Category ${categoryId.slice(0, 6)}`;
}

function getCategoryColor(categoryId: string): string {
  let hash = 0;
  for (let i = 0; i < categoryId.length; i += 1) {
    hash = (hash * 31 + categoryId.charCodeAt(i)) >>> 0;
  }
  return INNER_COLORS[hash % INNER_COLORS.length]!;
}

export function BudgetProgressWidget() {
  const daily = useBudgets({ period: "DAILY" });
  const monthly = useBudgets({ period: "MONTHLY" });
  const yearly = useBudgets({ period: "YEARLY" });
  const categoriesQuery = useCategories();

  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categoriesQuery.data ?? []) {
      map.set(c.id, c.categoryName);
    }
    return map;
  }, [categoriesQuery.data]);

  const isLoading = daily.isLoading || monthly.isLoading || yearly.isLoading;
  const error = daily.error || monthly.error || yearly.error;

  const snapshots = useMemo(
    () => [
      buildSnapshot("Daily", daily.data?.categorySpending),
      buildSnapshot("Monthly", monthly.data?.categorySpending),
      buildSnapshot("Yearly", yearly.data?.categorySpending),
    ],
    [daily.data?.categorySpending, monthly.data?.categorySpending, yearly.data?.categorySpending],
  );

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wider">
            Budget Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load budget progress. Please try again.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wider">
            Budget Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-72 items-center justify-center rounded bg-muted/30">
            <p className="text-sm text-muted-foreground">Loading budget progress...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasTrackedBudgets = snapshots.some((s) => s.totalLimit > 0);

  if (!hasTrackedBudgets) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wider">
            Budget Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-72 items-center justify-center rounded bg-muted/30 px-4 text-center">
            <p className="text-sm text-muted-foreground">
              No tracked budget totals yet. Create budgets and import transactions to populate these
              charts.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Link to="/budgets" className="block hover:opacity-95 transition-opacity">
      <Card className="cursor-pointer">
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wider">
            Budget Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {snapshots.map((snapshot) => {
              const outerData = [
                { name: "Spent", value: snapshot.spentWithinLimit, fill: OUTER_COLORS.spent },
                { name: "Remaining", value: snapshot.remaining, fill: OUTER_COLORS.remaining },
                ...(snapshot.overBudget > 0
                  ? [{ name: "Over", value: snapshot.overBudget, fill: OUTER_COLORS.over }]
                  : []),
              ].filter((d) => d.value > 0);

              const innerData =
                snapshot.categories.length > 0
                  ? snapshot.categories.map((c) => ({
                      name: getCategoryLabel(c.categoryId, categoryNames),
                      value: c.spending,
                      fill: getCategoryColor(c.categoryId),
                    }))
                  : [{ name: "No category spending", value: 1, fill: "hsl(var(--muted))" }];

              return (
                <div key={snapshot.label} className="rounded border border-border p-4">
                  <p className="mb-2 text-sm font-semibold">{snapshot.label}</p>
                  <div className="h-52 w-full">
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
                  </div>

                  {snapshot.categories.length > 0 ? (
                    <ul className="mt-3 space-y-1">
                      {snapshot.categories.slice(0, 4).map((cat) => (
                        <li
                          key={`${snapshot.label}-${cat.categoryId}`}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="inline-flex items-center gap-2 text-muted-foreground">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: getCategoryColor(cat.categoryId) }}
                              aria-hidden="true"
                            />
                            {getCategoryLabel(cat.categoryId, categoryNames)}
                          </span>
                          <span className="font-medium">{formatCurrency(cat.spending)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">No category spending yet.</p>
                  )}

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Spent</span>
                    <span className="font-medium">{formatCurrency(snapshot.totalSpent)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full bg-black"
                        aria-hidden="true"
                      />
                      Tracked total
                    </span>
                    <span className="font-medium">{formatCurrency(snapshot.totalLimit)}</span>
                  </div>
                  {snapshot.overBudget > 0 && (
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="text-destructive">Over budget</span>
                      <span className="font-medium text-destructive">
                        - {formatCurrency(snapshot.overBudget)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
