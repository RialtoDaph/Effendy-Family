import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Design handoff (prototype runtime), not app code.
    "docs/**",
    "design_handoff_rideff/**",
    "public/rideff-particles.js",
    "tests/e2e/stub.cjs",
  ]),
]);

export default eslintConfig;
