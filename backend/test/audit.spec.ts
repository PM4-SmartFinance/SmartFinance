import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../src/prisma.js";
import { buildApp } from "../src/app.js";
import type { FastifyInstance } from "fastify";
import * as auditRepo from "../src/repositories/audit.repository.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  // Clean up any leftover audit entries from previous runs
  await prisma.auditLog.deleteMany({
    where: { action: { startsWith: "TEST_" } },
  });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({
    where: { action: { startsWith: "TEST_" } },
  });
  await app.close();
});

describe("audit repository — database writes", () => {
  it("persists an audit log entry with all fields", async () => {
    const entry = await auditRepo.createAuditLog({
      action: "TEST_ACTION",
      userId: "test-user-id",
      transactionId: "test-tx-id",
      previousValues: { foo: "old" },
      changedValues: { foo: "new" },
      reason: "Correction",
    });

    expect(entry).toMatchObject({
      action: "TEST_ACTION",
      userId: "test-user-id",
      transactionId: "test-tx-id",
      previousValues: { foo: "old" },
      changedValues: { foo: "new" },
      reason: "Correction",
    });
    expect(entry.id).toBeDefined();
    expect(entry.createdAt).toBeInstanceOf(Date);
  });

  it("persists an audit log entry with null optional fields", async () => {
    const entry = await auditRepo.createAuditLog({
      action: "TEST_NULL_FIELDS",
    });

    expect(entry).toMatchObject({
      action: "TEST_NULL_FIELDS",
      userId: null,
      transactionId: null,
      previousValues: null,
      changedValues: null,
      reason: null,
    });
  });

  it("can be queried back after creation", async () => {
    await auditRepo.createAuditLog({
      action: "TEST_QUERY",
      userId: "query-user",
      changedValues: { found: true },
    });

    const found = await prisma.auditLog.findFirst({
      where: { action: "TEST_QUERY", userId: "query-user" },
    });

    expect(found).toBeTruthy();
    expect(found?.changedValues).toEqual({ found: true });
  });
});
