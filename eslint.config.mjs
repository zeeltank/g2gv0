// @ts-check
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Prevent raw button elements with shadcn/ui styling patterns
      "no-restricted-patterns": [
        "error",
        {
          patterns: [
            {
              pattern: "<button[^>]*className={[^{]*rounded[^}]*}>",
              message: "Use <Button> component from @/components/ui/button instead of raw <button> with rounded styling. This ensures consistent styling and accessibility."
            },
            {
              pattern: "<button[^>]*className={[^{]*bg-primary[^}]*}>",
              message: "Use <Button variant=\"default\"> from @/components/ui/button instead of raw <button> with primary background."
            }
          ]
        }
      ],
      // Prefer UI component imports from @/components/ui barrel
      "no-restricted-imports": [
        "error",
        {
          name: "@/components/org/gtg-ui",
          message: "Import from @/components/ui or @/components/org/components instead of @/components/org/gtg-ui. The gtg-ui re-export layer has been removed."
        }
      ],
      // Enforce using cn() utility for className merging
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='className'] > Literal[value=/\\bcte\\b/]",
          message: "Use cn() utility from @/lib/utils for className merging instead of template literals."
        }
      ]
    }
  },
  {
    // Ignore patterns for generated files and node_modules
    ignores: [
      "node_modules/**",
      ".next/**",
      "build/**",
      "dist/**",
      "*.config.js",
      "*.config.mjs"
    ]
  }
];

export default eslintConfig;
