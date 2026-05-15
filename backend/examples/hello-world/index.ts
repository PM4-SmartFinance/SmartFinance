// This file is a documentation template only — not compiled by the TypeScript build.
// The working implementation lives in src/examples/hello-world/index.ts.
// Copy this pattern when creating your own module.

import type {
  SmartFinanceModule,
  ModuleContext,
  ModuleStatus,
  TransactionImportedEvent,
} from "../../src/types/module.js";
import { requireRole, getSessionUser } from "../../src/middleware/rbac.js";

function createMyModule(): SmartFinanceModule {
  let initialized = false;
  let initError: string | undefined;

  return {
    id: "my-module", // unique kebab-case, used as URL prefix
    name: "My Module", // human-readable display name
    requiredRole: "USER", // "USER" or "ADMIN"

    async init(context: ModuleContext): Promise<void> {
      try {
        // Register routes — they will be available at /api/v1/modules/my-module/<path>
        context.app.get("/hello", { preHandler: requireRole("USER") }, async (request, reply) => {
          const user = getSessionUser(request);
          // Use context.storage for namespace-isolated persistence
          const data = await context.storage.get(user.id, "some-key");
          return reply.send({ hello: "world", stored: data });
        });
        initialized = true;
      } catch (err) {
        initError = String(err);
        throw err;
      }
    },

    getStatus(): ModuleStatus {
      const status: ModuleStatus = { initialized };
      if (initError !== undefined) status.error = initError;
      return status;
    },

    // Optional lifecycle hooks — implement only what you need
    async onTransactionImported(event: TransactionImportedEvent): Promise<void> {
      void event; // replace with real logic
    },
  };
}

export const myModule = createMyModule();
