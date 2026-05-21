import type { SmartFinanceModule } from "../types/module.js";
import { mockBankModule } from "./mock-bank/index.js";

export const ACTIVE_MODULES: SmartFinanceModule[] = [mockBankModule];
