import type { FastifyInstance, FastifyBaseLogger } from "fastify";
import type { RoleType } from "../middleware/rbac.js";

export interface ModuleStorageAdapter {
  get(userId: string, key: string): Promise<unknown>;
  set(userId: string, key: string, value: unknown): Promise<void>;
  delete(userId: string, key: string): Promise<void>;
  list(userId: string): Promise<Array<{ key: string; value: unknown }>>;
}

export interface ModuleContext {
  app: FastifyInstance;
  storage: ModuleStorageAdapter;
  logger: FastifyBaseLogger;
}

export interface ModuleStatus {
  initialized: boolean;
  error?: string;
}

export interface TransactionImportedEvent {
  userId: string;
  accountId: string;
  imported: number;
}

export interface BudgetCreatedEvent {
  userId: string;
  budgetId: string;
  categoryId: string;
}

export interface CategoryAddedEvent {
  userId: string;
  categoryId: string;
  categoryName: string;
}

export interface SmartFinanceModule {
  id: string;
  name: string;
  requiredRole: RoleType;
  init(context: ModuleContext): Promise<void>;
  getStatus(): ModuleStatus;
  onTransactionImported?(event: TransactionImportedEvent): Promise<void>;
  onBudgetCreated?(event: BudgetCreatedEvent): Promise<void>;
  onCategoryAdded?(event: CategoryAddedEvent): Promise<void>;
}
