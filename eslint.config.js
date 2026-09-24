// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/build/**", "**/coverage/**", "**/node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Bare `any` must be justified with a comment (CLAUDE.md convention); this rule flags
      // any occurrence so the reviewer can check for that comment.
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow a leading underscore to mark an intentionally-unused parameter, e.g. in stubs.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  eslintConfigPrettier,
);
