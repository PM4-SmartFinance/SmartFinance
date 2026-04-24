import { useAppStore } from "../store/appStore";
import { formatLocalDate, subDays, subMonths } from "../lib/dates";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

const PRESETS = [
  { label: "Last 7 days", key: "7d", start: () => subDays(new Date(), 7) },
  { label: "Last 30 days", key: "30d", start: () => subDays(new Date(), 30) },
  { label: "Last 3 months", key: "3m", start: () => subMonths(new Date(), 3) },
  { label: "Last year", key: "1y", start: () => subMonths(new Date(), 12) },
  { label: "Custom", key: "custom", start: null },
] as const;

export function DateRangePicker() {
  const startDate = useAppStore((s) => s.startDate);
  const endDate = useAppStore((s) => s.endDate);
  const activePresetKey = useAppStore((s) => s.activePresetKey);
  const setDateRange = useAppStore((s) => s.setDateRange);

  const handlePreset = (key: string) => {
    const preset = PRESETS.find((p) => p.key === key);
    if (!preset) return;
    if (preset.start === null) {
      setDateRange(startDate, endDate, "custom");
      return;
    }
    setDateRange(formatLocalDate(preset.start()), formatLocalDate(new Date()), key);
  };

  const handleCustomStart = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateRange(e.target.value, endDate, "custom");
  };

  const handleCustomEnd = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateRange(startDate, e.target.value, "custom");
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.key}
              variant={activePresetKey === preset.key ? "default" : "outline"}
              size="sm"
              onClick={() => handlePreset(preset.key)}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        {activePresetKey === "custom" && (
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="start-date" className="text-sm font-medium">
                Start Date
              </label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={handleCustomStart}
                className="rounded border border-input bg-background px-3 py-2 text-sm"
                max={endDate}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="end-date" className="text-sm font-medium">
                End Date
              </label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={handleCustomEnd}
                className="rounded border border-input bg-background px-3 py-2 text-sm"
                min={startDate}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
