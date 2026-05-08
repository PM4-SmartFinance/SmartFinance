import { create } from "zustand";
import { formatLocalDate, subDays } from "../lib/date";
import type { PresetKey } from "../lib/datePresets";

export interface DateRange {
  startDate: string; // YYYY-MM-DD date string
  endDate: string; // YYYY-MM-DD date string
}

export interface AppState extends DateRange {
  activePresetKey: PresetKey;
  theme: "light" | "dark";
  toggleTheme: () => void;
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

const getStoredTheme = (): "light" | "dark" => {
  try {
    return (localStorage.getItem("theme") as "light" | "dark") ?? "light";
  } catch {
    return "light";
  }
};

export const useAppStore = create<AppState>((set) => ({
  startDate: defaultRange.startDate,
  endDate: defaultRange.endDate,
  activePresetKey: defaultRange.activePresetKey,
  theme: getStoredTheme(),
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "light" ? "dark" : "light";
      try {
        localStorage.setItem("theme", next);
        document.documentElement.classList.toggle("dark", next === "dark");
      } catch {
        // Not in a browser environment (e.g. tests)
      }
      return { theme: next };
    }),
  setDateRange: (startDate, endDate, presetKey) => {
    set({ startDate, endDate, activePresetKey: presetKey });
  },
}));
