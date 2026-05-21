import { describe, it, expect, beforeEach } from "vitest";
import { registerWidget, getAllWidgets, clearWidgetRegistry } from "./widget-registry.service.js";

beforeEach(() => {
  clearWidgetRegistry();
});

describe("widget registry", () => {
  it("starts empty", () => {
    expect(getAllWidgets()).toEqual([]);
  });

  it("registers a widget and returns it in the list", () => {
    registerWidget("my-module", {
      widgetId: "my-widget",
      title: "My Widget",
      dataEndpoint: "/modules/my-module/data",
    });
    expect(getAllWidgets()).toEqual([
      {
        moduleId: "my-module",
        widgetId: "my-widget",
        title: "My Widget",
        dataEndpoint: "/modules/my-module/data",
      },
    ]);
  });

  it("allows widgets with different widgetIds from the same module", () => {
    registerWidget("mod-a", {
      widgetId: "w1",
      title: "Widget 1",
      dataEndpoint: "/modules/mod-a/w1",
    });
    registerWidget("mod-a", {
      widgetId: "w2",
      title: "Widget 2",
      dataEndpoint: "/modules/mod-a/w2",
    });
    expect(getAllWidgets()).toHaveLength(2);
  });

  it("throws when the same moduleId + widgetId is registered twice", () => {
    registerWidget("mod-a", {
      widgetId: "w1",
      title: "Widget 1",
      dataEndpoint: "/modules/mod-a/w1",
    });
    expect(() =>
      registerWidget("mod-a", {
        widgetId: "w1",
        title: "Widget 1 duplicate",
        dataEndpoint: "/dup",
      }),
    ).toThrow('Widget "w1" from module "mod-a" is already registered');
  });

  it("allows the same widgetId for different modules", () => {
    registerWidget("mod-a", {
      widgetId: "summary",
      title: "A Summary",
      dataEndpoint: "/a/summary",
    });
    registerWidget("mod-b", {
      widgetId: "summary",
      title: "B Summary",
      dataEndpoint: "/b/summary",
    });
    expect(getAllWidgets()).toHaveLength(2);
  });

  it("getAllWidgets returns a shallow copy, not the internal array", () => {
    registerWidget("mod-a", { widgetId: "w1", title: "W1", dataEndpoint: "/w1" });
    const first = getAllWidgets();
    first.push({
      moduleId: "injected",
      widgetId: "injected",
      title: "Injected",
      dataEndpoint: "/injected",
    });
    expect(getAllWidgets()).toHaveLength(1);
  });

  it("clearWidgetRegistry removes all entries", () => {
    registerWidget("mod-a", { widgetId: "w1", title: "W1", dataEndpoint: "/w1" });
    clearWidgetRegistry();
    expect(getAllWidgets()).toEqual([]);
  });
});
