import { defineConfig } from "vitest/config";

const srcPath = new URL("./src", import.meta.url).pathname;

export default defineConfig({
  resolve: {
    alias: [{ find: "@", replacement: srcPath }],
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "test/**/*.spec.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
    exclude: ["**/*.stress.spec.ts", "**/node_modules/**"],
    setupFiles: ["src/test/setup.ts"],
    typecheck: {
      tsconfig: "./tsconfig.json",
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
