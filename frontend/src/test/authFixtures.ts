import { vi } from "vitest";

export const DEFAULT_TEST_USER = {
  id: "1",
  email: "test@example.com",
  role: "USER" as const,
};

export const DEFAULT_AUTH_STATE = {
  user: DEFAULT_TEST_USER,
  isAuthenticated: true,
  isLoading: false,
};

/**
 * Returns the factory shape for `vi.mock("../hooks/useAuth", ...)`.
 * Use as: `vi.mock("../hooks/useAuth", async () => (await import("../test/authFixtures")).authMockFactory());`
 */
export function authMockFactory(state = DEFAULT_AUTH_STATE) {
  // eslint-disable-next-line @eslint-react/no-unnecessary-use-prefix -- key must match the real module export
  return { useAuth: () => state };
}

/**
 * Returns the factory shape for `vi.mock("../hooks/useLogout", ...)`.
 */
export function logoutMockFactory(overrides?: { mutate?: () => void; isPending?: boolean }) {
  return {
    // eslint-disable-next-line @eslint-react/no-unnecessary-use-prefix -- key must match the real module export
    useLogout: () => ({
      mutate: overrides?.mutate ?? vi.fn(),
      isPending: overrides?.isPending ?? false,
    }),
  };
}
