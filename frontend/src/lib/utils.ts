import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// TODO: replace hardcoded default with user's currency from DimCurrency
const currencyFormatter = new Intl.NumberFormat("de-CH", {
  style: "currency",
  currency: "CHF",
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}
