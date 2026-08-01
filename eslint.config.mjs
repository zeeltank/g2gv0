import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * eslint-config-next 16 ships native flat configs, so they are imported directly.
 *
 * This previously went through `FlatCompat.extends("next/core-web-vitals",
 * "next/typescript")`. That eslintrc bridge could not resolve
 * `eslint-plugin-react` (it lives in eslint-config-next's own nested
 * node_modules, not hoisted to the top level), and @eslint/eslintrc's
 * config-validator then crashed while formatting that failure with
 * JSON.stringify - the "Converting circular structure to JSON ... property
 * 'react' closes the circle" error that made the ESLint CLI unusable across the
 * whole project. Importing the flat configs skips the bridge and needs no new
 * dependency.
 */
const eslintConfig = [
  // Build output and dependencies - never lint these.
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // Pre-existing project overrides, carried over unchanged.
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;
