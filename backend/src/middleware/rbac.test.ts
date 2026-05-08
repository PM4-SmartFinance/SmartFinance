import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FastifyRequest } from "fastify";
import { ServiceError } from "../errors.js";

vi.mock("../prisma.js", () => ({
  prisma: {
    dimUser: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../services/audit.service.js", () => ({
  logEvent: vi.fn(),
}));

import { prisma } from "../prisma.js";
import * as auditService from "../services/audit.service.js";
import { verifySession } from "./rbac.js";

const findUnique = vi.mocked(prisma.dimUser.findUnique);
const logEvent = vi.mocked(auditService.logEvent);

const STORED_HASH = "$argon2id$v=19$m=65536,t=3,p=4$saltsalt$abcdef1234567890";
const VALID_PWD_VERSION = STORED_HASH.slice(-10); // "1234567890"

function buildRequest(sessionUser: unknown): FastifyRequest {
  const sessionDelete = vi.fn();
  const req = {
    session: {
      get: vi.fn().mockReturnValue(sessionUser),
      delete: sessionDelete,
    },
  } as unknown as FastifyRequest & { __sessionDelete: typeof sessionDelete };
  (req as unknown as { __sessionDelete: typeof sessionDelete }).__sessionDelete = sessionDelete;
  return req;
}

function getDeleteSpy(req: FastifyRequest) {
  return (req as unknown as { __sessionDelete: ReturnType<typeof vi.fn> }).__sessionDelete;
}

describe("verifySession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the session user when active and pwdVersion matches the stored hash", async () => {
    findUnique.mockResolvedValue({
      active: true,
      password: STORED_HASH,
      role: "USER",
    } as never);
    const req = buildRequest({
      id: "u-1",
      role: "USER",
      email: "u@x.com",
      pwdVersion: VALID_PWD_VERSION,
    });

    const user = await verifySession(req);

    expect(user).toMatchObject({ id: "u-1", role: "USER", email: "u@x.com" });
    expect(getDeleteSpy(req)).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("memoises the result per-request and only hits the DB once", async () => {
    findUnique.mockResolvedValue({
      active: true,
      password: STORED_HASH,
      role: "USER",
    } as never);
    const req = buildRequest({
      id: "u-1",
      role: "USER",
      email: "u@x.com",
      pwdVersion: VALID_PWD_VERSION,
    });

    await verifySession(req);
    await verifySession(req);
    await verifySession(req);

    expect(findUnique).toHaveBeenCalledOnce();
  });

  it("throws 401 (no audit, no delete) when there is no session at all", async () => {
    const req = buildRequest(undefined);

    await expect(verifySession(req)).rejects.toThrow(ServiceError);
    expect(findUnique).not.toHaveBeenCalled();
    expect(getDeleteSpy(req)).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("rejects a session whose user has been deleted (!dbUser)", async () => {
    findUnique.mockResolvedValue(null);
    const req = buildRequest({
      id: "ghost",
      role: "USER",
      email: "g@x.com",
      pwdVersion: VALID_PWD_VERSION,
    });

    await expect(verifySession(req)).rejects.toMatchObject({ statusCode: 401 });
    expect(getDeleteSpy(req)).toHaveBeenCalledOnce();
    expect(logEvent).toHaveBeenCalledWith("SESSION_INVALIDATED", "ghost", {
      reason: "user_missing",
    });
  });

  it("rejects a session whose user is deactivated (!dbUser.active)", async () => {
    findUnique.mockResolvedValue({
      active: false,
      password: STORED_HASH,
      role: "USER",
    } as never);
    const req = buildRequest({
      id: "u-2",
      role: "USER",
      email: "d@x.com",
      pwdVersion: VALID_PWD_VERSION,
    });

    await expect(verifySession(req)).rejects.toMatchObject({ statusCode: 401 });
    expect(getDeleteSpy(req)).toHaveBeenCalledOnce();
    expect(logEvent).toHaveBeenCalledWith("SESSION_INVALIDATED", "u-2", {
      reason: "user_inactive",
    });
  });

  it("rejects a legacy session that has no pwdVersion (fail-closed backward-compat path)", async () => {
    findUnique.mockResolvedValue({
      active: true,
      password: STORED_HASH,
      role: "USER",
    } as never);
    // No pwdVersion field — represents a session minted before the feature.
    const req = buildRequest({ id: "u-3", role: "USER", email: "old@x.com" });

    await expect(verifySession(req)).rejects.toMatchObject({ statusCode: 401 });
    expect(getDeleteSpy(req)).toHaveBeenCalledOnce();
    expect(logEvent).toHaveBeenCalledWith("SESSION_INVALIDATED", "u-3", {
      reason: "pwd_version_missing",
    });
  });

  it("rejects a session whose pwdVersion no longer matches the stored hash", async () => {
    findUnique.mockResolvedValue({
      active: true,
      password: STORED_HASH,
      role: "USER",
    } as never);
    const req = buildRequest({
      id: "u-4",
      role: "USER",
      email: "rotated@x.com",
      pwdVersion: "STALEslice",
    });

    await expect(verifySession(req)).rejects.toMatchObject({ statusCode: 401 });
    expect(getDeleteSpy(req)).toHaveBeenCalledOnce();
    expect(logEvent).toHaveBeenCalledWith("SESSION_INVALIDATED", "u-4", {
      reason: "pwd_version_mismatch",
    });
  });

  it("does NOT cache when verification fails — a later call with a fresh DB result still re-validates", async () => {
    findUnique.mockResolvedValueOnce(null);
    const req = buildRequest({
      id: "u-5",
      role: "USER",
      email: "r@x.com",
      pwdVersion: VALID_PWD_VERSION,
    });

    await expect(verifySession(req)).rejects.toMatchObject({ statusCode: 401 });

    findUnique.mockResolvedValueOnce({
      active: true,
      password: STORED_HASH,
      role: "USER",
    } as never);

    // Second call on the same request: cache must be empty since first attempt
    // threw — verifySession should hit the DB again.
    await expect(verifySession(req)).resolves.toMatchObject({ id: "u-5" });
    expect(findUnique).toHaveBeenCalledTimes(2);
  });
});
