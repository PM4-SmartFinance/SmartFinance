import { useAppStore } from "../store/appStore";
import { formatLocalDate } from "../lib/date";
import { PRESETS } from "../lib/datePresets";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { useTranslation } from "react-i18next";

export function DateRangePicker() {
  const startDate = useAppStore((s) => s.startDate);
  const endDate = useAppStore((s) => s.endDate);
  const activePresetKey = useAppStore((s) => s.activePresetKey);
  const setDateRange = useAppStore((s) => s.setDateRange);
  const { t } = useTranslation();

  const handlePreset = (preset: (typeof PRESETS)[number]) => {
    if (preset.start === null) {
      setDateRange(startDate, endDate, "custom");
      return;
    }
    setDateRange(formatLocalDate(preset.start()), formatLocalDate(new Date()), preset.key);
  };

  const handleCustomStart = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    setDateRange(e.target.value, endDate, "custom");
  };

  const handleCustomEnd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
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
              aria-pressed={activePresetKey === preset.key}
              onClick={() => handlePreset(preset)}
            >
              {t(preset.translationKey, preset.label)}
            </Button>
          ))}
        </div>

        {activePresetKey === "custom" && (
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="start-date" className="text-sm font-medium">
                {t("common.startDate", "Start Date")}
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
                {t("common.endDate", "End Date")}
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
