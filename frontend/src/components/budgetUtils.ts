export type BudgetStatus = "on-track" | "approaching" | "exceeded";

export function getBudgetStatus(percentageUsed: number): BudgetStatus {
  if (percentageUsed >= 100) return "exceeded";
  if (percentageUsed >= 70) return "approaching";
  return "on-track";
}

/** Tailwind background class for a budget progress bar, keyed by spend status. */
export function budgetBarColorClass(status: BudgetStatus): string {
  switch (status) {
    case "exceeded":
      return "bg-red-500";
    case "approaching":
      return "bg-yellow-500";
    case "on-track":
      return "bg-blue-500";
  }
}

/** Tailwind text colour matching {@link budgetBarColorClass} for status labels. */
export function budgetTextColorClass(status: BudgetStatus): string {
  switch (status) {
    case "exceeded":
      return "text-red-600";
    case "approaching":
      return "text-yellow-600";
    case "on-track":
      return "text-blue-600";
  }
}
