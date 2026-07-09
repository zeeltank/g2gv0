// @ts-check
import { dirname } from "path";
import { fileURLToPath } from "url";
import next from "eslint-config-next";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  ...next.flat(),
  {
    // Custom rules for dependency boundary enforcement
    // Note: For custom rules in ESLint 9 flat config, use @eslint/js or a plugin
    // This section documents the boundary rules that should be enforced manually:
    //
    // 1. lib/* must not import from components/*
    //    - Move shared code to lib/* or use hooks
    //
    // 2. components/ui/* should only import from allowed packages
    //    - Allowed: @/lib/utils, @/lib/cn, lucide-react, react, @radix-ui/*
    //
    // 3. No mock data imports from components/
    //    - Mock data should be in lib/mock-data/
    //
    // 4. No GTG business logic in components/ui/
    //    - Don't import @/lib/gtg-* in UI primitives
    name: 'dependency-boundary-documentation'
  },
];

export default eslintConfig;
