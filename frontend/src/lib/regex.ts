import safeRegex from "safe-regex2";

export interface RegexValidation {
  ok: boolean;
  level: "valid" | "invalid" | "slow";
  message?: string;
}

/**
 * Mirrors the backend's `assertValidRegex` so the user gets instant feedback
 * without a network round-trip. The backend remains authoritative on save.
 */
export function validateRegex(pattern: string): RegexValidation {
  if (pattern.length === 0) return { ok: true, level: "valid" };
  try {
    new RegExp(pattern);
  } catch (err) {
    return {
      ok: false,
      level: "invalid",
      message: err instanceof Error ? err.message : "Invalid pattern",
    };
  }
  if (!safeRegex(pattern)) {
    return { ok: false, level: "slow", message: "Pattern may cause catastrophic backtracking" };
  }
  return { ok: true, level: "valid" };
}

/**
 * Returns `true`/`false` if the pattern is well-formed and matches/doesn't,
 * `null` when there's nothing to test (empty input) or the pattern itself
 * is invalid.
 */
export function testRegex(pattern: string, sample: string): boolean | null {
  if (pattern.length === 0 || sample.length === 0) return null;
  try {
    return new RegExp(pattern, "i").test(sample);
  } catch {
    return null;
  }
}
