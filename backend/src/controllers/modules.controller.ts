import type { FastifyInstance } from "fastify";
import { requireRole } from "../middleware/rbac.js";
import * as moduleRegistry from "../services/module-registry.service.js";
import * as navItemRegistry from "../services/nav-item-registry.service.js";
import * as widgetRegistry from "../services/widget-registry.service.js";

export async function moduleRoutes(app: FastifyInstance): Promise<void> {
  app.get("/modules", { preHandler: requireRole("USER") }, async (_request, reply) => {
    const modules = moduleRegistry.getAllModules().map(({ id, name, requiredRole, status }) => ({
      id,
      name,
      requiredRole,
      status: { initialized: status.initialized },
    }));
    return reply.send({ modules });
  });

  app.get<{ Params: { moduleId: string } }>(
    "/modules/:moduleId/status",
    { preHandler: requireRole("ADMIN") },
    async (request, reply) => {
      const { moduleId } = request.params;
      const mod = moduleRegistry.getModule(moduleId);
      if (!mod) {
        return reply.status(404).send({ message: "Module not found" });
      }
      return reply.send({ id: mod.id, name: mod.name, status: mod.getStatus() });
    },
  );

  app.get("/modules/nav-items", { preHandler: requireRole("USER") }, async (_request, reply) => {
    return reply.send({ navItems: navItemRegistry.getAllNavItems() });
  });

  app.get("/modules/widgets", { preHandler: requireRole("USER") }, async (_request, reply) => {
    return reply.send({ widgets: widgetRegistry.getAllWidgets() });
  });
}
