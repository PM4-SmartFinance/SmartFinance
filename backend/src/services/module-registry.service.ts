import type {
  SmartFinanceModule,
  ModuleStatus,
  TransactionImportedEvent,
  BudgetCreatedEvent,
  CategoryAddedEvent,
} from "../types/module.js";
import { getLogger } from "../logger.js";

const modules = new Map<string, SmartFinanceModule>();

export function registerModule(mod: SmartFinanceModule): void {
  if (modules.has(mod.id)) {
    getLogger().error(
      { moduleId: mod.id },
      "module registration conflict — duplicate id, overwriting",
    );
  }
  modules.set(mod.id, mod);
}

export function getModule(id: string): SmartFinanceModule | undefined {
  return modules.get(id);
}

export function getAllModules(): Array<{
  id: string;
  name: string;
  requiredRole: string;
  status: ModuleStatus;
}> {
  return [...modules.values()].map((m) => ({
    id: m.id,
    name: m.name,
    requiredRole: m.requiredRole,
    status: m.getStatus(),
  }));
}

export async function fireTransactionImported(event: TransactionImportedEvent): Promise<void> {
  for (const mod of modules.values()) {
    if (!mod.onTransactionImported) continue;
    try {
      await mod.onTransactionImported(event);
    } catch (err) {
      getLogger().error({ err, moduleId: mod.id }, "module hook onTransactionImported failed");
    }
  }
}

export async function fireBudgetCreated(event: BudgetCreatedEvent): Promise<void> {
  for (const mod of modules.values()) {
    if (!mod.onBudgetCreated) continue;
    try {
      await mod.onBudgetCreated(event);
    } catch (err) {
      getLogger().error({ err, moduleId: mod.id }, "module hook onBudgetCreated failed");
    }
  }
}

export async function fireCategoryAdded(event: CategoryAddedEvent): Promise<void> {
  for (const mod of modules.values()) {
    if (!mod.onCategoryAdded) continue;
    try {
      await mod.onCategoryAdded(event);
    } catch (err) {
      getLogger().error({ err, moduleId: mod.id }, "module hook onCategoryAdded failed");
    }
  }
}

export function clearRegistry(): void {
  modules.clear();
}
