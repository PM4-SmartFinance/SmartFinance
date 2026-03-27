import { describe, it, expect, vi, beforeEach } from "vitest";
import { register, login, recordLogout } from "./auth.service.js";
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
    vi.mocked(userRepository.findByEmail).mockResolvedValue(null);
    vi.mocked(userRepository.findCurrencyByCode).mockResolvedValue(mockCurrency);
    vi.mocked(userRepository.createUser).mockResolvedValue(mockUser);
  });

  it("fires USER_CREATED on successful registration", async () => {
    await register("test@example.com", "Password123!");

    expect(auditService.logEvent).toHaveBeenCalledWith("USER_CREATED", "user-1", {
      email: "test@example.com",
      role: "USER",
    });
  });

  it("fires LOGIN_SUCCESS on successful login", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(mockUser);

    await login("test@example.com", "Password123!");

    expect(auditService.logEvent).toHaveBeenCalledWith("LOGIN_SUCCESS", "user-1", {
      email: "test@example.com",
    });
  });

  it("fires LOGIN_FAILED when user does not exist", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

    await expect(login("ghost@example.com", "Password123!")).rejects.toThrow();

    expect(auditService.logEvent).toHaveBeenCalledWith("LOGIN_FAILED", null, {
      email: "ghost@example.com",
    });
  });

  it("fires LOGIN_FAILED when password is wrong", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(mockUser);
    const argon2 = await import("argon2");
    vi.mocked(argon2.default.verify).mockResolvedValueOnce(false);

    await expect(login("test@example.com", "WrongPass!")).rejects.toThrow();

    expect(auditService.logEvent).toHaveBeenCalledWith("LOGIN_FAILED", null, {
      email: "test@example.com",
    });
  });

  it("fires LOGOUT when userId is provided", async () => {
    await recordLogout("user-1");

    expect(auditService.logEvent).toHaveBeenCalledWith("LOGOUT", "user-1");
  });

  it("does not fire LOGOUT when userId is null", async () => {
    await recordLogout(null);

    expect(auditService.logEvent).not.toHaveBeenCalled();
  });
});
