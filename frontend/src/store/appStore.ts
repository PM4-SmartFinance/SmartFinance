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

const getStoredTheme = (): Theme => {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
    return "light";
  } catch {
    return "light";
  }
};

function applyThemeToDOM(theme: Theme) {
  try {
    const isDark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  } catch {
    // Not in a browser environment (e.g. tests)
  }
}

export const useAppStore = create<AppState>((set) => ({
  startDate: defaultRange.startDate,
  endDate: defaultRange.endDate,
  activePresetKey: defaultRange.activePresetKey,
  theme: getStoredTheme(),
  setTheme: (theme: Theme) =>
    set(() => {
      try {
        localStorage.setItem("theme", theme);
        applyThemeToDOM(theme);
      } catch {
        // Not in a browser environment (e.g. tests)
      }
      return { theme };
    }),
  setDateRange: (startDate, endDate, presetKey) => {
    set({ startDate, endDate, activePresetKey: presetKey });
  },
}));
