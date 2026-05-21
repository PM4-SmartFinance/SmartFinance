import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

// In CI we swap the backend off `tsx watch` because watch mode never exits
// and doesn't propagate SIGTERM cleanly, leaving the workflow hanging after
// tests complete. `vite dev` shuts down fine, and we need it (not `preview`)
// so the `/api` proxy from vite.config.ts stays active.
const backendCommand = isCI
  ? "bunx tsx backend/src/index.ts"
  : "bun run --filter @smartfinance/backend dev";

const frontendCommand = "bun run --filter @smartfinance/frontend dev";

const chromiumOnly = [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }];

const allBrowsers = [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  { name: "webkit", use: { ...devices["Desktop Safari"] } },
];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: "html",

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },

  // Run only chromium in CI to keep the nightly under ~10 minutes; expand to
  // all browsers locally when you want cross-engine coverage.
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
