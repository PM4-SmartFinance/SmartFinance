import { ServiceError } from "../errors.js";

function isValidCalendarDate(dateStr: string): boolean {
  const d = new Date(dateStr + "T00:00:00Z");
  return !isNaN(d.getTime()) && dateStr === d.toISOString().slice(0, 10);
}

// Shared guard for date-range endpoints (dashboard summary/categories/trends
// and the recategorize-by-range action). Throws ServiceError(400) on any
// invalid calendar date or an inverted range.
export function validateDateRange(startDate: string, endDate: string): void {
  if (!isValidCalendarDate(startDate) || !isValidCalendarDate(endDate)) {
    throw new ServiceError(400, "startDate and endDate must be valid calendar dates");
  }

  if (new Date(startDate + "T00:00:00Z").getTime() > new Date(endDate + "T00:00:00Z").getTime()) {
    throw new ServiceError(400, "startDate must not be after endDate");
  }
}
