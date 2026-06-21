import { describe, it, expect, vi, beforeEach } from "vitest";
import { logEvent, logEventCritical } from "./audit.service.js";
import * as auditRepo from "../repositories/audit.repository.js";
import * as loggerModule from "../logger.js";

vi.mock("../repositories/audit.repository.js", () => ({
  createAuditLog: vi.fn(),
}));

vi.mock("../logger.js", () => ({
  getLogger: vi.fn(),
}));

describe("audit.service", () => {
  const mockError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loggerModule.getLogger).mockReturnValue({
      error: mockError,
    } as never);
  });

  it("creates an audit log entry via the repository", async () => {
    const params = {
      action: "USER_CREATED",
      userId: "user-1",
      changedValues: { email: "a@b.com" },
    };
    await logEvent(params);

    expect(auditRepo.createAuditLog).toHaveBeenCalledWith(params);
  });

  it("stores null details when none are provided", async () => {
    const params = { action: "LOGOUT", userId: "user-1" };
    await logEvent(params);

    expect(auditRepo.createAuditLog).toHaveBeenCalledWith(params);
  });

  it("logs an error instead of throwing when the repository fails", async () => {
    const dbError = new Error("connection refused");
    vi.mocked(auditRepo.createAuditLog).mockRejectedValueOnce(dbError);

    const params = {
      action: "LOGIN_SUCCESS",
      userId: "user-1",
      changedValues: { email: "redacted@example.com" },
    };
    await expect(logEvent(params)).resolves.toBeUndefined();

    // Only safe metadata — never `previousValues`/`changedValues`/`reason` —
    // ends up in the Pino error meta. The audit-table failure must not leak
    // PII into unstructured stdout logs.
    expect(mockError).toHaveBeenCalledWith(
      { err: dbError, action: "LOGIN_SUCCESS", userId: "user-1", transactionId: undefined },
      "Failed to write to audit log",
    );
  });

  describe("logEventCritical", () => {
    it("rethrows when the repository fails", async () => {
      const dbError = new Error("audit insert failed");
      vi.mocked(auditRepo.createAuditLog).mockRejectedValueOnce(dbError);

      await expect(
        logEventCritical({ action: "TRANSACTION_DELETE", userId: "u-1", transactionId: "t-1" }),
      ).rejects.toBe(dbError);
    });

    it("forwards the active transaction client to the repository", async () => {
      const tx = { tag: "tx-sentinel" };
      await logEventCritical(
        { action: "TRANSACTION_EDIT", userId: "u-1", transactionId: "t-1" },
        tx as never,
      );
      expect(auditRepo.createAuditLog).toHaveBeenCalledWith(
        { action: "TRANSACTION_EDIT", userId: "u-1", transactionId: "t-1" },
        tx,
      );
    });
  });
});
