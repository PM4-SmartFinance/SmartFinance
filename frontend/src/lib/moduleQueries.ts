import { api } from "./api";
import type { RegisteredWidget } from "../components/ModuleWidgetCard";

export interface NavItem {
  moduleId: string;
  label: string;
  path: string;
}

export const MODULE_NAV_ITEMS_QUERY = {
  queryKey: ["module-nav-items"] as const,
  queryFn: () => api.get<{ navItems: NavItem[] }>("/modules/nav-items"),
} as const;

export const MODULE_WIDGETS_QUERY = {
  queryKey: ["module-widgets"] as const,
  queryFn: () => api.get<{ widgets: RegisteredWidget[] }>("/modules/widgets"),
} as const;
