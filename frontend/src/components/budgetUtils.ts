export function getBudgetStatus(percentageUsed: number): "on-track" | "approaching" | "exceeded" {
  if (percentageUsed >= 100) return "exceeded";
  if (percentageUsed >= 70) return "approaching";
  return "on-track";
}
