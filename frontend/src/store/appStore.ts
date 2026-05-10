import { create } from "zustand";
import { formatLocalDate, subDays } from "../lib/date";
import type { PresetKey } from "../lib/datePresets";

export type Theme = "light" | "dark" | "system";

export interface DateRange {
  startDate: string; // YYYY-MM-DD date string
  endDate: string; // YYYY-MM-DD date string
}

export interface AppState extends DateRange {
  activePresetKey: PresetKey;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  setDateRange: (startDate: string, endDate: string, presetKey: PresetKey) => void;
}

const getDefaultDateRange = (): DateRange & { activePresetKey: PresetKey } => {
  const endDate = new Date();
  const startDate = subDays(endDate, 30);
  return {
    startDate: formatLocalDate(startDate),
    endDate: formatLocalDate(endDate),
    activePresetKey: "30d",
  };
};

const defaultRange = getDefaultDateRange();

export const isTheme = (v: unknown): v is Theme => v === "light" || v === "dark" || v === "system";

export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem("theme");
    return isTheme(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function applyThemeToDOM(theme: Theme): void {
  if (typeof document === "undefined") return;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export const useAppStore = create<AppState>((set) => ({
  startDate: defaultRange.startDate,
  endDate: defaultRange.endDate,
  activePresetKey: defaultRange.activePresetKey,
  theme: getStoredTheme(),
  setTheme: (theme: Theme) =>
    set(() => {
      applyThemeToDOM(theme);
      try {
        localStorage.setItem("theme", theme);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn("[theme] could not persist preference", err);
        }
      }
      return { theme };
    }),
  setDateRange: (startDate, endDate, presetKey) => {
    set({ startDate, endDate, activePresetKey: presetKey });
  },
}));

// Single app-wide subscription to OS theme changes. Re-applies the DOM class
// only when the user's selected theme is "system" — explicit "light" / "dark"
// choices are not overridden by OS preference flips.
if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
  try {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", () => {
      if (useAppStore.getState().theme === "system") {
        applyThemeToDOM("system");
      }
    });
  } catch {
    // matchMedia unavailable — best-effort.
  }
}
