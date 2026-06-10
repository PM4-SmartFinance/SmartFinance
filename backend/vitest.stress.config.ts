import { defineConfig } from "vitest/config";
import { config } from "dotenv";

config({ path: ".env.test", override: true });

// Runs only the stress specs (excluded from the default suite). Mirrors the
// base config's runtime setup; no coverage. Use: `bun run test:stress`.
export default defineConfig({
  test: {
    fileParallelism: false,
    globals: true,
    environment: "node",
    include: ["test/**/*.stress.spec.ts"],
    exclude: ["**/node_modules/**"],
    globalSetup: ["test/global-setup.ts"],
    setupFiles: ["test/setup-prom-registry.ts"],
    testTimeout: 120_000,
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
  },
});
