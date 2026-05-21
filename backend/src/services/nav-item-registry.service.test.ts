import { describe, it, expect, beforeEach } from "vitest";
import {
  registerNavItem,
  getAllNavItems,
  clearNavItemRegistry,
} from "./nav-item-registry.service.js";

beforeEach(() => {
  clearNavItemRegistry();
});

describe("nav-item registry", () => {
  it("starts empty", () => {
    expect(getAllNavItems()).toEqual([]);
  });

  it("registers a nav item and returns it in the list", () => {
    registerNavItem("my-module", { label: "My Module", path: "/modules/my-module" });
    expect(getAllNavItems()).toEqual([
      { moduleId: "my-module", label: "My Module", path: "/modules/my-module" },
    ]);
  });

  it("allows multiple nav items from different modules", () => {
    registerNavItem("mod-a", { label: "Module A", path: "/modules/mod-a" });
    registerNavItem("mod-b", { label: "Module B", path: "/modules/mod-b" });
    expect(getAllNavItems()).toHaveLength(2);
  });

  it("allows multiple nav items from the same module", () => {
    registerNavItem("mod-a", { label: "Overview", path: "/modules/mod-a" });
    registerNavItem("mod-a", { label: "Settings", path: "/modules/mod-a/settings" });
    expect(getAllNavItems()).toHaveLength(2);
  });

  it("getAllNavItems returns a shallow copy, not the internal array", () => {
    registerNavItem("mod-a", { label: "Module A", path: "/modules/mod-a" });
    const first = getAllNavItems();
    first.push({ moduleId: "injected", label: "Injected", path: "/injected" });
    expect(getAllNavItems()).toHaveLength(1);
  });

  it("clearNavItemRegistry removes all entries", () => {
    registerNavItem("mod-a", { label: "Module A", path: "/modules/mod-a" });
    clearNavItemRegistry();
    expect(getAllNavItems()).toEqual([]);
  });
});
