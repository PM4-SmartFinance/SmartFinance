import argon2 from "argon2";
import { ServiceError } from "../errors.js";
import * as userRepository from "../repositories/user.repository.js";
import * as auditService from "./audit.service.js";
import { loginAttempts } from "../metrics/business-metrics.js";

export async function login(email: string, password: string) {
  const user = await userRepository.findByEmailWithPassword(email);
  if (!user) {
    void auditService.logEvent("LOGIN_FAILED", null, { email });
    loginAttempts.inc({ outcome: "failure" });
    throw new ServiceError(401, "Invalid credentials");
  }

  // Deny login if account deactivated
  if (user.active === false) {
    void auditService.logEvent("LOGIN_FAILED", user.id, { email, reason: "Account deactivated" });
    loginAttempts.inc({ outcome: "failure" });
    throw new ServiceError(403, "Account deactivated");
  }

  const valid = await argon2.verify(user.password, password);
  if (!valid) {
    void auditService.logEvent("LOGIN_FAILED", null, { email });
    loginAttempts.inc({ outcome: "failure" });
    throw new ServiceError(401, "Invalid credentials");
  }

  void auditService.logEvent("LOGIN_SUCCESS", user.id, { email });
  loginAttempts.inc({ outcome: "success" });

  return {
    id: user.id,
    role: user.role,
    email: user.email,
    pwdVersion: user.password.slice(-PWD_VERSION_LENGTH),
  };
}

/**
 * Number of trailing characters of the Argon2 hash kept in the session as a
 * password-version stamp. The full hash is never returned from this service.
 *
 * Why slice the hash: argon2.hash() randomises the salt on every call, so any
 * password change produces a hash with completely different trailing bytes.
 * Comparing this short slice in the session against the slice of the current
 * stored hash detects "password has changed since this session was issued"
 * without needing a stateful session store.
 *
 * Why 10 chars: the trailing portion of an argon2id encoded hash is the
 * base64-encoded tag. 10 base64 chars ≈ 60 bits of entropy — overwhelmingly
 * unlikely to collide across two consecutive password rotations for the same
 * user, and short enough to keep the session cookie compact.
 */
const PWD_VERSION_LENGTH = 10;

export async function recordLogout(userId: string | null) {
  if (userId) {
    void auditService.logEvent("LOGOUT", userId);
  }
}
