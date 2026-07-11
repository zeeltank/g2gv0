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
    name: 'gtg-ui-layer',
    files: ['components/ui/**'],
    rules: {
      // UI primitives should only use allowed imports
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/components/org', '@/components/profile', '@/components/settings', '@/components/task', '@/components/hrit', '@/components/lms', '@/components/talent', '@/components/competency', '@/components/compliance-discipline', '@/components/auth'],
              message: 'UI primitives (components/ui/*) cannot import from Layer 3 domain components.'
            },
            {
              group: ['@/lib/gtg-*'],
              message: 'UI primitives should not import GTG-specific business logic. Use generic utilities.'
            }
          ]
        }
      ]
    }
  }
];

export default eslintConfig;
