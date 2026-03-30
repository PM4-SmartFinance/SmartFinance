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

  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return {
    startDate: formatLocalDate(startDate),
    endDate: formatLocalDate(endDate),
  };
};

const defaultRange = getDefaultDateRange();

export const useAppStore = create<AppState>((set) => ({
  startDate: defaultRange.startDate,
  endDate: defaultRange.endDate,
  setDateRange: (startDate: string, endDate: string) => set({ startDate, endDate }),
}));
