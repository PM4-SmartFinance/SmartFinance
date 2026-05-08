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
      exclude: [
        "src/main.tsx",
        "src/router.tsx",
        "src/App.tsx",
        "src/test/**",
        "src/contexts/AuthProvider.tsx",
        "**/*.d.ts",
        "vitest.config.ts",
        "vite.config.ts",
      ],
      thresholds: {
        // Global aggregate floor.
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
        // Per-file enforcement via glob.
        "**/src/**/*.{ts,tsx}": { lines: 70, functions: 70, branches: 70, statements: 70 },
        // KAN-140 carve-outs — tracked tech-debt; raise as test coverage improves on these files.
        "**/src/components/EditUserDialog.tsx": {
          lines: 40,
          functions: 15,
          branches: 40,
          statements: 35,
        },
        "**/src/components/ui/alert.tsx": {
          lines: 60,
          functions: 50,
          branches: 100,
          statements: 60,
        },
        "**/src/pages/LoginPage.tsx": { lines: 60, functions: 15, branches: 55, statements: 60 },
        "**/src/pages/BudgetsPage.tsx": { lines: 60, functions: 30, branches: 65, statements: 60 },
        "**/src/pages/SettingsUsers.tsx": {
          lines: 60,
          functions: 50,
          branches: 60,
          statements: 60,
        },
        "**/src/components/ui/select.tsx": {
          lines: 70,
          functions: 65,
          branches: 100,
          statements: 70,
        },
        "**/src/components/RuleRow.tsx": { lines: 70, functions: 50, branches: 60, statements: 65 },
        "**/src/components/CreateUserDialog.tsx": {
          lines: 70,
          functions: 55,
          branches: 60,
          statements: 65,
        },
        "**/src/components/BudgetProgressCard.tsx": {
          lines: 70,
          functions: 70,
          branches: 40,
          statements: 70,
        },
        "**/src/components/CreateEditBudgetDialog.tsx": {
          lines: 70,
          functions: 65,
          branches: 70,
          statements: 70,
        },
        "**/src/lib/api.ts": { lines: 70, functions: 55, branches: 70, statements: 70 },
        "**/src/pages/DashboardPage.tsx": {
          lines: 70,
          functions: 65,
          branches: 50,
          statements: 70,
        },
        "**/src/lib/queries/categories.ts": {
          lines: 70,
          functions: 70,
          branches: 60,
          statements: 70,
        },
        "**/src/lib/queries/users.ts": { lines: 70, functions: 70, branches: 65, statements: 70 },
      },
    },
  },
});
