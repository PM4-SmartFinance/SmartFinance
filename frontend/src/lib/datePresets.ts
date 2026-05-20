import { subDays, subMonths } from "./date";

export const PRESETS = [
  {
    translationKey: "common.presets.last7days",
    label: "Last 7 days",
    key: "7d",
    start: () => subDays(new Date(), 7),
  },
  {
    translationKey: "common.presets.last30days",
    label: "Last 30 days",
    key: "30d",
    start: () => subDays(new Date(), 30),
  },
  {
    translationKey: "common.presets.last3months",
    label: "Last 3 months",
    key: "3m",
    start: () => subMonths(new Date(), 3),
  },
  {
    translationKey: "common.presets.lastYear",
    label: "Last year",
    key: "1y",
    start: () => subMonths(new Date(), 12),
  },
  { translationKey: "common.presets.custom", label: "Custom", key: "custom", start: null },
] as const;

export type PresetKey = (typeof PRESETS)[number]["key"];
