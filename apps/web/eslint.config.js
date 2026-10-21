import js from "@eslint/js";
import eslintPluginAstro from "eslint-plugin-astro";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".astro"] },
  js.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  ...tseslint.configs.recommended,
);
