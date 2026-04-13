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
    await logEvent("USER_CREATED", "user-1", { email: "a@b.com" });

    expect(auditRepo.createAuditLog).toHaveBeenCalledWith({
      action: "USER_CREATED",
      userId: "user-1",
      details: JSON.stringify({ email: "a@b.com" }),
    });
  });

  it("stores null details when none are provided", async () => {
    await logEvent("LOGOUT", "user-1");

    expect(auditRepo.createAuditLog).toHaveBeenCalledWith({
      action: "LOGOUT",
      userId: "user-1",
      details: null,
    });
  });

  it("logs an error instead of throwing when the repository fails", async () => {
    const dbError = new Error("connection refused");
    vi.mocked(auditRepo.createAuditLog).mockRejectedValueOnce(dbError);

    await expect(logEvent("LOGIN_SUCCESS", "user-1")).resolves.toBeUndefined();

    expect(mockError).toHaveBeenCalledWith(
      { err: dbError, action: "LOGIN_SUCCESS", userId: "user-1" },
      "Failed to write to audit log",
    );
  });
});
