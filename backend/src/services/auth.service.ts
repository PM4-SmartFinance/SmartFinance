import type { FastifyLoggerInstance } from "fastify";
import argon2 from "argon2";
import { ServiceError } from "../errors.js";
import * as userRepository from "../repositories/user.repository.js";
import * as auditService from "./audit.service.js";

const DEFAULT_CURRENCY_CODE = "CHF";

export async function register(email: string, password: string, logger?: FastifyLoggerInstance) {
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw new ServiceError(409, "User exists");
  }

  const currency = await userRepository.findCurrencyByCode(DEFAULT_CURRENCY_CODE);
  if (!currency) {
    throw new ServiceError(500, `Default currency ${DEFAULT_CURRENCY_CODE} not configured`);
  }

  const hashed = await argon2.hash(password);

  const user = await userRepository.createUser({
    email,
    password: hashed,
    defaultCurrencyId: currency.id,
  });

  // Audit USER_CREATED
  await auditService.logEvent(
    "USER_CREATED",
    user.id,
    { email: user.email, role: user.role },
    logger,
  );

  return user;
}

export async function login(email: string, password: string, logger?: FastifyLoggerInstance) {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    // Log failed login
    await auditService.logEvent("LOGIN_FAILED", null, { email }, logger);
    throw new ServiceError(401, "Invalid credentials");
  }

  const valid = await argon2.verify(user.password, password);
  if (!valid) {
    await auditService.logEvent("LOGIN_FAILED", null, { email }, logger);
    throw new ServiceError(401, "Invalid credentials");
  }

  // Successful login
  await auditService.logEvent("LOGIN_SUCCESS", user.id, { email }, logger);

  return { id: user.id, role: user.role, email: user.email };
}

export async function recordLogout(userId: string | null, logger?: FastifyLoggerInstance) {
  if (userId) {
    await auditService.logEvent("LOGOUT", userId, undefined, logger);
  }
}
