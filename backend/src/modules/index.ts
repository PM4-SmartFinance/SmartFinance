import type { SmartFinanceModule } from "../types/module.js";
import { mockBankModule } from "./mock-bank/index.js";
import { savingsGoalsModule } from "./savings-goals/index.js";

export const ACTIVE_MODULES: SmartFinanceModule[] = [mockBankModule, savingsGoalsModule];
