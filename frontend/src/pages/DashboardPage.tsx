import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { DateRangePicker } from "../components/DateRangePicker";
import { SummaryMetricsWidget } from "../components/SummaryMetricsWidget";
import { BudgetWidget } from "../components/BudgetWidget";
import { BudgetProgressWidget } from "../components/BudgetProgressWidget";
import { SpendingTrendChart } from "../components/SpendingTrendChart";
import { CategoryBreakdownChart } from "../components/CategoryBreakdownChart";
import { CsvImportCard } from "../components/CsvImportCard";
import { RecentTransactionsWidget } from "../components/RecentTransactionsWidget";
import { ModuleWidgetCard } from "../components/ModuleWidgetCard";
import { UserMenu } from "../components/UserMenu";
import { useTranslation } from "react-i18next";
import { MODULE_NAV_ITEMS_QUERY, MODULE_WIDGETS_QUERY } from "../lib/moduleQueries";

export function DashboardPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const displayName = user?.name?.trim();

  const { data: navItemsData } = useQuery(MODULE_NAV_ITEMS_QUERY);
  const moduleNavItems = navItemsData?.navItems ?? [];

  const { data: widgetsData } = useQuery(MODULE_WIDGETS_QUERY);
  const moduleWidgets = widgetsData?.widgets ?? [];

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ── Page Header ── */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-bold text-foreground">
              {t("dashboard.heading", "Dashboard")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {user
                ? t("dashboard.greeting", "Welcome back, {{name}}", {
                    name: displayName || user.email,
                  })
                : t("dashboard.subtitle", "View your financial overview at a glance")}
            </p>
          </div>
          <nav className="flex items-center gap-1">
            {[
              { to: "/transactions", label: t("nav.transactions", "Transactions") },
              { to: "/budgets", label: t("nav.budgets", "Budgets") },
              { to: "/categories", label: t("nav.categories", "Categories") },
              { to: "/settings", label: t("nav.settings", "Settings") },
            ].map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {label}
              </Link>
            ))}
            {moduleNavItems.map(({ path, label }) => (
              <Link
                key={path}
                to={path}
                className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {label}
              </Link>
            ))}
            <UserMenu />
          </nav>
        </header>

        {/* ── Date Range Picker ── */}
        <DateRangePicker />

        {/* ── Spending Trend Chart ── */}
        <section className="mb-8">
          <SpendingTrendChart />
        </section>

        {/* ── Summary Metrics ── */}
        <section className="mb-8">
          <SummaryMetricsWidget />
        </section>

        {/* ── Budgets ── */}
        <section className="mb-8">
          <BudgetWidget />
        </section>

        {/* ── Budget Progress ── */}
        <section className="mb-8">
          <BudgetProgressWidget />
        </section>

        {/* ── Charts Grid ── */}
        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          <CategoryBreakdownChart />

          {/* ── Recent Transactions (Full Width) ── */}
          <RecentTransactionsWidget />

          {/* ── CSV Import ── */}
          <CsvImportCard />

          {/* ── Module Widgets ── */}
          {moduleWidgets.map((widget) => (
            <ModuleWidgetCard key={`${widget.moduleId}:${widget.widgetId}`} widget={widget} />
          ))}
        </section>
      </div>
    </main>
  );
}
