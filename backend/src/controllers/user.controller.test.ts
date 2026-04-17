import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import { userRoutes } from "./user.controller.js";

let sessionUser: { id: string; role: string; email: string } | undefined = {
  id: "user-1",
  role: "USER",
  email: "test@example.com",
};

vi.mock("../services/user.service.js", () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  deleteUser: vi.fn(),
  onboardUser: vi.fn(),
  listUsers: vi.fn(),
  getUserById: vi.fn(),
  updateUser: vi.fn(),
}));

import * as userService from "../services/user.service.js";

const mockGetProfile = vi.mocked(userService.getProfile);
const mockUpdateProfile = vi.mocked(userService.updateProfile);
const mockChangePassword = vi.mocked(userService.changePassword);
const mockDeleteUser = vi.mocked(userService.deleteUser);

const profileFixture = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  role: "USER",
  createdAt: new Date("2025-01-01"),
};

function buildTestApp() {
  const app = Fastify({ logger: false });
  app.decorateRequest("session", null);
  app.addHook("onRequest", async (request) => {
    Object.defineProperty(request, "session", {
      configurable: true,
      value: {
        get: () => sessionUser,
        set: vi.fn(),
        delete: vi.fn(),
      },
    });
  });
  return app;
}

describe("GET /api/v1/users/me", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.register(userRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: "user-1", role: "USER", email: "test@example.com" };
  });

  it("returns 200 with the user profile", async () => {
    mockGetProfile.mockResolvedValue(profileFixture);

    const response = await app.inject({ method: "GET", url: "/api/v1/users/me" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ user: { id: "user-1", email: "test@example.com" } });
  });

  it("calls getProfile with the session user id", async () => {
    mockGetProfile.mockResolvedValue(profileFixture);

    await app.inject({ method: "GET", url: "/api/v1/users/me" });

    expect(mockGetProfile).toHaveBeenCalledExactlyOnceWith("user-1");
  });

  it("returns 401 when there is no session", async () => {
    sessionUser = undefined;

    const response = await app.inject({ method: "GET", url: "/api/v1/users/me" });

    expect(response.statusCode).toBe(401);
    expect(mockGetProfile).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/v1/users/me", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.register(userRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: "user-1", role: "USER", email: "test@example.com" };
  });

  it("returns 200 with the updated profile", async () => {
    mockUpdateProfile.mockResolvedValue({ ...profileFixture, name: "New Name" });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/users/me",
      payload: { displayName: "New Name" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ user: { name: "New Name" } });
  });

  it("passes displayName and email to the service", async () => {
    mockUpdateProfile.mockResolvedValue({ ...profileFixture, email: "new@example.com" });

    await app.inject({
      method: "PATCH",
      url: "/api/v1/users/me",
      payload: { displayName: "X", email: "new@example.com" },
    });

    expect(mockUpdateProfile).toHaveBeenCalledWith("user-1", {
      displayName: "X",
      email: "new@example.com",
    });
  });

  it("returns 409 when the new email is already taken", async () => {
    const { ServiceError } = await import("../errors.js");
    mockUpdateProfile.mockRejectedValue(new ServiceError(409, "Email already in use"));

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/users/me",
      payload: { email: "taken@example.com" },
    });

    expect(response.statusCode).toBe(409);
  });

  it("returns 401 when there is no session", async () => {
    sessionUser = undefined;

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/users/me",
      payload: { displayName: "X" },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe("POST /api/v1/users/me/change-password", () => {
  let app: FastifyInstance;
  let sessionDeleteSpy: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    sessionDeleteSpy = vi.fn();
    app = Fastify({ logger: false });
    app.decorateRequest("session", null);
    app.addHook("onRequest", async (request) => {
      Object.defineProperty(request, "session", {
        configurable: true,
        value: {
          get: () => sessionUser,
          set: vi.fn(),
          delete: sessionDeleteSpy,
        },
      });
    });
    await app.register(userRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: "user-1", role: "USER", email: "test@example.com" };
  });

  it("returns 200 on success", async () => {
    mockChangePassword.mockResolvedValue(undefined);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/users/me/change-password",
      payload: { currentPassword: "OldPass1!", newPassword: "NewPass1!" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it("passes credentials to the service", async () => {
    mockChangePassword.mockResolvedValue(undefined);

    await app.inject({
      method: "POST",
      url: "/api/v1/users/me/change-password",
      payload: { currentPassword: "OldPass1!", newPassword: "NewPass1!" },
    });

    expect(mockChangePassword).toHaveBeenCalledExactlyOnceWith("user-1", "OldPass1!", "NewPass1!");
  });

  it("deletes the session after a successful password change", async () => {
    mockChangePassword.mockResolvedValue(undefined);

    await app.inject({
      method: "POST",
      url: "/api/v1/users/me/change-password",
      payload: { currentPassword: "OldPass1!", newPassword: "NewPass1!" },
    });

    expect(sessionDeleteSpy).toHaveBeenCalledOnce();
  });

  it("returns 401 when the current password is wrong", async () => {
    const { ServiceError } = await import("../errors.js");
    mockChangePassword.mockRejectedValue(new ServiceError(401, "Current password is incorrect"));

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/users/me/change-password",
      payload: { currentPassword: "wrong", newPassword: "NewPass1!" },
    });

    expect(response.statusCode).toBe(401);
    expect(sessionDeleteSpy).not.toHaveBeenCalled();
  });

  it("returns 400 when newPassword is shorter than 8 characters", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/users/me/change-password",
      payload: { currentPassword: "OldPass1!", newPassword: "short" },
    });

    expect(response.statusCode).toBe(400);
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("returns 400 when required fields are missing", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/users/me/change-password",
      payload: { newPassword: "NewPass1!" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("returns 401 when there is no session", async () => {
    sessionUser = undefined;

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/users/me/change-password",
      payload: { currentPassword: "OldPass1!", newPassword: "NewPass1!" },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe("DELETE /api/v1/users/:id", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.register(userRoutes, { prefix: "/api/v1" });
    await app.ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: "admin-1", role: "ADMIN", email: "admin@example.com" };
  });

  it("returns 204 when an admin deletes a regular user", async () => {
    mockDeleteUser.mockResolvedValue(undefined);

    const response = await app.inject({
      method: "DELETE",
      url: "/api/v1/users/user-2",
    });

    expect(response.statusCode).toBe(204);
    expect(mockDeleteUser).toHaveBeenCalledExactlyOnceWith(
      { id: "admin-1", role: "ADMIN", email: "admin@example.com" },
      "user-2",
    );
  });

  it("returns 403 when the service blocks an admin from deleting another admin", async () => {
    const { ServiceError } = await import("../errors.js");
    mockDeleteUser.mockRejectedValue(new ServiceError(403, "Cannot delete another admin"));

    const response = await app.inject({
      method: "DELETE",
      url: "/api/v1/users/admin-2",
    });

    expect(response.statusCode).toBe(403);
  });

  it("returns 403 when a non-admin attempts to delete a different user", async () => {
    sessionUser = { id: "user-1", role: "USER", email: "user@example.com" };

    const response = await app.inject({
      method: "DELETE",
      url: "/api/v1/users/user-99",
    });

    expect(response.statusCode).toBe(403);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("returns 403 when an admin attempts to delete themselves", async () => {
    const { ServiceError } = await import("../errors.js");
    mockDeleteUser.mockRejectedValue(new ServiceError(403, "Cannot delete an admin account"));

    const response = await app.inject({
      method: "DELETE",
      url: "/api/v1/users/admin-1",
    });

    expect(response.statusCode).toBe(403);
  });

  it("returns 404 when the target user does not exist", async () => {
    const { ServiceError } = await import("../errors.js");
    mockDeleteUser.mockRejectedValue(new ServiceError(404, "Not found"));

    const response = await app.inject({
      method: "DELETE",
      url: "/api/v1/users/ghost-id",
    });

    expect(response.statusCode).toBe(404);
  });

  it("returns 401 when there is no session", async () => {
    sessionUser = undefined;

    const response = await app.inject({
      method: "DELETE",
      url: "/api/v1/users/user-2",
    });

    expect(response.statusCode).toBe(401);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });
});
