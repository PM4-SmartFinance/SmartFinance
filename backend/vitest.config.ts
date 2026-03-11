import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["node_modules", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
      // Cover only core business logic — not controllers, middleware, or entry point.
      include: ["src/services/**", "src/repositories/**"],
      exclude: ["src/controllers/**", "src/middleware/**", "src/index.ts", "src/app.ts"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
  resolve: {
    conditions: ["node"],
  },
});
