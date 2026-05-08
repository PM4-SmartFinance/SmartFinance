import { defineConfig } from "vitest/config";
import { config } from "dotenv";

config({ path: ".env.test", override: true });

export default defineConfig({
  test: {
    fileParallelism: false,
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.spec.ts"],
    exclude: ["**/*.stress.spec.ts", "**/node_modules/**"],
    globalSetup: ["test/global-setup.ts"],
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "html", "lcov", "json-summary"],
      all: true,
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
