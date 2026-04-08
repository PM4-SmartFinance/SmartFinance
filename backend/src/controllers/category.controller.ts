import type { FastifyInstance } from "fastify";
import { requireRole } from "../middleware/rbac.js";
import * as categoryService from "../services/category.service.js";
import { ServiceError } from "../errors.js";

export async function categoryRoutes(app: FastifyInstance): Promise<void> {
  // GET: List all categories (Global + User-specific)
  app.get("/categories", { preHandler: requireRole("USER") }, async (request, reply) => {
    const user = request.session.get("user");
    if (!user) throw new ServiceError(401, "Unauthorized");

    const categories = await categoryService.getAllCategories(user.id);
    return reply.status(200).send({ categories });
  });

  // POST: Create a new custom category
  app.post<{ Body: { categoryName: string } }>(
    "/categories",
    {
      preHandler: requireRole("USER"),
      schema: {
        body: {
          type: "object",
          required: ["categoryName"],
          additionalProperties: false,
          properties: {
            categoryName: { type: "string", minLength: 1, maxLength: 50 },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.session.get("user");
      if (!user) throw new ServiceError(401, "Unauthorized");

      const { categoryName } = request.body;
      const newCategory = await categoryService.createCategory(categoryName, user.id);
      return reply.status(201).send({ category: newCategory });
    },
  );

  // PATCH: Update category name
  app.patch<{ Params: { id: string }; Body: { categoryName: string } }>(
    "/categories/:id",
    {
      preHandler: requireRole("USER"),
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["categoryName"],
          additionalProperties: false,
          properties: {
            categoryName: { type: "string", minLength: 1, maxLength: 50 },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.session.get("user");
      if (!user) throw new ServiceError(401, "Unauthorized");

      const { id } = request.params;
      const { categoryName } = request.body;

      const updated = await categoryService.updateCategory(id, user.id, categoryName);
      return reply.status(200).send({ category: updated });
    },
  );

  // DELETE: Remove a category
  app.delete<{ Params: { id: string } }>(
    "/categories/:id",
    {
      preHandler: requireRole("USER"),
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request, reply) => {
      const user = request.session.get("user");
      if (!user) throw new ServiceError(401, "Unauthorized");

      const { id } = request.params;
      await categoryService.deleteCategory(id, user.id);
      return reply.status(204).send(); // 204 No Content
    },
  );
}
