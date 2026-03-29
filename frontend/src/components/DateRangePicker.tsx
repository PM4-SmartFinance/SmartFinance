import { useAppStore } from "../store/appStore";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

export function DateRangePicker() {
  const startDate = useAppStore((s) => s.startDate);
  const endDate = useAppStore((s) => s.endDate);
  const setDateRange = useAppStore((s) => s.setDateRange);

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateRange(e.target.value, endDate);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateRange(startDate, e.target.value);
  };

  const handleReset = () => {
    const endDate = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(endDate.getDate() - 30);

    const startStr = defaultStart.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];

    setDateRange(startStr as string, endStr as string);
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="start-date" className="text-sm font-medium">
              Start Date
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={handleStartDateChange}
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
              onChange={handleEndDateChange}
              className="rounded border border-input bg-background px-3 py-2 text-sm"
              min={startDate}
            />
          </div>

          <Button variant="outline" size="sm" onClick={handleReset} className="sm:mt-6">
            Reset to 30d
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
