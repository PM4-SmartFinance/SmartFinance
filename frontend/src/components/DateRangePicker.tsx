import { useAppStore } from "../store/appStore";
import { useAccounts } from "../lib/queries/accounts";
import { formatLocalDate } from "../lib/date";
import { PRESETS } from "../lib/datePresets";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Label } from "./ui/label";
import { NativeSelect } from "./ui/native-select";
import { useTranslation } from "react-i18next";

export function DateRangePicker() {
  const startDate = useAppStore((s) => s.startDate);
  const endDate = useAppStore((s) => s.endDate);
  const activePresetKey = useAppStore((s) => s.activePresetKey);
  const setDateRange = useAppStore((s) => s.setDateRange);
  const accountId = useAppStore((s) => s.accountId);
  const setAccountId = useAppStore((s) => s.setAccountId);
  const { t } = useTranslation();

  const { data: accountsData, error: accountsError } = useAccounts();
  // Only active accounts have visible transactions, so only they are offered.
  const accounts = (accountsData ?? []).filter((account) => account.active);

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
        <div className="flex flex-wrap items-end justify-between gap-4">
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

          {/* Account filter — all (active) accounts or one specific account. */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dashboard-account" className="text-xs text-muted-foreground">
              {t("transactions.filters.account", "Filter by Account")}
            </Label>
            <NativeSelect
              id="dashboard-account"
              className="w-48"
              value={accountId ?? ""}
              onChange={(e) => setAccountId(e.target.value || null)}
            >
              <option value="">
                {accountsError
                  ? t("transactions.filters.accountsError", "Failed to load accounts")
                  : t("transactions.filters.allAccounts", "All Accounts")}
              </option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </NativeSelect>
          </div>
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
