import { ServiceError } from "../../errors.js";
import type { ParsedTransaction } from "../../services/importers/types.js";

export function parseMockBankCSV(csvText: string): ParsedTransaction[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const results: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;

    const parts = line.split(",");
    if (parts.length < 3) {
      throw new ServiceError(
        422,
        `mock-bank: line ${i + 1} must have at least 3 columns (date,amount,description)`,
      );
    }

    const [rawDate, rawAmount, ...descParts] = parts as [string, string, ...string[]];
    const description = descParts.join(",").trim();

    const dateParts = rawDate.trim().split("-");
    if (dateParts.length !== 3) {
      throw new ServiceError(422, `mock-bank: invalid date on line ${i + 1} — expected YYYY-MM-DD`);
    }
    const [y, m, d] = dateParts.map(Number) as [number, number, number];
    const date = new Date(Date.UTC(y, m - 1, d));
    if (isNaN(date.getTime())) {
      throw new ServiceError(422, `mock-bank: invalid date on line ${i + 1} — expected YYYY-MM-DD`);
    }

    const amount = parseFloat(rawAmount.trim());
    if (isNaN(amount)) {
      throw new ServiceError(
        422,
        `mock-bank: invalid amount "${rawAmount.trim()}" on line ${i + 1}`,
      );
    }

    results.push({ date, amount, description: description || "Unknown", subject: "" });
  }

  return results;
}
