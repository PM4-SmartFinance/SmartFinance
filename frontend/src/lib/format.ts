export const FALLBACK = "—";

export function formatAmount(raw: string): string {
  const value = parseFloat(raw);
  if (!Number.isFinite(value)) return FALLBACK;
  const sign = value < 0 ? "−" : "";
  return `${sign}CHF ${Math.abs(value).toFixed(2)}`;
}

export function formatDate(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return FALLBACK;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}
