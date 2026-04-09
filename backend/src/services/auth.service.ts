import argon2 from "argon2";
import { ServiceError } from "../errors.js";
import * as userRepository from "../repositories/user.repository.js";
import * as auditService from "./audit.service.js";

export async function login(email: string, password: string) {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    void auditService.logEvent("LOGIN_FAILED", null, { email });
    throw new ServiceError(401, "Invalid credentials");
  }

  // Deny login if account deactivated
  if (user.active === false) {
    void auditService.logEvent("LOGIN_FAILED", user.id, { email, reason: "Account deactivated" });
    throw new ServiceError(403, "Account deactivated");
  }

  const valid = await argon2.verify(user.password, password);
  if (!valid) {
    void auditService.logEvent("LOGIN_FAILED", null, { email });
    throw new ServiceError(401, "Invalid credentials");
  }

  void auditService.logEvent("LOGIN_SUCCESS", user.id, { email });

  return { id: user.id, role: user.role, email: user.email };
}

export async function recordLogout(userId: string | null) {
  if (userId) {
    void auditService.logEvent("LOGOUT", userId);
  }
}
