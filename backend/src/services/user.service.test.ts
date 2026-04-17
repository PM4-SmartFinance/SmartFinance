import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getProfile,
  updateProfile,
  changePassword,
  deleteUser,
  updateUser,
} from "./user.service.js";
import * as userRepository from "../repositories/user.repository.js";
import { EmailConflictError } from "../repositories/user.repository.js";
import * as auditService from "./audit.service.js";
import { ServiceError } from "../errors.js";

const mockArgon2 = vi.hoisted(() => ({
  verify: vi.fn().mockResolvedValue(true),
  hash: vi.fn().mockResolvedValue("new-hashed-password"),
}));

vi.mock("argon2", () => ({ default: mockArgon2 }));

vi.mock("../repositories/user.repository.js", () => ({
  findById: vi.fn(),
  findByIdWithPassword: vi.fn(),
  updateProfileAtomic: vi.fn(),
  updatePassword: vi.fn(),
  updateUserById: vi.fn(),
  EmailConflictError: class EmailConflictError extends Error {
    constructor() {
      super("Email already in use");
      this.name = "EmailConflictError";
    }
  },
}));

vi.mock("./audit.service.js", () => ({
  logEvent: vi.fn().mockResolvedValue(undefined),
}));

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  role: "USER",
  createdAt: new Date(),
};

const mockUserWithPassword = {
  id: "user-1",
  password: "hashed-password",
};

describe("user.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProfile", () => {
    it("returns user when found", async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(mockUser);

      const result = await getProfile("user-1");

      expect(userRepository.findById).toHaveBeenCalledWith("user-1");
      expect(result).toEqual(mockUser);
    });

    it("throws 404 ServiceError when user not found", async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(null);

      await expect(getProfile("unknown-id")).rejects.toThrow(ServiceError);
      await expect(getProfile("unknown-id")).rejects.toMatchObject({
        statusCode: 404,
        message: "User not found",
      });
    });
  });

  describe("updateProfile", () => {
    it("updates displayName and email when both are provided", async () => {
      const updatedUser = { ...mockUser, name: "New Name", email: "new@example.com" };
      vi.mocked(userRepository.updateProfileAtomic).mockResolvedValue(updatedUser);

      const result = await updateProfile("user-1", {
        displayName: "New Name",
        email: "new@example.com",
      });

      expect(userRepository.updateProfileAtomic).toHaveBeenCalledWith("user-1", {
        name: "New Name",
        email: "new@example.com",
      });
      expect(result).toEqual(updatedUser);
    });

    it("updates only displayName when only displayName is provided", async () => {
      const updatedUser = { ...mockUser, name: "New Name" };
      vi.mocked(userRepository.updateProfileAtomic).mockResolvedValue(updatedUser);

      await updateProfile("user-1", { displayName: "New Name" });

      expect(userRepository.updateProfileAtomic).toHaveBeenCalledWith("user-1", {
        name: "New Name",
      });
    });

    it("updates only email when only email is provided", async () => {
      const updatedUser = { ...mockUser, email: "new@example.com" };
      vi.mocked(userRepository.updateProfileAtomic).mockResolvedValue(updatedUser);

      await updateProfile("user-1", { email: "new@example.com" });

      expect(userRepository.updateProfileAtomic).toHaveBeenCalledWith("user-1", {
        email: "new@example.com",
      });
    });

    it("returns current user without updating when no fields are provided", async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(mockUser);

      const result = await updateProfile("user-1", {});

      expect(userRepository.updateProfileAtomic).not.toHaveBeenCalled();
      expect(userRepository.findById).toHaveBeenCalledWith("user-1");
      expect(result).toEqual(mockUser);
    });

    it("fires PROFILE_UPDATED audit event after successful update", async () => {
      vi.mocked(userRepository.updateProfileAtomic).mockResolvedValue(mockUser);

      await updateProfile("user-1", { displayName: "New Name" });

      await vi.waitFor(() => {
        expect(auditService.logEvent).toHaveBeenCalledWith("PROFILE_UPDATED", "user-1", {
          fields: ["name"],
        });
      });
    });

    it("throws 409 ServiceError when email is already in use", async () => {
      vi.mocked(userRepository.updateProfileAtomic).mockRejectedValue(new EmailConflictError());

      await expect(updateProfile("user-1", { email: "taken@example.com" })).rejects.toMatchObject({
        statusCode: 409,
        message: "Email already in use",
      });
    });

    it("rethrows unexpected errors from repository", async () => {
      const unexpectedError = new Error("DB connection lost");
      vi.mocked(userRepository.updateProfileAtomic).mockRejectedValue(unexpectedError);

      await expect(updateProfile("user-1", { email: "new@example.com" })).rejects.toThrow(
        "DB connection lost",
      );
    });
  });

  describe("changePassword", () => {
    it("hashes the new password and updates it", async () => {
      vi.mocked(userRepository.findByIdWithPassword).mockResolvedValue(mockUserWithPassword);
      vi.mocked(userRepository.updatePassword).mockResolvedValue({ id: "user-1" });

      await changePassword("user-1", "current-password", "new-password");

      expect(mockArgon2.verify).toHaveBeenCalledWith("hashed-password", "current-password");
      expect(mockArgon2.hash).toHaveBeenCalledWith("new-password");
      expect(userRepository.updatePassword).toHaveBeenCalledWith("user-1", "new-hashed-password");
    });

    it("throws 404 ServiceError when user not found", async () => {
      vi.mocked(userRepository.findByIdWithPassword).mockResolvedValue(null);

      await expect(changePassword("unknown-id", "current", "new")).rejects.toMatchObject({
        statusCode: 404,
        message: "User not found",
      });
    });

    it("throws 401 ServiceError when current password is incorrect", async () => {
      vi.mocked(userRepository.findByIdWithPassword).mockResolvedValue(mockUserWithPassword);
      mockArgon2.verify.mockResolvedValueOnce(false);

      await expect(
        changePassword("user-1", "wrong-password", "new-password"),
      ).rejects.toMatchObject({
        statusCode: 401,
        message: "Current password is incorrect",
      });
      expect(userRepository.updatePassword).not.toHaveBeenCalled();
    });

    it("fires PASSWORD_CHANGED audit event after successful change", async () => {
      vi.mocked(userRepository.findByIdWithPassword).mockResolvedValue(mockUserWithPassword);
      vi.mocked(userRepository.updatePassword).mockResolvedValue({ id: "user-1" });

      await changePassword("user-1", "current-password", "new-password");

      await vi.waitFor(() => {
        expect(auditService.logEvent).toHaveBeenCalledWith("PASSWORD_CHANGED", "user-1");
      });
    });
  });
});

const adminUser = { id: "admin-1", role: "ADMIN", email: "admin@example.com" };
const regularUser = { id: "user-2", role: "USER", email: "user@example.com" };

describe("deleteUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deactivates a regular user when called by an admin", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(regularUser);
    vi.mocked(userRepository.updateUserById).mockResolvedValue({ ...regularUser, active: false });

    await deleteUser(adminUser, regularUser.id);

    expect(userRepository.updateUserById).toHaveBeenCalledWith(regularUser.id, { active: false });
  });

  it("throws 403 when an admin attempts to delete another admin", async () => {
    const targetAdmin = { id: "admin-2", role: "ADMIN", email: "admin2@example.com" };
    vi.mocked(userRepository.findById).mockResolvedValue(targetAdmin);

    await expect(deleteUser(adminUser, targetAdmin.id)).rejects.toMatchObject({
      statusCode: 403,
      message: "Cannot delete an admin account",
    });

    expect(userRepository.updateUserById).not.toHaveBeenCalled();
  });

  it("throws 403 when a non-admin attempts to delete a different user", async () => {
    await expect(deleteUser(regularUser, "user-99")).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(userRepository.findById).not.toHaveBeenCalled();
    expect(userRepository.updateUserById).not.toHaveBeenCalled();
  });

  it("throws 401 when the requesting user is null", async () => {
    await expect(deleteUser(null, regularUser.id)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("throws 404 when the target user does not exist", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(null);

    await expect(deleteUser(adminUser, "ghost-id")).rejects.toMatchObject({
      statusCode: 404,
      message: "Not found",
    });

    expect(userRepository.updateUserById).not.toHaveBeenCalled();
  });

  it("throws 403 when an admin attempts to deactivate themselves", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(adminUser);

    await expect(deleteUser(adminUser, adminUser.id)).rejects.toMatchObject({
      statusCode: 403,
      message: "Cannot delete an admin account",
    });

    expect(userRepository.updateUserById).not.toHaveBeenCalled();
  });

  it("allows a regular user to deactivate themselves", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(regularUser);
    vi.mocked(userRepository.updateUserById).mockResolvedValue(undefined);

    await deleteUser(regularUser, regularUser.id);

    expect(userRepository.updateUserById).toHaveBeenCalledWith(regularUser.id, { active: false });
  });

  it("fires USER_DELETED audit event on successful deletion", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(regularUser);
    vi.mocked(userRepository.updateUserById).mockResolvedValue(undefined);

    await deleteUser(adminUser, regularUser.id);

    await vi.waitFor(() => {
      expect(auditService.logEvent).toHaveBeenCalledWith("USER_DELETED", adminUser.id, {
        targetUserId: regularUser.id,
        email: regularUser.email,
      });
    });
  });
});

describe("updateUser — deactivation guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws 403 when an admin attempts to deactivate another admin", async () => {
    const targetAdmin = { id: "admin-2", role: "ADMIN", email: "admin2@example.com" };
    vi.mocked(userRepository.findById).mockResolvedValue(targetAdmin);

    await expect(updateUser(adminUser, targetAdmin.id, { active: false })).rejects.toMatchObject({
      statusCode: 403,
      message: "Cannot deactivate an admin account",
    });

    expect(userRepository.updateUserById).not.toHaveBeenCalled();
  });

  it("throws 403 when an admin attempts to deactivate themselves via PATCH", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(adminUser);

    await expect(updateUser(adminUser, adminUser.id, { active: false })).rejects.toMatchObject({
      statusCode: 403,
      message: "Cannot deactivate an admin account",
    });

    expect(userRepository.updateUserById).not.toHaveBeenCalled();
  });

  it("throws 403 when an admin attempts to change another admin's role", async () => {
    const targetAdmin = { id: "admin-2", role: "ADMIN", email: "admin2@example.com" };
    vi.mocked(userRepository.findById).mockResolvedValue(targetAdmin);

    await expect(updateUser(adminUser, targetAdmin.id, { role: "USER" })).rejects.toMatchObject({
      statusCode: 403,
      message: "Cannot modify another admin account",
    });

    expect(userRepository.updateUserById).not.toHaveBeenCalled();
  });

  it("allows an admin to deactivate a regular user", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(regularUser);
    vi.mocked(userRepository.updateUserById).mockResolvedValue({ ...regularUser, active: false });

    await updateUser(adminUser, regularUser.id, { active: false });

    expect(userRepository.updateUserById).toHaveBeenCalledWith(regularUser.id, { active: false });
  });
});
