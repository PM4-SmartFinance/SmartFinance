import type { FastifyInstance, FastifyBaseLogger } from "fastify";
import type { RoleType } from "../middleware/rbac.js";
import type { ParsedTransaction } from "../services/importers/types.js";

export interface ModuleStorageAdapter {
  get(userId: string, key: string): Promise<unknown>;
  set(userId: string, key: string, value: unknown): Promise<void>;
  delete(userId: string, key: string): Promise<void>;
  list(userId: string): Promise<Array<{ key: string; value: unknown }>>;
}

export interface ImporterPlugin {
  format: string;
  label: string;
  encoding?: string;
  parse(csvText: string): ParsedTransaction[];
}

export type RouteRegistrar = Pick<
  FastifyInstance,
  "get" | "post" | "put" | "patch" | "delete" | "head" | "options"
>;

export interface NavItemDescriptor {
  label: string;
  path: string;
}

export interface WidgetDescriptor {
  widgetId: string;
  title: string;
  dataEndpoint: string;
}

export interface ModuleContext {
  app: RouteRegistrar;
  storage: ModuleStorageAdapter;
  logger: FastifyBaseLogger;
  registerImporter(plugin: ImporterPlugin): void;
  registerNavItem(item: NavItemDescriptor): void;
  registerWidget(widget: WidgetDescriptor): void;
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
