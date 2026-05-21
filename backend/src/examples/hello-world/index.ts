import type {
  SmartFinanceModule,
  ModuleContext,
  ModuleStatus,
  TransactionImportedEvent,
} from "../../types/module.js";
import { requireRole, getSessionUser } from "../../middleware/rbac.js";

function createHelloWorldModule(): SmartFinanceModule {
  let initialized = false;
  let initError: string | undefined;

  return {
    id: "hello-world",
    name: "Hello World",
    requiredRole: "USER",

    async init(context: ModuleContext): Promise<void> {
      try {
        context.app.get(
          "/greeting",
          { preHandler: requireRole("USER") },
          async (request, reply) => {
            const user = getSessionUser(request);
            const stored = (await context.storage.get(user.id, "last-greeting")) as string | null;
            return reply.send({
              message: "Hello from hello-world module!",
              lastGreeting: stored ?? null,
            });
          },
        );

        context.app.post(
          "/greeting",
          {
            preHandler: requireRole("USER"),
            schema: {
              body: {
                type: "object",
                required: ["message"],
                properties: { message: { type: "string", minLength: 1, maxLength: 255 } },
              },
            },
          },
          async (request, reply) => {
            const user = getSessionUser(request);
            const { message } = request.body as { message: string };
            await context.storage.set(user.id, "last-greeting", message);
            return reply.status(201).send({ stored: message });
          },
        );

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

    async onTransactionImported(event: TransactionImportedEvent): Promise<void> {
      // Example hook: log the import event (real modules would do meaningful work here)
      void event;
    },
  };
}

export const helloWorldModule = createHelloWorldModule();
