import argon2 from "argon2";
import { ServiceError } from "../errors.js";
import * as userRepository from "../repositories/user.repository.js";
import { EmailConflictError } from "../repositories/user.repository.js";
import * as auditService from "./audit.service.js";

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
    .catch((err) => console.error("[audit] PROFILE_UPDATED failed:", err));

  return updated;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await userRepository.findByIdWithPassword(userId);
  if (!user) throw new ServiceError(404, "User not found");

  const valid = await argon2.verify(user.password, currentPassword);
  if (!valid) throw new ServiceError(401, "Current password is incorrect");

  const hashed = await argon2.hash(newPassword);
  await userRepository.updatePassword(userId, hashed);

  void auditService
    .logEvent("PASSWORD_CHANGED", userId)
    .catch((err) => console.error("[audit] PASSWORD_CHANGED failed:", err));
}
