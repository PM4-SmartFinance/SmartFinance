import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

// In CI we swap the backend off `tsx watch` because watch mode never exits
// and doesn't propagate SIGTERM cleanly, leaving the workflow hanging after
// tests complete. backend `start:ci` runs `tsx src/index.ts` (no watch).
const backendCommand = isCI
  ? "bun run --filter @smartfinance/backend start:ci"
  : "bun run --filter @smartfinance/backend dev";

const frontendCommand = "bun run --filter @smartfinance/frontend dev";

const chromiumOnly = [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }];

const allBrowsers = [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  { name: "webkit", use: { ...devices["Desktop Safari"] } },
];

export default defineConfig({
  testDir: "./e2e/specs",
  fullyParallel: false,
  forbidOnly: isCI,
  // No retries: specs run against a fresh DB and are deterministic. A retry
  // would re-run beforeAll hooks and collide with the seed (409 on uniques),
  // and flake-masking is exactly what the review warned against.
  retries: 0,
  workers: isCI ? 1 : 1,
  reporter: isCI ? [["list"], ["html"], ["github"]] : [["list"], ["html"]],
  globalSetup: "./e2e/global-setup.ts",
  expect: { timeout: 10_000 },

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: isCI ? chromiumOnly : allBrowsers,

  webServer: [
    {
      command: backendCommand,
      url: "http://localhost:3000/api/v1/health",
      reuseExistingServer: !isCI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: frontendCommand,
      url: "http://localhost:5173",
      reuseExistingServer: !isCI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
