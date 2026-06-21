import { Counter } from "prom-client";

export const loginAttempts = new Counter({
  name: "smartfinance_login_attempts_total",
  help: "Total login attempts",
  labelNames: ["outcome"] as const,
});

export const transactionsImported = new Counter({
  name: "smartfinance_transactions_imported_total",
  help: "Total transactions imported from CSV",
  labelNames: ["format"] as const, // neon, zkb, wise, ubs
});

export const importOperations = new Counter({
  name: "smartfinance_import_operations_total",
  help: "Total CSV import operations",
  labelNames: ["format", "outcome"] as const, // outcome: "success" | "failed_user" | "failed_system"
});
