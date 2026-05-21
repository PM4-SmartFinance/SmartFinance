import type { SmartFinanceModule } from "../types/module.js";
import { createMockBankModule } from "./mock-bank/index.js";
import { createSavingsGoalsModule } from "./savings-goals/index.js";

/**
 * Factories instead of instances: each `buildApp()` call instantiates fresh
 * modules so per-module closure state (e.g. `initialized`, `initError`) does
 * not leak across test runs or process restarts.
 */
export type ModuleFactory = () => SmartFinanceModule;

export const ACTIVE_MODULES: ModuleFactory[] = [createMockBankModule, createSavingsGoalsModule];
