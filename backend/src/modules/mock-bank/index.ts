import type { SmartFinanceModule, ModuleContext, ModuleStatus } from "../../types/module.js";
import { parseMockBankCSV } from "./mock-bank.parser.js";

function createMockBankModule(): SmartFinanceModule {
  let initialized = false;
  let initError: string | undefined;

  return {
    id: "mock-bank",
    name: "Mock Bank",
    requiredRole: "USER",

    async init(context: ModuleContext): Promise<void> {
      try {
        context.registerImporter({
          format: "mock-bank",
          label: "Mock Bank",
          encoding: "utf-8",
          parse: parseMockBankCSV,
        });
        initialized = true;
      } catch (err) {
        initError = err instanceof Error ? (err.stack ?? err.message) : String(err);
        throw err;
      }
    },

    getStatus(): ModuleStatus {
      const status: ModuleStatus = { initialized };
      if (initError !== undefined) status.error = initError;
      return status;
    },
  };
}

export const mockBankModule = createMockBankModule();
