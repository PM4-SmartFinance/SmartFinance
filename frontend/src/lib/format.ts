export const FALLBACK = "—";

const SWISS_LOCALE_MAP: Record<string, string> = {
  en: "en-CH",
  de: "de-CH",
  fr: "fr-CH",
  it: "it-CH",
  rm: "rm-CH",
};

export const getSwissLocale = (lng?: string): string => {
  const key = lng?.split("-")[0] ?? "en";
  const mapped = SWISS_LOCALE_MAP[key];
  if (!mapped) {
    if (import.meta.env.DEV && lng) {
      console.warn(`[format] Unsupported locale "${lng}", falling back to en-CH`);
    }
    return "en-CH";
  }
  return mapped;
};

export function formatAmount(raw: string | number, currentLanguage?: string): string {
  const parsed = typeof raw === "string" ? Number.parseFloat(raw) : raw;
  const value = parsed === 0 ? 0 : parsed;
  if (!Number.isFinite(value)) return FALLBACK;

  const locale = getSwissLocale(currentLanguage);

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "CHF",
  }).format(value);
}

export function formatDate(raw: string | Date | number, currentLanguage?: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return FALLBACK;

  const locale = getSwissLocale(currentLanguage);

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
  }).format(d);
}

export function formatDateId(dateId: number, currentLanguage?: string): string {
  const year = Math.trunc(dateId / 10000);
  const month = Math.trunc((dateId % 10000) / 100) - 1;
  const day = dateId % 100;
  return formatDate(Date.UTC(year, month, day), currentLanguage);
}
