import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import { createSavingsGoalsModule } from "./index.js";
import type { ModuleStorageAdapter, SmartFinanceModule } from "../../types/module.js";

let sessionUser: { id: string; role: string; email: string; pwdVersion?: string } | undefined = {
  id: "user-1",
  role: "USER",
  email: "test@example.com",
  pwdVersion: "1234567890",
};

vi.mock("../../prisma.js", () => ({
  prisma: {
    dimUser: {
      findUnique: vi.fn().mockResolvedValue({
        active: true,
        password: "mocked-hash-1234567890",
        role: "USER",
      }),
    },
  },
}));

function createInMemoryStorage(): ModuleStorageAdapter & {
  reset(): void;
  raw(): Map<string, unknown>;
  seedRaw(userId: string, key: string, value: unknown): void;
} {
  const data = new Map<string, unknown>();
  return {
    async get(userId, key) {
      return data.get(`${userId}:${key}`) ?? null;
    },
    async set(userId, key, value) {
      data.set(`${userId}:${key}`, value);
    },
    async delete(userId, key) {
      data.delete(`${userId}:${key}`);
    },
    async list(userId) {
      const prefix = `${userId}:`;
      const out: Array<{ key: string; value: unknown }> = [];
      for (const [k, v] of data) {
        if (k.startsWith(prefix)) {
          out.push({ key: k.slice(prefix.length), value: v });
        }
      }
      out.sort((a, b) => a.key.localeCompare(b.key));
      return out;
    },
    reset() {
      data.clear();
    },
    raw() {
      return data;
    },
    seedRaw(userId, key, value) {
      data.set(`${userId}:${key}`, value);
    },
  };
}

describe("savings-goals module", () => {
  let app: FastifyInstance;
  let storage: ReturnType<typeof createInMemoryStorage>;
  let module: SmartFinanceModule;
  const registerNavItem = vi.fn();
  const registerWidget = vi.fn();
  const registerImporter = vi.fn();

  beforeAll(async () => {
    storage = createInMemoryStorage();
    module = createSavingsGoalsModule();
    app = Fastify({ logger: false });
    app.decorateRequest("session", null);
    app.addHook("onRequest", async (request) => {
      Object.defineProperty(request, "session", {
        configurable: true,
        value: { get: () => sessionUser, set: vi.fn() },
      });
    });
    await app.register(
      async (scopedApp) => {
        await module.init({
          app: scopedApp,
          storage,
          logger: scopedApp.log,
          registerImporter,
          registerNavItem,
          registerWidget,
        });
      },
      { prefix: "/api/v1/modules/savings-goals" },
    );
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    sessionUser = {
      id: "user-1",
      role: "USER",
      email: "test@example.com",
      pwdVersion: "1234567890",
    };
    storage.reset();
  });

  describe("init", () => {
    it("marks the module as initialized after init", () => {
      expect(module.getStatus()).toEqual({ initialized: true });
    });

    it("registers a nav item pointing to /modules/savings-goals", () => {
      expect(registerNavItem).toHaveBeenCalledWith({
        label: "Savings Goals",
        path: "/modules/savings-goals",
      });
    });

    it("registers a widget with the goals/widget data endpoint", () => {
      expect(registerWidget).toHaveBeenCalledWith({
        widgetId: "savings-goals-summary",
        title: "Savings Goals",
        dataEndpoint: "/modules/savings-goals/goals/widget",
      });
    });
  });

  describe("GET /goals", () => {
    it("returns 200 with an empty array for a user with no goals", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/modules/savings-goals/goals",
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ goals: [] });
    });

    it("returns 401 when unauthenticated", async () => {
      sessionUser = undefined;
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/modules/savings-goals/goals",
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /goals", () => {
    it("creates a goal and returns 201 with the new goal", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/modules/savings-goals/goals",
        payload: { name: "Emergency Fund", targetAmount: 5000 },
      });
      expect(response.statusCode).toBe(201);
      const { goal } = response.json<{
        goal: { id: string; name: string; targetAmount: number; currentAmount: number };
      }>();
      expect(goal.name).toBe("Emergency Fund");
      expect(goal.targetAmount).toBe(5000);
      expect(goal.currentAmount).toBe(0);
      expect(goal.id).toBeTruthy();
    });

    it("persists each goal under a goals:<id> key (not a single array)", async () => {
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/modules/savings-goals/goals",
        payload: { name: "Solo", targetAmount: 100 },
      });
      const { goal } = createRes.json<{ goal: { id: string } }>();
      const stored = storage.raw();
      expect(stored.has(`user-1:goals:${goal.id}`)).toBe(true);
      expect(stored.has("user-1:goals")).toBe(false);
    });

    it("trims whitespace from the goal name", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/modules/savings-goals/goals",
        payload: { name: "  Vacation  ", targetAmount: 2000 },
      });
      expect(response.statusCode).toBe(201);
      expect(response.json().goal.name).toBe("Vacation");
    });

    it("returns 400 when name is missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/modules/savings-goals/goals",
        payload: { targetAmount: 1000 },
      });
      expect(response.statusCode).toBe(400);
    });

    it("returns 400 when name is an empty string", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/modules/savings-goals/goals",
        payload: { name: "   ", targetAmount: 1000 },
      });
      expect(response.statusCode).toBe(400);
    });

    it("returns 400 when targetAmount is zero", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/modules/savings-goals/goals",
        payload: { name: "Goal", targetAmount: 0 },
      });
      expect(response.statusCode).toBe(400);
    });

    it("returns 400 when targetAmount is negative", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/modules/savings-goals/goals",
        payload: { name: "Goal", targetAmount: -100 },
      });
      expect(response.statusCode).toBe(400);
    });

    it("returns 401 when unauthenticated", async () => {
      sessionUser = undefined;
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/modules/savings-goals/goals",
        payload: { name: "Goal", targetAmount: 500 },
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /goals/widget", () => {
    it("returns items array and emptyMessage for a user with no goals", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/modules/savings-goals/goals/widget",
      });
      expect(response.statusCode).toBe(200);
      const body = response.json<{ items: unknown[]; emptyMessage: string }>();
      expect(body.emptyMessage).toBeTruthy();
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items).toHaveLength(0);
    });

    it("includes progress percentage for each goal", async () => {
      await app.inject({
        method: "POST",
        url: "/api/v1/modules/savings-goals/goals",
        payload: { name: "New Car", targetAmount: 10000 },
      });
      const listRes = await app.inject({
        method: "GET",
        url: "/api/v1/modules/savings-goals/goals",
      });
      const { goals } = listRes.json<{ goals: Array<{ id: string; name: string }> }>();
      const goalId = goals.find((g) => g.name === "New Car")!.id;

      await app.inject({
        method: "PATCH",
        url: `/api/v1/modules/savings-goals/goals/${goalId}`,
        payload: { currentAmount: 2500 },
      });

      const widgetRes = await app.inject({
        method: "GET",
        url: "/api/v1/modules/savings-goals/goals/widget",
      });
      const { items } = widgetRes.json<{
        items: Array<{ id: string; label: string; detail: string; progress: number }>;
      }>();
      const item = items.find((i) => i.label === "New Car");
      expect(item).toBeDefined();
      expect(item!.progress).toBe(25);
      expect(item!.detail).toContain("2500.00");
    });

    it("caps progress at 100 when currentAmount exceeds targetAmount", async () => {
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/modules/savings-goals/goals",
        payload: { name: "Overshot Goal", targetAmount: 1000 },
      });
      const { goal } = createRes.json<{ goal: { id: string } }>();

      await app.inject({
        method: "PATCH",
        url: `/api/v1/modules/savings-goals/goals/${goal.id}`,
        payload: { currentAmount: 1500 },
      });

      const widgetRes = await app.inject({
        method: "GET",
        url: "/api/v1/modules/savings-goals/goals/widget",
      });
      const { items } = widgetRes.json<{
        items: Array<{ label: string; progress: number }>;
      }>();
      const item = items.find((i) => i.label === "Overshot Goal");
      expect(item).toBeDefined();
      expect(item!.progress).toBe(100);
    });

    it("returns 401 when unauthenticated", async () => {
      sessionUser = undefined;
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/modules/savings-goals/goals/widget",
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe("PATCH /goals/:goalId", () => {
    it("updates the goal name", async () => {
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/modules/savings-goals/goals",
        payload: { name: "Old Name", targetAmount: 3000 },
      });
      const { goal } = createRes.json<{ goal: { id: string } }>();

      const patchRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/modules/savings-goals/goals/${goal.id}`,
        payload: { name: "New Name" },
      });
      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.json().goal.name).toBe("New Name");
    });

    it("updates currentAmount", async () => {
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/modules/savings-goals/goals",
        payload: { name: "House", targetAmount: 50000 },
      });
      const { goal } = createRes.json<{ goal: { id: string } }>();

      const patchRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/modules/savings-goals/goals/${goal.id}`,
        payload: { currentAmount: 12000 },
      });
      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.json().goal.currentAmount).toBe(12000);
    });

    it("returns 404 when the goal does not exist", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/modules/savings-goals/goals/non-existent-id",
        payload: { name: "Updated" },
      });
      expect(response.statusCode).toBe(404);
    });

    it("returns 400 when targetAmount is zero", async () => {
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/modules/savings-goals/goals",
        payload: { name: "Bike", targetAmount: 800 },
      });
      const { goal } = createRes.json<{ goal: { id: string } }>();

      const patchRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/modules/savings-goals/goals/${goal.id}`,
        payload: { targetAmount: 0 },
      });
      expect(patchRes.statusCode).toBe(400);
    });

    it("returns 400 when currentAmount is negative", async () => {
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/modules/savings-goals/goals",
        payload: { name: "Laptop", targetAmount: 1200 },
      });
      const { goal } = createRes.json<{ goal: { id: string } }>();

      const patchRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/modules/savings-goals/goals/${goal.id}`,
        payload: { currentAmount: -1 },
      });
      expect(patchRes.statusCode).toBe(400);
    });

    it("returns 401 when unauthenticated", async () => {
      sessionUser = undefined;
      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/modules/savings-goals/goals/some-id",
        payload: { name: "Updated" },
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe("DELETE /goals/:goalId", () => {
    it("deletes the goal and returns 204", async () => {
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/modules/savings-goals/goals",
        payload: { name: "To Delete", targetAmount: 100 },
      });
      const { goal } = createRes.json<{ goal: { id: string } }>();

      const deleteRes = await app.inject({
        method: "DELETE",
        url: `/api/v1/modules/savings-goals/goals/${goal.id}`,
      });
      expect(deleteRes.statusCode).toBe(204);
    });

    it("the goal is gone after deletion", async () => {
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/modules/savings-goals/goals",
        payload: { name: "Temporary", targetAmount: 200 },
      });
      const { goal } = createRes.json<{ goal: { id: string } }>();

      await app.inject({
        method: "DELETE",
        url: `/api/v1/modules/savings-goals/goals/${goal.id}`,
      });

      const listRes = await app.inject({
        method: "GET",
        url: "/api/v1/modules/savings-goals/goals",
      });
      const { goals } = listRes.json<{ goals: Array<{ id: string }> }>();
      expect(goals.find((g) => g.id === goal.id)).toBeUndefined();
    });

    it("returns 404 for a non-existent goal id", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/modules/savings-goals/goals/non-existent-id",
      });
      expect(response.statusCode).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      sessionUser = undefined;
      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/modules/savings-goals/goals/some-id",
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe("cross-user data isolation", () => {
    it("user-2 cannot see goals created by user-1", async () => {
      sessionUser = {
        id: "user-1",
        role: "USER",
        email: "u1@example.com",
        pwdVersion: "1234567890",
      };
      await app.inject({
        method: "POST",
        url: "/api/v1/modules/savings-goals/goals",
        payload: { name: "User1 Goal", targetAmount: 1000 },
      });

      sessionUser = {
        id: "user-2",
        role: "USER",
        email: "u2@example.com",
        pwdVersion: "1234567890",
      };
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/modules/savings-goals/goals",
      });
      expect(response.statusCode).toBe(200);
      const { goals } = response.json<{ goals: Array<{ name: string }> }>();
      expect(goals.find((g) => g.name === "User1 Goal")).toBeUndefined();
    });

    it("user-2 goals are stored independently of user-1 goals", async () => {
      sessionUser = {
        id: "user-1",
        role: "USER",
        email: "u1@example.com",
        pwdVersion: "1234567890",
      };
      await app.inject({
        method: "POST",
        url: "/api/v1/modules/savings-goals/goals",
        payload: { name: "User1 Exclusive", targetAmount: 500 },
      });

      sessionUser = {
        id: "user-2",
        role: "USER",
        email: "u2@example.com",
        pwdVersion: "1234567890",
      };
      await app.inject({
        method: "POST",
        url: "/api/v1/modules/savings-goals/goals",
        payload: { name: "User2 Exclusive", targetAmount: 800 },
      });

      const u2Res = await app.inject({
        method: "GET",
        url: "/api/v1/modules/savings-goals/goals",
      });
      const { goals: u2Goals } = u2Res.json<{ goals: Array<{ name: string }> }>();
      expect(u2Goals.some((g) => g.name === "User2 Exclusive")).toBe(true);
      expect(u2Goals.some((g) => g.name === "User1 Exclusive")).toBe(false);

      sessionUser = {
        id: "user-1",
        role: "USER",
        email: "u1@example.com",
        pwdVersion: "1234567890",
      };
      const u1Res = await app.inject({
        method: "GET",
        url: "/api/v1/modules/savings-goals/goals",
      });
      const { goals: u1Goals } = u1Res.json<{ goals: Array<{ name: string }> }>();
      expect(u1Goals.some((g) => g.name === "User1 Exclusive")).toBe(true);
      expect(u1Goals.some((g) => g.name === "User2 Exclusive")).toBe(false);
    });

    it("user-2 PATCH on user-1's goalId returns 404 (IDOR guard)", async () => {
      sessionUser = {
        id: "user-1",
        role: "USER",
        email: "u1@example.com",
        pwdVersion: "1234567890",
      };
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/modules/savings-goals/goals",
        payload: { name: "User1 Only", targetAmount: 100 },
      });
      const { goal } = createRes.json<{ goal: { id: string } }>();

      sessionUser = {
        id: "user-2",
        role: "USER",
        email: "u2@example.com",
        pwdVersion: "1234567890",
      };
      const patchRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/modules/savings-goals/goals/${goal.id}`,
        payload: { name: "Hijacked" },
      });
      expect(patchRes.statusCode).toBe(404);

      // The original goal must remain unchanged.
      sessionUser = {
        id: "user-1",
        role: "USER",
        email: "u1@example.com",
        pwdVersion: "1234567890",
      };
      const listRes = await app.inject({
        method: "GET",
        url: "/api/v1/modules/savings-goals/goals",
      });
      const { goals } = listRes.json<{ goals: Array<{ id: string; name: string }> }>();
      expect(goals.find((g) => g.id === goal.id)?.name).toBe("User1 Only");
    });

    it("user-2 DELETE on user-1's goalId returns 404 (IDOR guard)", async () => {
      sessionUser = {
        id: "user-1",
        role: "USER",
        email: "u1@example.com",
        pwdVersion: "1234567890",
      };
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/modules/savings-goals/goals",
        payload: { name: "User1 Protected", targetAmount: 200 },
      });
      const { goal } = createRes.json<{ goal: { id: string } }>();

      sessionUser = {
        id: "user-2",
        role: "USER",
        email: "u2@example.com",
        pwdVersion: "1234567890",
      };
      const deleteRes = await app.inject({
        method: "DELETE",
        url: `/api/v1/modules/savings-goals/goals/${goal.id}`,
      });
      expect(deleteRes.statusCode).toBe(404);

      sessionUser = {
        id: "user-1",
        role: "USER",
        email: "u1@example.com",
        pwdVersion: "1234567890",
      };
      const listRes = await app.inject({
        method: "GET",
        url: "/api/v1/modules/savings-goals/goals",
      });
      const { goals } = listRes.json<{ goals: Array<{ id: string }> }>();
      expect(goals.find((g) => g.id === goal.id)).toBeDefined();
    });
  });

  describe("legacy storage migration", () => {
    it("splits a legacy 'goals' array key into per-record entries on first read", async () => {
      storage.seedRaw("user-1", "goals", [
        { id: "g1", name: "Legacy1", targetAmount: 100, currentAmount: 10 },
        { id: "g2", name: "Legacy2", targetAmount: 200, currentAmount: 20 },
      ]);

      const listRes = await app.inject({
        method: "GET",
        url: "/api/v1/modules/savings-goals/goals",
      });
      const { goals } = listRes.json<{ goals: Array<{ id: string; name: string }> }>();
      expect(goals.map((g) => g.id).sort()).toEqual(["g1", "g2"]);
      expect(goals.find((g) => g.id === "g1")!.name).toBe("Legacy1");

      const raw = storage.raw();
      expect(raw.has("user-1:goals")).toBe(false);
      expect(raw.has("user-1:goals:g1")).toBe(true);
      expect(raw.has("user-1:goals:g2")).toBe(true);
    });

    it("migration is idempotent: second read after migration shows the same goals", async () => {
      storage.seedRaw("user-1", "goals", [
        { id: "gA", name: "Once", targetAmount: 50, currentAmount: 5 },
      ]);
      await app.inject({
        method: "GET",
        url: "/api/v1/modules/savings-goals/goals",
      });
      const secondRes = await app.inject({
        method: "GET",
        url: "/api/v1/modules/savings-goals/goals",
      });
      const { goals } = secondRes.json<{ goals: Array<{ id: string }> }>();
      expect(goals).toHaveLength(1);
      expect(goals[0]!.id).toBe("gA");
    });

    it("ignores malformed entries inside a legacy array", async () => {
      storage.seedRaw("user-1", "goals", [
        { id: "valid", name: "OK", targetAmount: 10, currentAmount: 0 },
        { id: 42, name: "WrongIdType", targetAmount: 10, currentAmount: 0 },
        "not-an-object",
        null,
      ]);

      const listRes = await app.inject({
        method: "GET",
        url: "/api/v1/modules/savings-goals/goals",
      });
      const { goals } = listRes.json<{ goals: Array<{ id: string }> }>();
      expect(goals).toHaveLength(1);
      expect(goals[0]!.id).toBe("valid");
    });
  });

  describe("onTransactionImported hook", () => {
    it("is defined on the module", () => {
      expect(typeof module.onTransactionImported).toBe("function");
    });

    it("logs the import event via the module logger", async () => {
      const logSpy = vi.spyOn(app.log, "info");
      await module.onTransactionImported!({
        userId: "user-1",
        accountId: "acc-1",
        imported: 7,
      });
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          moduleId: "savings-goals",
          userId: "user-1",
          imported: 7,
        }),
        expect.stringContaining("transaction import event received"),
      );
      logSpy.mockRestore();
    });

    it("resolves silently when called on a freshly-created module (no init yet)", async () => {
      const fresh = createSavingsGoalsModule();
      await expect(
        fresh.onTransactionImported!({
          userId: "user-1",
          accountId: "acc-1",
          imported: 1,
        }),
      ).resolves.toBeUndefined();
    });
  });
});
