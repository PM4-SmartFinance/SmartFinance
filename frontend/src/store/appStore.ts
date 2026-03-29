import { create } from "zustand";

export interface DateRange {
  startDate: string; // ISO 8601 format
  endDate: string; // ISO 8601 format
}

export interface AppState extends DateRange {
  setDateRange: (startDate: string, endDate: string) => void;
}

// Default to last 30 days
const getDefaultDateRange = (): DateRange => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 30);

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  return {
    startDate: startDateStr as string,
    endDate: endDateStr as string,
  };
};

const defaultRange = getDefaultDateRange();

export const useAppStore = create<AppState>((set) => ({
  startDate: defaultRange.startDate,
  endDate: defaultRange.endDate,
  setDateRange: (startDate: string, endDate: string) => set({ startDate, endDate }),
}));
