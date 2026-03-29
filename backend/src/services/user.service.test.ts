import { describe, it, expect, vi, beforeEach } from "vitest";
import { getProfile, updateProfile, changePassword } from "./user.service.js";
import * as userRepository from "../repositories/user.repository.js";
import * as auditService from "./audit.service.js";

vi.mock("../repositories/user.repository.js");
vi.mock("./audit.service.js", () => ({ logEvent: vi.fn() }));
vi.mock("argon2", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("new-hashed-password"),
    verify: vi.fn().mockResolvedValue(true),
  },
}));

const mockProfile = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  role: "USER",
  createdAt: new Date("2025-01-01"),
};

const mockUserWithPassword = {
  ...mockProfile,
  password: "hashed-password",
  defaultCurrencyId: "currency-1",
  updatedAt: new Date("2025-01-01"),
};

describe("getProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the user profile", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(mockProfile);

    const result = await getProfile("user-1");

    expect(result).toEqual(mockProfile);
    expect(userRepository.findById).toHaveBeenCalledExactlyOnceWith("user-1");
  });

  it("throws 404 when user does not exist", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(null);

    await expect(getProfile("ghost")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("updateProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates displayName and email", async () => {
    vi.mocked(userRepository.findByEmailExcluding).mockResolvedValue(null);
    vi.mocked(userRepository.updateProfile).mockResolvedValue({
      id: "user-1",
      email: "new@example.com",
      name: "New Name",
      role: "USER",
    });

    const result = await updateProfile("user-1", {
      displayName: "New Name",
      email: "new@example.com",
    });

    expect(userRepository.updateProfile).toHaveBeenCalledWith("user-1", {
      name: "New Name",
      email: "new@example.com",
    });
    expect(result).toMatchObject({ name: "New Name", email: "new@example.com" });
  });

  it("checks email uniqueness before updating", async () => {
    vi.mocked(userRepository.findByEmailExcluding).mockResolvedValue(null);
    vi.mocked(userRepository.updateProfile).mockResolvedValue({
      id: "user-1",
      email: "new@example.com",
      name: null,
      role: "USER",
    });

    await updateProfile("user-1", { email: "new@example.com" });

    expect(userRepository.findByEmailExcluding).toHaveBeenCalledWith("new@example.com", "user-1");
  });

  it("throws 409 when email is already taken by another user", async () => {
    vi.mocked(userRepository.findByEmailExcluding).mockResolvedValue(mockUserWithPassword);

    await expect(updateProfile("user-1", { email: "taken@example.com" })).rejects.toMatchObject({
      statusCode: 409,
    });

    expect(userRepository.updateProfile).not.toHaveBeenCalled();
  });

  it("skips the email uniqueness check when email is not provided", async () => {
    vi.mocked(userRepository.updateProfile).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Only Name Changed",
      role: "USER",
    });

    await updateProfile("user-1", { displayName: "Only Name Changed" });

    expect(userRepository.findByEmailExcluding).not.toHaveBeenCalled();
    expect(userRepository.updateProfile).toHaveBeenCalledWith("user-1", {
      name: "Only Name Changed",
    });
  });

  it("returns the current profile without hitting updateProfile when body is empty", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(mockProfile);

    await updateProfile("user-1", {});

    expect(userRepository.updateProfile).not.toHaveBeenCalled();
    expect(userRepository.findById).toHaveBeenCalledWith("user-1");
  });

  it("fires PROFILE_UPDATED audit event on success", async () => {
    vi.mocked(userRepository.findByEmailExcluding).mockResolvedValue(null);
    vi.mocked(userRepository.updateProfile).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test",
      role: "USER",
    });

    await updateProfile("user-1", { displayName: "Test" });

    expect(auditService.logEvent).toHaveBeenCalledWith("PROFILE_UPDATED", "user-1", {
      fields: ["name"],
    });
  });

  it("does not fire an audit event when body is empty", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(mockProfile);

    await updateProfile("user-1", {});

    expect(auditService.logEvent).not.toHaveBeenCalled();
  });
});

describe("changePassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("verifies the current password before updating", async () => {
    vi.mocked(userRepository.findByIdWithPassword).mockResolvedValue(mockUserWithPassword);
    vi.mocked(userRepository.updatePassword).mockResolvedValue({ id: "user-1" });
    const argon2 = await import("argon2");

    await changePassword("user-1", "correct-current", "NewPass123!");

    expect(argon2.default.verify).toHaveBeenCalledWith(
      mockUserWithPassword.password,
      "correct-current",
    );
  });

  it("throws 401 when the current password is wrong", async () => {
    vi.mocked(userRepository.findByIdWithPassword).mockResolvedValue(mockUserWithPassword);
    const argon2 = await import("argon2");
    vi.mocked(argon2.default.verify).mockResolvedValueOnce(false);

    await expect(changePassword("user-1", "wrong-password", "NewPass123!")).rejects.toMatchObject({
      statusCode: 401,
    });

    expect(userRepository.updatePassword).not.toHaveBeenCalled();
  });

  it("throws 404 when the user does not exist", async () => {
    vi.mocked(userRepository.findByIdWithPassword).mockResolvedValue(null);

    await expect(changePassword("ghost", "any", "NewPass123!")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("hashes the new password and persists it", async () => {
    vi.mocked(userRepository.findByIdWithPassword).mockResolvedValue(mockUserWithPassword);
    vi.mocked(userRepository.updatePassword).mockResolvedValue({ id: "user-1" });
    const argon2 = await import("argon2");

    await changePassword("user-1", "correct-current", "NewPass123!");

    expect(argon2.default.hash).toHaveBeenCalledWith("NewPass123!");
    expect(userRepository.updatePassword).toHaveBeenCalledWith("user-1", "new-hashed-password");
  });

  it("fires PASSWORD_CHANGED audit event on success", async () => {
    vi.mocked(userRepository.findByIdWithPassword).mockResolvedValue(mockUserWithPassword);
    vi.mocked(userRepository.updatePassword).mockResolvedValue({ id: "user-1" });

    await changePassword("user-1", "correct-current", "NewPass123!");

    expect(auditService.logEvent).toHaveBeenCalledWith("PASSWORD_CHANGED", "user-1");
  });
});
