import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface WidgetItem {
  id: string;
  label: string;
  detail?: string;
  progress?: number;
}

export interface ModuleWidgetData {
  items: WidgetItem[];
  emptyMessage?: string;
}

export interface RegisteredWidget {
  moduleId: string;
  widgetId: string;
  title: string;
  dataEndpoint: string;
}

export function ModuleWidgetCard({ widget }: { widget: RegisteredWidget }) {
  const { t } = useTranslation();
  const requiredPrefix = `/modules/${widget.moduleId}/`;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["module-widget", widget.moduleId, widget.widgetId],
    queryFn: () => {
      if (!widget.dataEndpoint.startsWith(requiredPrefix)) {
        throw new Error(
          `widget "${widget.widgetId}" dataEndpoint "${widget.dataEndpoint}" is outside module namespace`,
        );
      }
      return api.get<ModuleWidgetData>(widget.dataEndpoint);
    },
  });

  return (
    <Card className="col-span-1 sm:col-span-2 lg:col-span-3">
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wider">
          {widget.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">
            {t("modules.widgetLoadError", "Failed to load widget data.")}
          </p>
        ) : !data || data.items.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            {data?.emptyMessage ?? t("modules.widgetNoData", "No data available.")}
          </p>
        ) : (
          <ul className="space-y-3">
            {data.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.label}</span>
                  {item.detail && (
                    <span className="text-muted-foreground tabular-nums">{item.detail}</span>
                  )}
                </div>
                {item.progress !== undefined && (
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-secondary"
                    role="progressbar"
                    aria-label={`${item.label} progress`}
                    aria-valuenow={item.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
