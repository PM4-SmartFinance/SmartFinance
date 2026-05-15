import { describe, it, expect, vi, beforeEach } from "vitest";
import { logEvent } from "./audit.service.js";
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

    const params = { action: "LOGIN_SUCCESS", userId: "user-1" };
    await expect(logEvent(params)).resolves.toBeUndefined();

    expect(mockError).toHaveBeenCalledWith(
      { err: dbError, ...params },
      "Failed to write to audit log",
    );
  });
});
