import { defineConfig } from "eslint/config";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintReact from "@eslint-react/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import vitest from "@vitest/eslint-plugin";
import globals from "globals";

export default defineConfig([
  {
    ignores: ["**/dist/", "**/node_modules/", "**/coverage/"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["frontend/**/*.{ts,tsx}"],
    ...eslintReact.configs.recommended,
    plugins: {
      ...eslintReact.configs.recommended.plugins,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...eslintReact.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    files: ["frontend/src/**/*.test.{ts,tsx}", "backend/src/**/*.test.ts"],
    plugins: { vitest },
    rules: { ...vitest.configs.recommended.rules },
    languageOptions: {
      globals: vitest.environments.env.globals,
    },
  },
  {
    files: [".github/scripts/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: globals.node,
    },
  },
  {
    files: [".github/scripts/**/*.test.ts"],
    plugins: { vitest },
    rules: { ...vitest.configs.recommended.rules },
    languageOptions: {
      globals: { ...vitest.environments.env.globals, ...globals.node },
    },
  },
  eslintConfigPrettier, // Must always remain at the very bottom!
]);
