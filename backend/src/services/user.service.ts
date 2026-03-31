import { ServiceError } from "../errors.js";
import * as userRepository from "../repositories/user.repository.js";
import { logEvent } from "./audit.service.js";
import type { DimUser } from "@prisma/client";

export async function listUsers(
  requestingUser: { id: string; role: string } | null,
  opts: { limit?: number; offset?: number } = {},
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
  const user = (await userRepository.findById(id)) as DimUser | null;
  if (!user) throw new ServiceError(404, "Not found");
  // hide sensitive fields (password)
  return user as Omit<typeof user, "password">;
}

export async function updateUser(
  requestingUser: { id: string; role: string } | null,
  id: string,
  payload: Record<string, unknown>,
) {
  if (!requestingUser) throw new ServiceError(401, "Unauthorized");
  const isAdmin = requestingUser.role === "ADMIN";
  if (!isAdmin && requestingUser.id !== id) {
    throw new ServiceError(403, "Forbidden");
  }

  // Validate payload fields
  const allowedByOwner = ["name"];
  const allowedByAdmin = ["name", "role", "active"];
  const payloadKeys = Object.keys(payload);
  if (payloadKeys.length === 0) throw new ServiceError(400, "Bad Request");

  // Check role/active modifications only by admin
  if (!isAdmin && ("role" in payload || "active" in payload)) {
    throw new ServiceError(403, "Forbidden");
  }

  // Validate role value if present
  if ("role" in payload) {
    const r = payload["role"];
    if (r !== "ADMIN" && r !== "USER") {
      throw new ServiceError(400, "Invalid role");
    }
  }

  // Build update data only with allowed fields
  const data: Record<string, unknown> = {};
  for (const k of payloadKeys) {
    if (isAdmin && allowedByAdmin.includes(k)) data[k] = payload[k];
    else if (!isAdmin && allowedByOwner.includes(k)) data[k] = payload[k];
  }

  if (Object.keys(data).length === 0) throw new ServiceError(400, "No updatable fields");

  const existing = (await userRepository.findById(id)) as DimUser | null;
  if (!existing) throw new ServiceError(404, "Not found");

  const oldRole = existing.role;
  const updated = (await userRepository.updateUserById(id, data as never)) as DimUser;

  // Emit ROLE_CHANGED audit event if role changed
  if ("role" in data) {
    const newRole = typeof data.role === "string" ? data.role : undefined;
    if (newRole && newRole !== oldRole) {
      await logEvent("ROLE_CHANGED", requestingUser.id, { targetUserId: id, oldRole, newRole });
    }
  }
  // Hide password in response
  return updated as Omit<typeof updated, "password">;
}

export async function deleteUser(requestingUser: { id: string; role: string } | null, id: string) {
  if (!requestingUser) throw new ServiceError(401, "Unauthorized");
  const isAdmin = requestingUser.role === "ADMIN";
  if (!isAdmin && requestingUser.id !== id) {
    throw new ServiceError(403, "Forbidden");
  }

  const existing = (await userRepository.findById(id)) as DimUser | null;
  if (!existing) throw new ServiceError(404, "Not found");

  await userRepository.updateUserById(id, { active: false });

  await logEvent("USER_DELETED", requestingUser.id, { targetUserId: id, email: existing.email });

  return;
}
