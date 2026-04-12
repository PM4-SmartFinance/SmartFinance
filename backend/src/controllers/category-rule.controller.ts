import type { FastifyInstance } from "fastify";
import { requireRole } from "../middleware/rbac.js";
import * as categoryRuleService from "../services/category-rule.service.js";
import type { MatchType } from "../repositories/category-rule.repository.js";

interface RuleParams {
  id: string;
}

interface CreateRuleBody {
  pattern: string;
  matchType: MatchType;
  categoryId: string;
  priority: number;
}

interface UpdateRuleBody {
  pattern?: string;
  matchType?: MatchType;
  categoryId?: string;
  priority?: number;
}

const uuidPattern = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";

const ruleParamsSchema = {
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "string", pattern: uuidPattern },
  },
} as const;

const createRuleSchema = {
  type: "object",
  required: ["pattern", "matchType", "categoryId", "priority"],
  additionalProperties: false,
  properties: {
    pattern: { type: "string", minLength: 1 },
    matchType: { type: "string", enum: ["exact", "contains"] },
    categoryId: { type: "string", pattern: uuidPattern },
    priority: { type: "integer", minimum: 0 },
  },
} as const;

const updateRuleSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    pattern: { type: "string", minLength: 1 },
    matchType: { type: "string", enum: ["exact", "contains"] },
    categoryId: { type: "string", pattern: uuidPattern },
    priority: { type: "integer", minimum: 0 },
  },
  minProperties: 1,
} as const;

export async function categoryRuleRoutes(app: FastifyInstance): Promise<void> {
  app.get("/category-rules", { preHandler: requireRole("USER") }, async (request, reply) => {
    const session = request.session.get("user")!;
    const rules = await categoryRuleService.listRules(session.id);
    return reply.send({ rules });
  });

  app.post<{ Body: CreateRuleBody }>(
    "/category-rules/preview",
    { preHandler: requireRole("USER"), schema: { body: createRuleSchema } },
    async (request, reply) => {
      const session = request.session.get("user")!;
      const result = await categoryRuleService.previewRule(session.id, request.body);
      return reply.send(result);
    },
  );

  app.get<{ Params: RuleParams }>(
    "/category-rules/:id",
    { preHandler: requireRole("USER"), schema: { params: ruleParamsSchema } },
    async (request, reply) => {
      const session = request.session.get("user")!;
      const rule = await categoryRuleService.getRule(request.params.id, session.id);
      return reply.send({ rule });
    },
  );

  app.post<{ Body: CreateRuleBody }>(
    "/category-rules",
    { preHandler: requireRole("USER"), schema: { body: createRuleSchema } },
    async (request, reply) => {
      const session = request.session.get("user")!;
      const { pattern, matchType, categoryId, priority } = request.body;
      const rule = await categoryRuleService.createRule(
        session.id,
        categoryId,
        pattern,
        matchType,
        priority,
      );
      return reply.status(201).send({ rule });
    },
  );

  app.patch<{ Params: RuleParams; Body: UpdateRuleBody }>(
    "/category-rules/:id",
    {
      preHandler: requireRole("USER"),
      schema: { params: ruleParamsSchema, body: updateRuleSchema },
    },
    async (request, reply) => {
      const session = request.session.get("user")!;
      const rule = await categoryRuleService.updateRule(
        request.params.id,
        session.id,
        request.body,
      );
      return reply.send({ rule });
    },
  );

  app.delete<{ Params: RuleParams }>(
    "/category-rules/:id",
    { preHandler: requireRole("USER"), schema: { params: ruleParamsSchema } },
    async (request, reply) => {
      const session = request.session.get("user")!;
      await categoryRuleService.deleteRule(request.params.id, session.id);
      return reply.status(204).send();
    },
  );
}
