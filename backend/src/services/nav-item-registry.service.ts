import type { NavItemDescriptor } from "../types/module.js";

export interface RegisteredNavItem extends NavItemDescriptor {
  moduleId: string;
}

const navItems: RegisteredNavItem[] = [];

export function registerNavItem(moduleId: string, item: NavItemDescriptor): void {
  navItems.push({ ...item, moduleId });
}

export function getAllNavItems(): RegisteredNavItem[] {
  return [...navItems];
}

export function clearNavItemRegistry(): void {
  navItems.length = 0;
}
