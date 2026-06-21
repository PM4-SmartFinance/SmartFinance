import { useDashboardBudgets } from "../lib/queries/dashboard";
import { getMostSpecificBudgetsPerCategory } from "../lib/queries/budgets";
import { getBudgetStatus } from "./budgetUtils";
import { CardContent, CardHeader, CardTitle } from "./ui/card";
import { DashboardTileLink } from "./DashboardTileLink";
import { useTranslation } from "react-i18next";

export function BudgetWidget() {
  const { data, isLoading, error } = useDashboardBudgets();
  const { t } = useTranslation();

  if (error) {
    return (
      <div className="rounded border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        {t("components.budgetWidget.error", "Failed to load budget data. Please try again.")}
      </div>
    );
  }

  if (isLoading) {
    return (
      <DashboardTileLink
        to="/budgets"
        ariaLabel={t("components.budgetWidget.ariaView", "View budgets")}
        linkClassName="block"
      >
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wider">
            {t("components.budgetWidget.title", "Budget Status")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
        </CardContent>
      </DashboardTileLink>
    );
  }

  const activeBudgets = getMostSpecificBudgetsPerCategory(data?.budgets ?? []);

  // Count budgets by status
  const statusCounts = activeBudgets.reduce(
    (acc, b) => {
      const status = getBudgetStatus(b.percentageUsed);
      acc[status] += 1;
      return acc;
    },
    { "on-track": 0, approaching: 0, exceeded: 0 },
  );

  return (
    <DashboardTileLink
      to="/budgets"
      ariaLabel={t("components.budgetWidget.ariaView", "View budgets")}
      linkClassName="block"
    >
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wider">
          {t("components.budgetWidget.title", "Budget Status")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeBudgets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("components.budgetWidget.empty", "No active budgets. Click to create one.")}
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t(
                "components.budgetWidget.statusSummary",
                "{{onTrack}} on track, {{approaching}} approaching limit, {{exceeded}} exceeded",
                {
                  onTrack: statusCounts["on-track"],
                  approaching: statusCounts["approaching"],
                  exceeded: statusCounts["exceeded"],
                },
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("components.budgetWidget.activeCount", "{{count}} active budgets", {
                count: activeBudgets.length,
              })}
            </p>
          </div>
        )}
      </CardContent>
    </DashboardTileLink>
  );
}
