import { useParams } from "react-router";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ModuleWidgetCard } from "../components/ModuleWidgetCard";
import type { RegisteredWidget } from "../components/ModuleWidgetCard";
import { UserMenu } from "../components/UserMenu";
import { Skeleton } from "@/components/ui/skeleton";

interface NavItem {
  moduleId: string;
  label: string;
  path: string;
}

const TEXT = {
  backToDashboard: "Dashboard",
  noWidgets: "This module has no dashboard widgets.",
  loadError: "Failed to load module data.",
} as const;

export function ModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();

  const { data: navData } = useQuery({
    queryKey: ["module-nav-items"],
    queryFn: () => api.get<{ navItems: NavItem[] }>("/modules/nav-items"),
  });

  const {
    data: widgetsData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["module-widgets"],
    queryFn: () => api.get<{ widgets: RegisteredWidget[] }>("/modules/widgets"),
  });

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
              {TEXT.backToDashboard}
            </Link>
            <UserMenu />
          </nav>
        </header>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">{TEXT.loadError}</p>
        ) : moduleWidgets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{TEXT.noWidgets}</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {moduleWidgets.map((widget) => (
              <ModuleWidgetCard key={widget.widgetId} widget={widget} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
