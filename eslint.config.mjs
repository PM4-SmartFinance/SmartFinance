import { defineConfig } from "eslint/config";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig([
  {
    ignores: ["**/dist/", "**/node_modules/", "**/coverage/"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["frontend/**/*.{ts,tsx}"],
    ...reactHooks.configs["recommended-latest"],
  },
  eslintConfigPrettier,
]);
