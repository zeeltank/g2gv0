---
title: GTG Component Structure
description: Guidelines for organizing components in the GTG frontend
lastUpdated: 2026-07-11
tags: [architecture, components, folder-structure]
audience: [developers, ai-agents]
---

# GTG Component Structure

This document describes the component organization in the GTG frontend codebase.

## Current Structure

```
components/
├── ui/                    # Layer 1: shadcn/ui primitives (READ-ONLY)
├── business/               # Layer 2: Cross-domain shared components
├── shell/                 # App shell components (layout, navigation)
├── workflow/              # Workflow-specific compositions
├── data/                  # Data visualization components
│
├── auth/                  # Authentication domain (Layer 3)
├── org/                   # Organization domain (Layer 3)
├── profile/               # Profile domain (Layer 3)
├── settings/              # Settings domain (Layer 3)
├── task/                  # Task management domain (Layer 3)
├── hrit/                  # HRIT domain (Layer 3)
│   ├── attendance-management/
│   │   ├── attendance-tracking/
│   │   │   ├── components/  # Components specific to attendance tracking
│   │   │   └── page.tsx
│   │   └── attendance-reports/
│   │       ├── components/
│   │       └── page.tsx
│   └── leave-management/
│       ├── leave-dashboard/
│       ├── leave-requests/
│       ├── leave-configuration/
│       └── leave-reports/
├── lms/                   # Learning Management System (Layer 3)
├── talent/                # Talent Management (Layer 3)
├── competency/            # Competency Management (Layer 3)
├── compliance-discipline/  # Compliance & Discipline (Layer 3)
├── organization-setup/    # Organization setup wizard
└── illustration/          # Illustration components
```

## Barrel Export Pattern

Every component directory should have an `index.ts` file that re-exports all public components:

```typescript
// components/task/index.ts
export { CreateTaskModal } from './create-task-modal'
export { TaskBoardView } from './task-board-view'
// ...
```

This enables clean imports:
```typescript
import { CreateTaskModal } from '@/components/task'  // ✅ Good
import { CreateTaskModal } from '@/components/task/create-task-modal'  // Works but verbose
```

## Nesting Guidelines

### Acceptable Nesting
- `components/domain/feature/` - Domain-specific feature (3 levels)
- `components/domain/feature/components/` - Sub-components for a feature (4 levels)

### Avoid Excessive Nesting
- If a component directory has more than 10 components, consider splitting into sub-features
- If nesting exceeds 4 levels, consider flattening

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | `PascalCase.tsx` | `TaskBoardView.tsx` |
| Utilities | `camelCase.ts` | `formatDate.ts` |
| Types | `camelCase.ts` | `taskTypes.ts` |
| Hooks | `camelCase.ts` | `useTaskFilter.ts` |
| Index files | `index.ts` | `components/task/index.ts` |

## Import Guidelines

### Use Path Aliases
```typescript
import { useAuth } from '@/hooks/use-auth'
import { SectionCard } from '@/components/business'
import { Button } from '@/components/ui'
```

### Avoid Relative Imports
```typescript
// ❌ Avoid
import { Button } from '../../../../components/ui/button'

// ✅ Good
import { Button } from '@/components/ui/button'
```

## Adding New Components

1. **Identify the correct layer:**
   - Is it a Radix/shadcn primitive? → `components/ui/`
   - Used by 2+ domains without domain knowledge? → `components/business/`
   - Domain-specific? → `components/{domain}/`

2. **Follow naming conventions:** Use `PascalCase.tsx` for components

3. **Add barrel export:** Update the directory's `index.ts` file

4. **Add 'use client' directive** if the component uses client-side features

## Refactoring Checklist

When moving or refactoring components:

- [ ] Update all imports to use new path
- [ ] Update barrel exports in source directory
- [ ] Add barrel exports in destination directory
- [ ] Update any path aliases in `tsconfig.json`
- [ ] Run ESLint to check for violations
- [ ] Test the component in context
