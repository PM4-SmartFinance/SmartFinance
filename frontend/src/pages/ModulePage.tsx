import { useParams, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ModuleWidgetCard } from "../components/ModuleWidgetCard";
import { UserMenu } from "../components/UserMenu";
import { Skeleton } from "@/components/ui/skeleton";
import { MODULE_NAV_ITEMS_QUERY, MODULE_WIDGETS_QUERY } from "../lib/moduleQueries";

export function ModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const { t } = useTranslation();

  const { data: navData } = useQuery(MODULE_NAV_ITEMS_QUERY);

  const { data: widgetsData, isLoading, isError } = useQuery(MODULE_WIDGETS_QUERY);

  const moduleNavItem = navData?.navItems.find((item) => item.moduleId === moduleId);
  const moduleWidgets = widgetsData?.widgets.filter((w) => w.moduleId === moduleId) ?? [];

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-bold text-foreground">
              {moduleNavItem?.label ?? moduleId}
            </h1>
          </div>
          <nav className="flex items-center gap-1">
            <Link
              to="/"
              className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {t("modules.backToDashboard", "Dashboard")}
            </Link>
            <UserMenu />
          </nav>
        </header>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">
            {t("modules.loadError", "Failed to load module data.")}
          </p>
        ) : moduleWidgets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("modules.noWidgets", "This module has no dashboard widgets.")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {moduleWidgets.map((widget) => (
              <ModuleWidgetCard key={`${widget.moduleId}:${widget.widgetId}`} widget={widget} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
