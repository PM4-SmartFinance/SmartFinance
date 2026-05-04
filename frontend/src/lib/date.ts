/** Format a Date as ISO `YYYY-MM-DD` in the local timezone (no UTC shift). */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Default start date for filters: 30 days before today. */
export function getDefaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return formatLocalDate(d);
}

/** Default end date for filters: today. */
export function getDefaultEndDate(): string {
  return formatLocalDate(new Date());
}

export function getDefaultDateRange(): { start: string; end: string } {
  return { start: getDefaultStartDate(), end: getDefaultEndDate() };
}
