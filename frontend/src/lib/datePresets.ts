import { subDays, subMonths } from "./date";

export const PRESETS = [
  { label: "Last 7 days", key: "7d", start: () => subDays(new Date(), 7) },
  { label: "Last 30 days", key: "30d", start: () => subDays(new Date(), 30) },
  { label: "Last 3 months", key: "3m", start: () => subMonths(new Date(), 3) },
  { label: "Last year", key: "1y", start: () => subMonths(new Date(), 12) },
  { label: "Custom", key: "custom", start: null },
] as const;

export type PresetKey = (typeof PRESETS)[number]["key"];
