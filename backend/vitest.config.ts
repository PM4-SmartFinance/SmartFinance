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
      exclude: [
        "src/server.ts",
        "src/logger.ts",
        "src/prisma.ts",
        "**/*.d.ts",
        "**/types.ts",
        "test/**",
        "vitest.config.ts",
      ],
      thresholds: {
        // Global aggregate floor (project-wide ≥70%).
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
        // Per-file enforcement via glob — every source file must hit 70% individually.
        "**/src/**/*.ts": { lines: 70, functions: 70, branches: 70, statements: 70 },
        // KAN-140 carve-outs — tracked tech-debt; raise as test coverage improves on these files.
        "**/src/services/account.service.ts": {
          lines: 0,
          functions: 0,
          branches: 0,
          statements: 0,
        },
        "**/src/services/budget.service.ts": {
          lines: 30,
          functions: 30,
          branches: 30,
          statements: 30,
        },
        "**/src/repositories/category.repository.ts": {
          lines: 60,
          functions: 85,
          branches: 30,
          statements: 60,
        },
        "**/src/repositories/category-rule.repository.ts": {
          lines: 70,
          functions: 100,
          branches: 65,
          statements: 70,
        },
        "**/src/middleware/error-handler.ts": {
          lines: 70,
          functions: 70,
          branches: 55,
          statements: 70,
        },
        "**/src/controllers/budget.controller.ts": {
          lines: 70,
          functions: 70,
          branches: 45,
          statements: 70,
        },
      },
    },
  },
});
