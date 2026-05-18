import { describe, it, expect, vi, beforeEach } from "vitest";
import { login, recordLogout } from "./auth.service.js";
import * as userRepository from "../repositories/user.repository.js";
import * as auditService from "./audit.service.js";

vi.mock("../repositories/user.repository.js");
vi.mock("./audit.service.js", () => ({
  logEvent: vi.fn(),
}));

// Stub argon2 to avoid real hashing in unit tests
vi.mock("argon2", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-password"),
    verify: vi.fn().mockResolvedValue(true),
  },
}));

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  password: "hashed-password",
  role: "USER",
};

const mockCurrency = { id: "currency-1", code: "CHF", name: "Swiss Franc" };

describe("auth.service audit events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userRepository.findByEmailWithPassword).mockResolvedValue(null);
    vi.mocked(userRepository.findCurrencyByCode).mockResolvedValue(mockCurrency as never);
  });

  it("fires LOGIN_SUCCESS on successful login", async () => {
    vi.mocked(userRepository.findByEmailWithPassword).mockResolvedValue(mockUser as never);

    await login("test@example.com", "Password123!");

    expect(auditService.logEvent).toHaveBeenCalledWith({
      action: "LOGIN_SUCCESS",
      userId: "user-1",
      changedValues: {
        email: "test@example.com",
      },
    });
  });

  it("returns only the session-safe fields — never the full password hash", async () => {
    vi.mocked(userRepository.findByEmailWithPassword).mockResolvedValue({
      ...mockUser,
      password: "$argon2id$v=19$m=65536$saltsalt$abcdef1234567890",
    } as never);

    const result = await login("test@example.com", "Password123!");

    expect(result).toEqual({
      id: "user-1",
      role: "USER",
      email: "test@example.com",
      pwdVersion: "1234567890",
    });
    expect(result).not.toHaveProperty("password");
  });

  it("fires LOGIN_FAILED when user does not exist", async () => {
    vi.mocked(userRepository.findByEmailWithPassword).mockResolvedValue(null);

    await expect(login("ghost@example.com", "Password123!")).rejects.toThrow();

    expect(auditService.logEvent).toHaveBeenCalledWith({
      action: "LOGIN_FAILED",
      changedValues: {
        email: "ghost@example.com",
      },
    });
  });

  it("fires LOGIN_FAILED when password is wrong", async () => {
    vi.mocked(userRepository.findByEmailWithPassword).mockResolvedValue(mockUser as never);
    const argon2 = await import("argon2");
    vi.mocked(argon2.default.verify).mockResolvedValueOnce(false);

    await expect(login("test@example.com", "WrongPass!")).rejects.toThrow();

    expect(auditService.logEvent).toHaveBeenCalledWith({
      action: "LOGIN_FAILED",
      changedValues: {
        email: "test@example.com",
      },
    });
  });

  it("fires LOGOUT when userId is provided", async () => {
    await recordLogout("user-1");

    expect(auditService.logEvent).toHaveBeenCalledWith({
      action: "LOGOUT",
      userId: "user-1",
    });
  });

  it("does not fire LOGOUT when userId is null", async () => {
    await recordLogout(null);

    expect(auditService.logEvent).not.toHaveBeenCalled();
  });
});
