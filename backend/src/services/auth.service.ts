import argon2 from "argon2";
import { ServiceError } from "../errors.js";
import * as userRepository from "../repositories/user.repository.js";

const DEFAULT_CURRENCY_CODE = "CHF";

export async function register(email: string, password: string) {
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw new ServiceError(409, "User exists");
  }

  const currency = await userRepository.findCurrencyByCode(DEFAULT_CURRENCY_CODE);
  if (!currency) {
    throw new ServiceError(500, `Default currency ${DEFAULT_CURRENCY_CODE} not configured`);
  }

  const hashed = await argon2.hash(password);

  return userRepository.createUser({
    email,
    password: hashed,
    defaultCurrencyId: currency.id,
  });
}

export async function login(email: string, password: string) {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    throw new ServiceError(401, "Invalid credentials");
  }

  const valid = await argon2.verify(user.password, password);
  if (!valid) {
    throw new ServiceError(401, "Invalid credentials");
  }

  return { id: user.id, role: user.role, email: user.email };
}
