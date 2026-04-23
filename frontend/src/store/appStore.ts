import { create } from "zustand";
import { formatLocalDate, subDays } from "../lib/dates";

export interface DateRange {
  startDate: string; // YYYY-MM-DD date string
  endDate: string; // YYYY-MM-DD date string
}

export interface AppState extends DateRange {
  activePresetKey: string;
  setDateRange: (startDate: string, endDate: string, presetKey: string) => void;
}

const getDefaultDateRange = (): DateRange & { activePresetKey: string } => {
  const endDate = new Date();
  const startDate = subDays(endDate, 30);
  return {
    startDate: formatLocalDate(startDate),
    endDate: formatLocalDate(endDate),
    activePresetKey: "30d",
  };
};

const defaultRange = getDefaultDateRange();

export const useAppStore = create<AppState>((set) => ({
  startDate: defaultRange.startDate,
  endDate: defaultRange.endDate,
  activePresetKey: defaultRange.activePresetKey,
  setDateRange: (startDate: string, endDate: string, presetKey: string) => {
    if (startDate > endDate) return;
    set({ startDate, endDate, activePresetKey: presetKey });
  },
}));
