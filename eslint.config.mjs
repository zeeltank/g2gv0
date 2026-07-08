// @ts-check
import { dirname } from "path";
import { fileURLToPath } from "url";
import next from "eslint-config-next";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Build the config without the custom rule for now
// The no-restricted-patterns rule has compatibility issues with eslint-config-next
const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "build/**",
      "dist/**",
      "*.config.js",
      "*.config.mjs"
    ]
  },
  ...next.flat()
];

export default eslintConfig;
