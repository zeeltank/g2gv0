# Frontend Component Layering Model - Documentation

> **Note:** This document defines the component layering model for the GTG frontend codebase. 
> To create the actual file, copy the content below (excluding this note) to:
> `docs/frontend/component-layering.md`

---

## Overview

This document establishes a four-layer model for organizing React components in the GTG frontend codebase:

| Layer | Name | Location | Purpose |
|-------|------|----------|---------|
| **L1** | Raw shadcn/ui Components | `components/ui/` | Primitive UI elements with minimal customization |
| **L2** | App-Level Reusable UI | `components/ui/` or `components/business/` | Shared UI patterns that encode product decisions |
| **L3** | Domain-Specific Components | `components/{domain}/` | Business logic components for specific domains |
| **L4** | Feature-Local Components | `components/{feature}/` or co-located | Components used by a single feature |

---

## Layer Definitions

### Layer 1: Raw shadcn/ui Components

Direct shadcn/ui components, optionally with minor prop extensions or styling tweaks.

**Characteristics:**
- Single-purpose, atomic UI elements
- Minimal business logic
- Reusable across all layers
- No knowledge of domain concepts

**Examples:**
- `components/ui/button.tsx`
- `components/ui/card.tsx`
- `components/ui/input.tsx`

### Layer 2: App-Level Reusable UI Components

Components that wrap L1 primitives and encode **reusable product decisions**. These are shared across domains but contain no domain-specific logic.

**Characteristics:**
- Encodes reusable patterns (compositions of L1 components)
- May have semantic variants tied to the design system
- Shared across multiple domains
- No business logic, only presentation logic

**Examples from codebase:**
```typescript
// components/ui/status-badge.tsx - Reusable badge with semantic status variants
// components/ui/data-table.tsx - Reusable table pattern with pagination, selection
// components/ui/filter-bar.tsx - Reusable filter composition pattern
// components/business/kpi-card.tsx - Reusable metric display pattern
```

### Layer 3: Domain-Specific Components

Components tied to a specific business domain. These contain domain logic and are typically used by features within that domain.

**Characteristics:**
- Contains business logic specific to one domain
- May compose L1 and L2 components
- Shared within a domain (e.g., all org-related pages)
- Knows about domain types and business rules

**Domain directories:**
```
components/
├── business/     # Business metrics and analytics
├── org/          # Organization management
├── shell/        # Application shell (GTG-app-shell, sidebar, header)
├── settings/     # Settings and configuration
├── profile/      # Employee profile
├── task/         # Task management
├── talent/       # Talent management
├── workflow/     # Workflow-related
├── competency/   # Competency management
└── ...
```

**Examples from codebase:**
```typescript
// components/org/employee-directory.tsx - Domain: Organization
// components/shell/gtg-app-shell.tsx - Domain: Application Shell
// components/settings/module-card.tsx - Domain: Settings
```

### Layer 4: Feature-Local Components

Components that are co-located with specific features and not shared.

**Characteristics:**
- Used by exactly one feature
- May be co-located in a parent component file or a sibling file
- No need for cross-domain reuse
- Can contain feature-specific logic

**Examples from codebase:**
```typescript
// components/talent/recruitment/candidate-kanban.tsx - Feature: Recruitment Kanban
// components/org/edit-employee/personal-info-tab.tsx - Feature: Employee Edit
// components/profile/cards/personal-card.tsx - Feature: Profile Dashboard
```

---

## Decision Tree

```
                    ┌─────────────────────────────┐
                    │ Is it a primitive UI element│
                    │ (Button, Input, Card, etc.) │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │              ▼               │
               YES  │    Keep in L1 with minor    │
                    │    customizations if needed  │
                    └─────────────────────────────┘
                                   │ NO
                                   ▼
                    ┌─────────────────────────────┐
                    │ Does it encode a reusable   │
                    │ product decision?           │
                    │ (Common patterns, semantic  │
                    │  variants, UI compositions) │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │              ▼               │
               YES  │    Move to L2               │
                    └──────────────┬──────────────┘
                                   │ NO
                                   ▼
                    ┌─────────────────────────────┐
                    │ Is it tied to a specific    │
                    │ business domain?            │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │              ▼               │
               YES  │    Move to L3 (domain/)     │
                    │    e.g., org/, task/, shell/│
                    └──────────────┬──────────────┘
                                   │ NO
                                   ▼
                    ┌─────────────────────────────┐
                    │ Is it used by only one       │
                    │ feature/page?               │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │              ▼               │
               YES  │    Keep as L4, co-locate    │
                    │    with the feature         │
                    └─────────────────────────────┘
```

---

## Dependency Rules

### Layer Dependency Hierarchy

Components can only depend on components from the **same layer or lower layers**:

```
L4 → L3 → L2 → L1  (allowed)
L1 → L2 → L3 → L4  (NOT allowed)
```

### Specific Dependency Rules

| From Layer | Can Import |
|-----------|------------|
| **L1** → | L1 (shadcn primitives), lib/utils |
| **L2** → | L1, L2, lib/utils |
| **L3** → | L1, L2, L3, lib/, types/ |
| **L4** → | L1, L2, L3, L4, lib/, types/ |

### Prohibited Dependencies

1. **L2 cannot import L3** — App-level UI should not know about business domains
2. **Shared L3 components cannot import feature-specific L4** — Domain components should not know about specific features
3. **No circular dependencies** — Components in the same layer should not depend on each other in a cycle

---

## Import Conventions

### Path Aliases

Use the `@/` path alias for all imports:

```typescript
// ✅ Correct
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { EmployeeDirectory } from '@/components/org/employee-directory'

// ❌ Incorrect
import { Button } from '../../../components/ui/button'
```

### Import Order

Organize imports in the following order:

```typescript
// 1. React / Next.js imports
import React from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// 2. Third-party library imports (lucide-react, etc.)
import { Plus, Search, User } from 'lucide-react'

// 3. L1 components (shadcn/ui primitives)
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

// 4. L2 components (app-level reusable UI)
import { DataTable } from '@/components/ui/data-table'
import { FilterBar } from '@/components/ui/filter-bar'
import { StatusBadge } from '@/components/ui/status-badge'

// 5. L3 components (domain-specific)
import { KPICard } from '@/components/business/kpi-card'
import { EmployeeDirectory } from '@/components/org/employee-directory'

// 6. L4 components (feature-local)
import { CandidateCard } from './candidate-kanban'

// 7. Hooks and utilities
import { cn } from '@/lib/utils'

// 8. Types
import type { Employee } from '@/types/employee'
```

---

## Naming Conventions

### File Naming

| Layer | Convention | Example |
|-------|------------|---------|
| L1 | kebab-case | `status-badge.tsx`, `data-table.tsx` |
| L2 | kebab-case | `filter-bar.tsx`, `kpi-card.tsx` |
| L3 | kebab-case with domain prefix | `gtg-app-shell.tsx`, `employee-directory.tsx` |
| L4 | kebab-case, descriptive | `candidate-kanban.tsx`, `personal-info-tab.tsx` |

### Component Naming

| Layer | Convention | Example |
|-------|------------|---------|
| L1 | PascalCase, shadcn name | `Button`, `Card`, `Input` |
| L2 | PascalCase, descriptive | `DataTable`, `FilterBar`, `StatusBadge` |
| L3 | PascalCase, domain-aware | `EmployeeDirectory`, `KpiCard`, `GtgAppShell` |
| L4 | PascalCase, feature-specific | `CandidateCard`, `KanbanColumn`, `PersonalInfoTab` |

### Prefix Conventions

| Prefix | Usage | Example |
|--------|-------|---------|
| `gtg-` | Application shell components | `gtg-app-shell`, `gtg-sidebar` |
| (none) | Domain components | `employee-directory`, `task-list-view` |
| (none) | Feature components | `candidate-kanban`, `personal-card` |

---

## Examples from Current Codebase

### Example 1: Layer 2 → Layer 3 Dependency

```typescript
// components/org/employee-directory.tsx (L3)
// ✅ Correctly imports L2 components

import { DataTable, type Column } from '@/components/ui/data-table'  // L2
import { FilterBar, type Filter } from '@/components/ui/filter-bar'  // L2
import { StatusBadge } from '@/components/ui/status-badge'            // L2
import { Button } from '@/components/ui/button'                        // L1
```

### Example 2: Feature-Local Component (L4)

```typescript
// components/org/edit-employee/personal-info-tab.tsx (L4)
// ✅ Feature-local component importing L1 and L2

import { Input } from '@/components/ui/input'      // L1
import { Select } from '@/components/ui/select'     // L1
import { DatePicker } from '@/components/ui/date-picker'  // L2
```

### Example 3: Domain Component Composing L2

```typescript
// components/business/kpi-card.tsx (L2/L3 boundary)
// ✅ Business metric component reused across domains

import { Card, CardContent } from '@/components/ui/card'  // L1
```

---

## Anti-Patterns

### Anti-Pattern 1: Wrapping L1 Without Adding Value

```typescript
// ❌ Don't do this - unnecessary wrapper
// components/custom-button.tsx
import { Button as ShadcnButton } from '@/components/ui/button'
export const CustomButton = ShadcnButton

// ✅ Do this - use the L1 component directly
import { Button } from '@/components/ui/button'
```

### Anti-Pattern 2: Domain Logic in L2 Components

```typescript
// ❌ Don't do this - domain logic in L2
// components/ui/task-status-badge.tsx
const taskStatusVariantMap = {
  'in-progress': 'processing',
  'review': 'pending',
  'blocked': 'error',
}

// ✅ Do this - keep L2 generic with common status mappings only
// components/ui/status-badge.tsx
const statusVariantMap = {
  'active': 'active',
  'inactive': 'inactive',
}
```

### Anti-Pattern 3: L3 Importing Feature-Specific L4

```typescript
// ❌ Don't do this in a shared L3 component
import { RecruitmentCandidateCard } from '@/components/talent/recruitment/...'  // L4 from another domain

// ✅ Do this - keep L3 domain-focused
// If you need cross-domain data, move to a higher-level component (L4)
```

### Anti-Pattern 4: Deep Nesting of Feature Components

```typescript
// ❌ Don't do this - over-compartmentalization
// components/talent/recruitment/kanban/column/card/item.tsx

// ✅ Do this - co-locate if not shared
// components/talent/recruitment/candidate-kanban.tsx
```

---

## Migration Guidance

### Moving Components Between Layers

#### Moving from L4 to L3

When a component is used by multiple features within a domain:

1. Move the file to the domain folder
2. Update all import paths
3. Ensure no L4 imports are added
4. Update barrel exports if applicable

```bash
# Before
components/talent/recruitment/candidate-card.tsx

# After
components/talent/candidate-card.tsx  # or keep in recruitment/
```

#### Moving from L3 to L2

When a component is used by multiple domains:

1. Move the file to `components/ui/` or `components/business/`
2. Remove any domain-specific imports
3. Make variants and props generic
4. Update all import paths

```bash
# Before
components/org/employee-table.tsx  # Used by org AND task domains

# After
components/ui/employee-table.tsx   # Moved to app-level
```

### Refactoring Checklist

When migrating components:

- [ ] Update all import paths
- [ ] Verify no circular dependencies
- [ ] Check dependency rules are not violated
- [ ] Update `index.ts` barrel exports
- [ ] Update any documentation references
- [ ] Verify no TypeScript errors

---

## Quick Reference Card

```
┌────────────────────────────────────────────────────────────────┐
│                    COMPONENT LAYERING                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  L1 (Raw shadcn/ui)          │ Used everywhere                 │
│  ───────────────────────     │ Example: Button, Card, Input    │
│  Can import: L1              │                                 │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  L2 (App-Level Reusable)    │ Shared across domains           │
│  ───────────────────────     │ Example: DataTable, FilterBar   │
│  Can import: L1, L2          │                                 │
│  Cannot: L3, L4              │                                 │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  L3 (Domain-Specific)        │ Used within one domain          │
│  ───────────────────────     │ Example: Org, Task, Shell       │
│  Can import: L1, L2, L3      │                                 │
│  Cannot: L4 from others      │                                 │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  L4 (Feature-Local)          │ Used by one feature only       │
│  ───────────────────────     │ Co-located with feature         │
│  Can import: Any             │                                 │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Summary

**Key Principles:**

1. **Keep L1 thin** — Use raw shadcn components without unnecessary wrappers
2. **Only create L2 wrappers** — When encoding reusable product decisions, not just to rename
3. **Domain boundaries** — L3 components should stay within their domain
4. **Co-locate L4** — Keep feature-specific components close to their usage
5. **Follow dependency rules** — Never import from higher layers
6. **Thin wrappers** — Don't wrap components without adding value

**When in doubt:**
- If a component is used by multiple domains → L2
- If a component is used by multiple features in one domain → L3
- If a component is used by only one feature → L4 (co-locate)

---

## Research Summary

### Files Analyzed
- `components/ui/*.tsx` - 37 raw shadcn/ui components
- `components/shell/**/*.tsx` - 13 shell components
- `components/business/**/*.tsx` - 5 business components
- `components/talent/**/*.tsx` - 10 talent components
- `components/org/**/*.tsx` - Employee and organization components
- `components/task/**/*.tsx` - Task management components
- `components/profile/**/*.tsx` - Profile components
- `components/settings/**/*.tsx` - Settings components
- Existing documentation: `docs/gtg-design-system.md`, `docs/frontend/`

### Current Patterns Identified
- L1 components are direct shadcn/ui exports with minimal customization
- L2 components like `DataTable`, `FilterBar`, `StatusBadge` encode reusable patterns
- L3 domain folders (`org/`, `task/`, `shell/`, `business/`) contain domain-specific logic
- L4 components are co-located with their features in domain subdirectories
