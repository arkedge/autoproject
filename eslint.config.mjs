import { globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import globals from "globals";
import eslint from "@eslint/js";
import love from "eslint-config-love";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config({
  extends: [
    globalIgnores(["dist/", "crates/*/pkg", "src/configFormat/json.js"]),
    eslint.configs.recommended,
    tseslint.configs.recommended,
    love,
    eslintConfigPrettier,
  ],
  plugins: {
    "@typescript-eslint": tseslint.plugin,
  },
  languageOptions: {
    globals: {
      ...Object.fromEntries(
        Object.entries(globals.browser).map(([key]) => [key, "off"]),
      ),
      ...globals.node,
    },

    ecmaVersion: "latest",
    sourceType: "module",

    parser: tseslint.parser,
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },

  files: ["**/*.ts"],
  rules: {
    "@typescript-eslint/consistent-type-definitions": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-magic-numbers": "off",
    "@typescript-eslint/no-import-type-side-effects": "off",
    "@typescript-eslint/no-unsafe-type-assertion": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/prefer-destructuring": "off",
    "@typescript-eslint/init-declarations": "off",
    "@typescript-eslint/class-methods-use-this": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unnecessary-condition": "off",
    "@typescript-eslint/require-await": "off",
    "@typescript-eslint/strict-boolean-expressions": "off",
    "@typescript-eslint/no-unnecessary-type-parameters": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unnecessary-type-arguments": "off",
    "@typescript-eslint/switch-exhaustiveness-check": "off",
    "eslint-comments/require-description": "off",
    "eslint-comments/no-unlimited-disable": "off",
    "no-console": "off",
    "arrow-body-style": "off",
    complexity: "off",
  },
});
