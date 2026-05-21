import type { WidgetDescriptor } from "../types/module.js";

export interface RegisteredWidget extends WidgetDescriptor {
  moduleId: string;
}

const widgets: RegisteredWidget[] = [];

export function registerWidget(moduleId: string, widget: WidgetDescriptor): void {
  if (widgets.some((w) => w.moduleId === moduleId && w.widgetId === widget.widgetId)) {
    throw new Error(`Widget "${widget.widgetId}" from module "${moduleId}" is already registered`);
  }
  widgets.push({ ...widget, moduleId });
}

export function getAllWidgets(): RegisteredWidget[] {
  return [...widgets];
}

export function clearWidgetRegistry(): void {
  widgets.length = 0;
}
