# Hello World Module

A minimal SmartFinance extension module demonstrating the module interface.

## What it does

- Registers two routes under `/api/v1/modules/hello-world/`
- Demonstrates per-user namespace-isolated storage
- Implements the `onTransactionImported` lifecycle hook

## Endpoints

### `GET /api/v1/modules/hello-world/greeting`

Returns a greeting and the last stored message for the authenticated user.

**Auth:** USER session required

**Response:**
```json
{
  "message": "Hello from hello-world module!",
  "lastGreeting": "Hi there!" 
}
```

### `POST /api/v1/modules/hello-world/greeting`

Stores a greeting message for the authenticated user.

**Auth:** USER session required

**Body:**
```json
{ "message": "Hi there!" }
```

**Response `201`:**
```json
{ "stored": "Hi there!" }
```

## Creating your own module

1. Copy this directory as a template
2. Implement the `SmartFinanceModule` interface from `src/types/module.ts`
3. Add your module to `src/modules/index.ts`

### Module interface

```typescript
interface SmartFinanceModule {
  id: string;           // unique kebab-case identifier, used as URL prefix
  name: string;         // human-readable display name
  requiredRole: "USER" | "ADMIN";

  // Called once at app startup — register routes on context.app
  init(context: ModuleContext): Promise<void>;

  // Returns current initialization state
  getStatus(): ModuleStatus;

  // Optional lifecycle hooks — implement only what you need
  onTransactionImported?(event: TransactionImportedEvent): Promise<void>;
  onBudgetCreated?(event: BudgetCreatedEvent): Promise<void>;
  onCategoryAdded?(event: CategoryAddedEvent): Promise<void>;
}
```

### Storage

Use `context.storage` inside `init()` — it is pre-scoped to your module's namespace and the authenticated user's ID. Never access the database directly.

```typescript
await context.storage.set(userId, "my-key", { any: "json" });
const val = await context.storage.get(userId, "my-key");
await context.storage.delete(userId, "my-key");
const all = await context.storage.list(userId); // [{ key, value }]
```

### Lifecycle hooks

Hooks fire after the corresponding core operation succeeds. A hook that throws does **not** fail the core operation — errors are logged with module context and swallowed.

### Constraints

- Modules cannot access the repository layer directly
- Modules cannot modify the database schema
- All routes registered in `init()` are automatically prefixed with `/api/v1/modules/<id>/`
- Route authorization must be enforced by the module using `requireRole()`
