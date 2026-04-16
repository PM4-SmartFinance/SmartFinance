import argon2 from "argon2";
import { ServiceError } from "../errors.js";
import * as userRepository from "../repositories/user.repository.js";
import {
  BootstrapForbiddenError,
  BootstrapUnauthorizedError,
  EmailConflictError,
} from "../repositories/user.repository.js";
import * as auditService from "./audit.service.js";
import { logEvent } from "./audit.service.js";

const DEFAULT_CURRENCY_CODE = "CHF";

// --- Profile functions (from develop) ---

export async function getProfile(userId: string) {
  const user = await userRepository.findById(userId);
  if (!user) throw new ServiceError(404, "User not found");
  return user;
}

export async function updateProfile(
  userId: string,
  data: { displayName?: string; email?: string },
) {
  const updateData: { name?: string; email?: string } = {};
  if (data.displayName !== undefined) updateData.name = data.displayName;
  if (data.email !== undefined) updateData.email = data.email;

  if (Object.keys(updateData).length === 0) {
    return userRepository.findById(userId);
  }

  let updated;
  try {
    updated = await userRepository.updateProfileAtomic(userId, updateData);
  } catch (err) {
    if (err instanceof EmailConflictError) throw new ServiceError(409, err.message);
    throw err;
  }

  void auditService
    .logEvent("PROFILE_UPDATED", userId, { fields: Object.keys(updateData) })
    .catch(() => {});

  return updated;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await userRepository.findByIdWithPassword(userId);
  if (!user) throw new ServiceError(404, "User not found");

  const valid = await argon2.verify(user.password, currentPassword);
  if (!valid) throw new ServiceError(401, "Current password is incorrect");

  const hashed = await argon2.hash(newPassword);
  await userRepository.updatePassword(userId, hashed);

  void auditService.logEvent("PASSWORD_CHANGED", userId).catch(() => {});
}

export async function onboardUser(
  requestingUser: { id: string; role: string } | null,
  payload: { email: string; displayName?: string; password: string; role?: "ADMIN" | "USER" },
) {
  const hashed = await argon2.hash(payload.password);

  const currency = await userRepository.findCurrencyByCode(DEFAULT_CURRENCY_CODE);
  if (!currency) {
    throw new ServiceError(500, `Default currency ${DEFAULT_CURRENCY_CODE} not configured`);
  }

  let user;
  try {
    user = await userRepository.createUserAtomic(requestingUser, {
      email: payload.email,
      password: hashed,
      defaultCurrencyId: currency.id,
      ...(payload.displayName !== undefined && { name: payload.displayName }),
      ...(payload.role !== undefined && { role: payload.role }),
    });
  } catch (err) {
    if (err instanceof BootstrapUnauthorizedError) throw new ServiceError(401, "Unauthorized");
    if (err instanceof BootstrapForbiddenError) throw new ServiceError(403, "Forbidden");
    if (err instanceof EmailConflictError) throw new ServiceError(409, "Email already in use");
    throw err;
  }

  // Track the event — best-effort
  void auditService
    .logEvent("USER_CREATED", requestingUser?.id ?? null, {
      targetUserId: user.id,
      email: user.email,
      role: user.role,
      isBootstrap: requestingUser === null,
    })
    .catch(() => {});

  return user;
}

// --- CRUD functions (KAN-74) ---

export async function listUsers(
  requestingUser: { id: string; role: string } | null,
  opts: { limit?: number; offset?: number; active?: boolean } = {},
) {
  if (!requestingUser) throw new ServiceError(401, "Unauthorized");
  if (requestingUser.role !== "ADMIN") throw new ServiceError(403, "Forbidden");
  return userRepository.listUsers(opts);
}

export async function getUserById(requestingUser: { id: string; role: string } | null, id: string) {
  if (!requestingUser) throw new ServiceError(401, "Unauthorized");
  if (requestingUser.role !== "ADMIN" && requestingUser.id !== id) {
    throw new ServiceError(403, "Forbidden");
  }
  const user = await userRepository.findById(id);
  if (!user) throw new ServiceError(404, "Not found");
  return user;
}

export async function updateUser(
  requestingUser: { id: string; role: string } | null,
  id: string,
  payload: { name?: string; role?: string; active?: boolean },
) {
  if (!requestingUser) throw new ServiceError(401, "Unauthorized");
  const isAdmin = requestingUser.role === "ADMIN";
  if (!isAdmin && requestingUser.id !== id) {
    throw new ServiceError(403, "Forbidden");
  }

  // Check role/active modifications only by admin
  if (!isAdmin && (payload.role !== undefined || payload.active !== undefined)) {
    throw new ServiceError(403, "Forbidden");
  }

  // Validate role value if present
  if (payload.role !== undefined && payload.role !== "ADMIN" && payload.role !== "USER") {
    throw new ServiceError(400, "Invalid role");
  }

  // Admins cannot change the role of or deactivate other admins
  const target = await userRepository.findById(id);
  if (!target) throw new ServiceError(404, "Not found");
  if (target.role === "ADMIN" && payload.active !== undefined) {
    throw new ServiceError(403, "Cannot deactivate an admin account");
  }
  if (
    isAdmin &&
    requestingUser.id !== id &&
    target.role === "ADMIN" &&
    payload.role !== undefined
  ) {
    throw new ServiceError(403, "Cannot modify another admin account");
  }

  // Build update data only with allowed fields
  const data: { name?: string | null; role?: string; active?: boolean } = {};
  if (payload.name !== undefined) data.name = payload.name;
  if (isAdmin && payload.role !== undefined) data.role = payload.role;
  if (isAdmin && payload.active !== undefined) data.active = payload.active;

  if (Object.keys(data).length === 0) throw new ServiceError(400, "No updatable fields");

  const oldRole = target.role;
  const updated = await userRepository.updateUserById(id, data);

  // Emit ROLE_CHANGED audit event if role changed
  if (data.role !== undefined && data.role !== oldRole) {
    void logEvent("ROLE_CHANGED", requestingUser.id, {
      targetUserId: id,
      oldRole,
      newRole: data.role,
    }).catch(() => {});
  }
  return updated;
}

export async function deleteUser(requestingUser: { id: string; role: string } | null, id: string) {
  if (!requestingUser) throw new ServiceError(401, "Unauthorized");
  const isAdmin = requestingUser.role === "ADMIN";
  if (!isAdmin && requestingUser.id !== id) {
    throw new ServiceError(403, "Forbidden");
  }

  const existing = await userRepository.findById(id);
  if (!existing) throw new ServiceError(404, "Not found");

  if (existing.role === "ADMIN") {
    throw new ServiceError(403, "Cannot delete an admin account");
  }

  await userRepository.updateUserById(id, { active: false });

  void logEvent("USER_DELETED", requestingUser.id, {
    targetUserId: id,
    email: existing.email,
  }).catch(() => {});

  return;
}
