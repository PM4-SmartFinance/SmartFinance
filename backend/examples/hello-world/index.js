import { requireRole, getSessionUser } from "../../src/middleware/rbac.js";
function createHelloWorldModule() {
  let initialized = false;
  let initError;
  return {
    id: "hello-world",
    name: "Hello World",
    requiredRole: "USER",
    async init(context) {
      try {
        context.app.get(
          "/greeting",
          { preHandler: requireRole("USER") },
          async (request, reply) => {
            const user = getSessionUser(request);
            const stored = await context.storage.get(user.id, "last-greeting");
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
            const { message } = request.body;
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
    getStatus() {
      return { initialized, error: initError };
    },
    async onTransactionImported(event) {
      // Example hook: log the import event (real modules would do meaningful work here)
      void event;
    },
  };
}
export const helloWorldModule = createHelloWorldModule();
