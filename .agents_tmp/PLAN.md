# Frontend Dependency & Import Structure Audit

## 1. OBJECTIVE

Analyze the frontend dependency and import structure to identify:
- Import conventions and alias configuration
- Common import patterns across the codebase
- Inconsistent relative imports
- Feature-to-feature coupling
- UI components importing domain/business logic
- Services or API code imported into UI primitives
- Circular dependency risks

**Scope**: No file modifications. Pure analysis and recommendations.

---

## 2. CONTEXT SUMMARY

### Project Structure
```
/workspace/project/g2gv0/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes (server-side)
│   ├── dashboard/         # Dashboard pages
│   ├── organization/      # Organization module pages
│   └── login/            # Auth pages
├── components/
│   ├── ui/               # Base UI primitives (shadcn/ui)
│   ├── shell/            # App shell, navigation, agent
│   ├── auth/             # Authentication components
│   ├── task/             # Task management feature
│   ├── talent/            # Talent management feature
│   ├── leave-management/  # Leave management feature
│   ├── profile/           # Profile feature
│   ├── org/              # Organization feature
│   ├── business/         # Shared business components
│   └── workflow/         # Workflow components
├── lib/                   # Utilities, routing, navigation
├── hooks/                 # Custom React hooks
├── types/                 # TypeScript type definitions
└── docs/                  # Documentation
```

### Key Dependencies
- **Framework**: Next.js (App Router)
- **UI System**: shadcn/ui + Tailwind CSS + Radix UI
- **Icons**: lucide-react
- **Type Safety**: TypeScript with strict mode

---

## 3. IMPORT ALIAS SUMMARY

### Configuration
**File**: `tsconfig.json` (lines 25-29)
```json
{
  "paths": {
    "@/*": ["./*"]
  }
}
```

### Established Patterns (Consistent)
| Alias | Resolves To | Usage |
|-------|-------------|-------|
| `@/components/ui/*` | `components/ui/*` | Base shadcn/ui primitives |
| `@/lib/*` | `lib/*` | Utilities, routing, business logic |
| `@/types/*` | `types/*` | TypeScript type definitions |
| `@/hooks/*` | `hooks/*` | Custom React hooks |
| `@/components/{feature}/*` | `components/{feature}/*` | Feature-specific components |

### Pattern Usage in Components

**Clean Pattern (UI Primitives)** - `components/ui/*`:
```typescript
import { cn } from '@/lib/utils'           // ✓ Only utility imports
import { X } from 'lucide-react'          // ✓ External icons
```

**Feature Components** - `components/{feature}/*.tsx`:
```typescript
import { Card } from '@/components/ui/card'           // ✓ UI primitive
import { cn } from '@/lib/utils'                       // ✓ Utility
import { Task } from '@/types/task-management'         // ✓ Types
import { mockTasks } from '@/lib/mock-data/task-management'  // ✓ Mock data
```

**Shell Components** - `components/shell/*.tsx`:
```typescript
import { useAuth } from '@/components/auth/gtg-auth'        // ✓ Auth
import { GtgSidebar } from './gtg-sidebar'                   // ✓ Relative (same dir)
import { GTG_NAVIGATION } from '@/lib/gtg-navigation'        // ✓ Lib
import { type Role } from '@/lib/gtg-roles'                  // ✓ Lib types
```

---

## 4. CURRENT DEPENDENCY DIRECTION SUMMARY

### Clean Dependencies (Good)
```
lib/utils.ts ← components/ui/*        (utilities only)
lib/utils.ts ← components/*           (utilities only)
types/* ← lib/*                      (type imports)
types/* ← components/*               (type imports)
```

### Acceptable Dependencies (Feature-to-Lib)
```
lib/gtg-roles.ts → components/auth/gtg-auth.tsx    (type import)
lib/gtg-navigation.ts → components/*                 (type + icon imports)
lib/gtg-nav-visibility.ts → lib/gtg-navigation.ts   (data dependency)
lib/gtg-content-map.ts → components/*                 (lazy component refs)
```

### Boundary Violations (Issues Found)

| From | To | Type | Severity |
|------|-----|------|----------|
| `components/shell/gtg-sidebar.tsx` | `@/lib/gtg-roles` | UI → Business Logic | Medium |
| `components/shell/gtg-sidebar.tsx` | `@/lib/gtg-nav-visibility` | UI → Business Logic | Medium |
| `components/shell/gtg-app-shell.tsx` | `@/lib/gtg-navigation` | UI → Business Logic | Medium |
| `components/shell/gtg-app-shell.tsx` | `@/lib/gtg-content-map` | UI → Business Logic | Medium |
| `components/auth/gtg-auth.tsx` | `@/lib/gtg-roles` | UI → Business Logic | Low |
| `lib/gtg-nav-visibility.ts` | `@/lib/gtg-roles` | Lib → Lib | Low |
| `lib/gtg-nav-visibility.ts` | `@/lib/gtg-navigation` | Lib → Lib | Low |

---

## 5. BOUNDARY VIOLATION EXAMPLES

### Violation 1: Sidebar Importing Business Logic
**File**: `components/shell/gtg-sidebar.tsx` (lines 4-8)
```typescript
import { GTG_NAVIGATION, type ActiveNav } from '@/lib/gtg-navigation'
import { type Role } from '@/lib/gtg-roles'
import { filterNavigationByRole } from '@/lib/gtg-nav-visibility'
```
**Issue**: Shell component directly depends on role definitions and visibility rules.

### Violation 2: Auth Context Importing Roles
**File**: `components/auth/gtg-auth.tsx` (line 4)
```typescript
import { type Role } from '@/lib/gtg-roles'
```
**Issue**: Auth component is coupled to role definitions in lib.

### Violation 3: Navigation Importing Components
**File**: `lib/gtg-content-map.ts` (lines 5-55)
```typescript
const OrganizationInformation = () => import('@/components/org/organization-information').then(m => ({ default: m.OrganizationInformation }))
```
**Issue**: Library code directly references UI components, creating tight coupling.

### Violation 4: Feature Component Co-located Mock Data
**File**: `components/profile/mock-profile-data.ts`
**Issue**: Mock data stored in `components/` folder instead of `lib/mock-data/` or `__mocks__/`.

---

## 6. INCONSISTENT RELATIVE IMPORTS

### Pattern A: Absolute Alias (Preferred)
```typescript
// components/leave-management/LeaveManagementDashboard.tsx
import { DashboardHeader } from '@/components/leave-management/LeaveManagementHeader'
import { DashboardStats } from '@/components/leave-management/LeaveManagementStats'
```

### Pattern B: Relative Import (Within same folder)
```typescript
// components/shell/gtg-sidebar.tsx
import { GtgBrandMark } from './gtg-brand-mark'
import { GtgHeader } from './gtg-header'
```
**Issue**: Inconsistent - same-feature imports use relative paths while cross-feature imports use aliases.

### Pattern C: Mixed (Same File)
**File**: `components/shell/gtg-app-shell.tsx` (lines 6-13)
```typescript
import { GtgSidebar } from './gtg-sidebar'           // Relative
import { AgentPanel } from '@/components/shell/agent/agent-drawer'  // Absolute
```
**Issue**: Same directory imports use inconsistent styles.

---

## 7. CIRCULAR DEPENDENCY RISKS

### Risk 1: Navigation ↔ Nav-Visibility Cycle
```
lib/gtg-navigation.ts
  └── Imports: lucide-react (safe)

lib/gtg-nav-visibility.ts
  ├── Imports from: @/lib/gtg-roles
  └── Imports from: @/lib/gtg-navigation
      └── (No imports from nav-visibility - currently safe)
```
**Status**: Currently safe, but tight coupling makes future refactoring risky.

### Risk 2: Shell → Navigation → Content-Map → Components
```
components/shell/gtg-app-shell.tsx
  ├── Imports from: @/lib/gtg-navigation
  └── Imports from: @/lib/gtg-content-map
      └── Imports from: @/components/org/* (lazy)
```
**Status**: Safe due to lazy loading, but any synchronous import would create a cycle.

### Risk 3: Auth → Roles (Type-only)
```
components/auth/gtg-auth.tsx
  └── Imports type: @/lib/gtg-roles
```
**Status**: Safe (type-only import), but bidirectional if roles imports from auth.

### Risk 4: Mock Data Inconsistency
```
lib/mock-data/task-management.ts
  └── Imports from: @/types/task-management

components/profile/mock-profile-data.ts  ⚠️ Different location
  └── (No imports)
```
**Status**: Mock data scattered between `lib/mock-data/` and `components/*/mock-*.ts`.

---

## 8. FEATURE-TO-FEATURE COUPLING ANALYSIS

### High Coupling: Shell Components
`components/shell/*` depends on:
- `@/components/auth/gtg-auth` (auth feature)
- `@/components/shell/agent/*` (agent feature)
- `@/lib/gtg-navigation` (routing/structure)
- `@/lib/gtg-content-map` (content resolution)
- `@/lib/gtg-nav-visibility` (visibility rules)

### Medium Coupling: Dashboard Pages
`app/dashboard/*` depends on:
- `@/components/auth/gtg-auth`
- `@/lib/gtg-dashboard-routing`

### Low Coupling: Feature Components
Individual feature components (`task/*`, `talent/*`, `leave-management/*`) are mostly self-contained with imports limited to:
- `@/components/ui/*`
- `@/lib/utils`
- `@/types/*`
- `@/lib/mock-data/*`

---

## 9. RECOMMENDED DEPENDENCY RULES

### Rule 1: Layer Hierarchy
```
┌─────────────────────────────────────────┐
│  app/* (Pages - App Router)             │  ← Highest level
├─────────────────────────────────────────┤
│  components/{feature}/* (Features)      │
├─────────────────────────────────────────┤
│  components/shell/* (Shell)            │
├─────────────────────────────────────────┤
│  components/auth/* (Auth)               │
├─────────────────────────────────────────┤
│  components/ui/* (UI Primitives)        │  ← Lowest level
├─────────────────────────────────────────┤
│  lib/* (Utilities & Data)               │
├─────────────────────────────────────────┤
│  types/* (Type Definitions)             │  ← Leaf nodes
└─────────────────────────────────────────┘
```

### Rule 2: Allowed Import Directions
| From | To | Allowed |
|------|-----|---------|
| `app/*` | `components/*` | ✓ Yes |
| `app/*` | `lib/*` | ✓ Yes |
| `components/*` | `components/ui/*` | ✓ Yes |
| `components/*` | `lib/*` | ✓ Yes |
| `components/*` | `types/*` | ✓ Yes |
| `components/ui/*` | `lib/utils` | ✓ Yes |
| `lib/*` | `types/*` | ✓ Yes |
| `lib/*` | `components/*` | ✗ No (violation) |
| `components/ui/*` | `lib/*` (except utils) | ✗ No (violation) |

### Rule 3: No Cross-Feature Dependencies
- Features in `components/task/*` should NOT import from `components/talent/*`
- Shared logic should move to `lib/*`

### Rule 4: Mock Data Location
- All mock data should be in `lib/mock-data/` or `__mocks__/`
- No `mock-*.ts` files in `components/*` folders

### Rule 5: Shell Component Isolation
- Shell components (`gtg-sidebar.tsx`, `gtg-app-shell.tsx`) should NOT import business logic directly
- Business logic should be accessed through hooks or context

---

## 10. SUGGESTED ENFORCEMENT OPTIONS

### Option 1: ESLint Rules (Recommended - Low Cost)
Add to `eslint.config.mjs`:
```javascript
// Prevent lib/* from importing components/*
const libNoComponentImport = {
  name: 'lib-no-component-import',
  create: (context) => ({
    ImportDeclaration(node) {
      const source = node.source.value;
      if (source.startsWith('@/lib/') && source.includes('/components/')) {
        context.report({
          node,
          message: 'lib/* should not import from components/*',
        });
      }
    },
  }),
};

// Prevent UI components from importing non-utility lib
const uiCleanImports = {
  name: 'ui-clean-imports',
  create: (context) => ({
    ImportDeclaration(node) {
      const filename = context.filename;
      if (filename.includes('/components/ui/')) {
        const source = node.source.value;
        const allowed = ['@/lib/utils', 'lucide-react', '@radix-ui'];
        const isAllowed = allowed.some(prefix => source.startsWith(prefix));
        if (!isAllowed && source.startsWith('@/lib/')) {
          context.report({
            node,
            message: 'UI components should only import from @/lib/utils',
          });
        }
      }
    },
  }),
};
```

### Option 2: TypeScript Path Conventions
Create additional path aliases in `tsconfig.json`:
```json
{
  "paths": {
    "@/*": ["./*"],
    "@/ui/*": ["./components/ui/*"],
    "@/features/*": ["./components/*"],
    "@/core/*": ["./lib/*"],
    "@/types/*": ["./types/*"]
  }
}
```

### Option 3: Dependency Cruiser (For Visualization)
Install `dependency-cruiser` for automated dependency graph generation:
```bash
npx depcruise --include 'components/**/*|lib/**/*|types/**/*' --exclude 'node_modules' . --output-type html > dependency-report.html
```

---

## 11. SUMMARY OF FINDINGS

| Category | Status | Notes |
|----------|--------|-------|
| Import Aliases | ✅ Good | Single `@/*` alias used consistently |
| Common Patterns | ⚠️ Mixed | UI components are clean; shell has violations |
| Relative Imports | ⚠️ Inconsistent | Mixed relative and absolute within same files |
| Feature Coupling | ⚠️ High | Shell components have too many dependencies |
| UI → Business Logic | ⚠️ Violations | Shell imports lib/gtg-roles, lib/gtg-nav-visibility |
| Mock Data Location | ⚠️ Scattered | Some in lib/mock-data, some in components/ |
| Circular Dependencies | ✅ Low Risk | No detected cycles; lazy loading prevents issues |

### Priority Fixes (If Enforcement Wanted)
1. Move `components/profile/mock-profile-data.ts` → `lib/mock-data/profile.ts`
2. Extract business logic from `gtg-sidebar.tsx` into hooks (`useNavigation`, `useRoleVisibility`)
3. Standardize on absolute imports within feature components
4. Add ESLint rules to prevent future violations

---

## 12. ACTION PLAN

The following are concrete, prioritized actions to resolve the dependency and import structure issues. Each action is scoped, testable, and can be executed independently.

---

### ACTION 1: Consolidate Mock Data Location

**Problem**: Mock data scattered across `lib/mock-data/` and `components/*/mock-*.ts`.

**Files to Move**:
| From | To |
|------|-----|
| `components/profile/mock-profile-data.ts` | `lib/mock-data/profile.ts` |

**Files to Update** (update imports after move):
| File | Change |
|------|--------|
| `components/profile/profile-dashboard.tsx` | `from '@/components/profile/mock-profile-data'` → `from '@/lib/mock-data/profile'` |
| `components/profile/cards/*.tsx` | Same import update |
| `components/profile/index.ts` | Update re-export |

**Action**: 
1. Create `lib/mock-data/` directory if not exists
2. Move `components/profile/mock-profile-data.ts` to `lib/mock-data/profile.ts`
3. Update all imports referencing the old location
4. Verify with: `grep -r "mock-profile-data" components/` returns 0

---

### ACTION 2: Create Navigation Hooks to Decouple Shell

**Problem**: `gtg-sidebar.tsx` and `gtg-app-shell.tsx` directly import business logic from `lib/gtg-roles`, `lib/gtg-navigation`, `lib/gtg-nav-visibility`.

**New Files to Create**:

| File | Purpose |
|------|---------|
| `hooks/use-navigation.ts` | Expose `GTG_NAVIGATION`, `ActiveNav`, `resolveBreadcrumb` |
| `hooks/use-role-visibility.ts` | Expose `filterNavigationByRole`, `isMenuVisible`, `canAccessMenu` |
| `hooks/use-roles.ts` | Expose `Role` type, `ROLES`, `roleLabel`, `getAccess` |

**Shell Updates**:

| File | Change |
|------|--------|
| `components/shell/gtg-sidebar.tsx` | Replace lib imports with hooks |
| `components/shell/gtg-app-shell.tsx` | Replace lib imports with hooks |

**Action**:
1. Create `hooks/use-navigation.ts`:
```typescript
import { GTG_NAVIGATION, resolveBreadcrumb, type ActiveNav } from '@/lib/gtg-navigation'

export { GTG_NAVIGATION }
export type { ActiveNav }
export { resolveBreadcrumb }

export function useNavigation() {
  return { GTG_NAVIGATION, resolveBreadcrumb }
}
```

2. Create `hooks/use-role-visibility.ts`:
```typescript
import { filterNavigationByRole, isMenuVisible, canAccessMenu } from '@/lib/gtg-nav-visibility'
import { type Role } from '@/lib/gtg-roles'

export { filterNavigationByRole, isMenuVisible, canAccessMenu }
export type { Role }

export function useRoleVisibility(role: Role) {
  return {
    filteredNav: filterNavigationByRole(role),
    isMenuVisible: (menuId: string) => isMenuVisible(menuId, role),
    canAccess: (menuId: string) => canAccessMenu(menuId, role),
  }
}
```

3. Create `hooks/use-roles.ts`:
```typescript
import { ROLES, roleLabel, getAccess, type Role, type Access } from '@/lib/gtg-roles'

export { ROLES, roleLabel, getAccess }
export type { Role, Access }
```

4. Update `hooks/index.ts`:
```typescript
export { useAttendance } from './use-attendance'
export { useNavigation } from './use-navigation'
export { useRoleVisibility } from './use-role-visibility'
export { useRoles } from './use-roles'
```

5. Refactor shell components to use hooks instead of direct lib imports

---

### ACTION 3: Decouple Auth from Roles

**Problem**: `components/auth/gtg-auth.tsx` imports `Role` type from `lib/gtg-roles`.

**Solution**: Move `Role` type to `types/` directory where it belongs.

| File | Change |
|------|--------|
| `types/role.ts` | Move `Role` type, `Access` type, `ROLES` array, `roleLabel`, `getAccess` here |
| `lib/gtg-roles.ts` | Re-export from `types/role.ts` (backwards compatibility) |
| `components/auth/gtg-auth.tsx` | Update import to `@/types/role` |

**Action**:
1. Create `types/role.ts` with all role-related types and functions
2. Update `lib/gtg-roles.ts` to re-export from `types/role.ts`
3. Update `components/auth/gtg-auth.tsx` import
4. Update `components/shell/gtg-sidebar.tsx` import
5. Update `lib/gtg-nav-visibility.ts` import

---

### ACTION 4: Refactor lib/gtg-content-map.ts to Remove Component Imports

**Problem**: `lib/gtg-content-map.ts` contains dynamic imports of UI components, violating lib-to-component boundary.

**Solution**: Move content mapping to a component or hook.

| Option | Pros | Cons |
|--------|------|------|
| **A**: Move to `hooks/use-content-map.ts` | Keeps lib clean, easy to test | Hook-based |
| **B**: Move to `components/shell/gtg-content-config.tsx` | Colocates with consumer | Moves data config to component |

**Recommended**: Option A - Move to `hooks/use-content-map.ts`

**Action**:
1. Create `hooks/use-content-map.ts`:
```typescript
import { type ComponentType } from 'react'
import type { ActiveNav } from './use-navigation'

// Dynamic imports moved here
const OrganizationInformation = () => import('@/components/org/organization-information').then(m => ({ default: m.OrganizationInformation }))
// ... rest of dynamic imports

export type LazyComponent = () => Promise<{ default: ComponentType<any> }>

export interface ContentRoute {
  submenuId?: string
  menuId?: string
  component: LazyComponent
  title?: string
  description?: string
}

// Move M1_CONTENT, M2_CONTENT, etc. here

export function getContentRoute(active: ActiveNav): ContentRoute | undefined {
  // ... implementation
}
```

2. Update `components/shell/gtg-app-shell.tsx` to use hook instead of direct lib import

---

### ACTION 5: Standardize Import Style

**Problem**: Inconsistent use of relative vs absolute imports within feature directories.

**Files to Update**:

| Directory | Pattern | Change |
|-----------|---------|--------|
| `components/shell/` | Mixed `./` and `@/` | Standardize to `@/` |
| `components/leave-management/` | Absolute `@/` | Keep as-is |
| `components/task/` | Check consistency | Standardize |

**Action**:
1. Run audit: `grep -rn "from '\.\/" components/shell/ | head -20`
2. Replace all `./` imports in shell components with `@/components/shell/`
3. Example: `from './gtg-sidebar'` → `from '@/components/shell/gtg-sidebar'`

---

### ACTION 6: Add ESLint Rules for Enforcement

**Problem**: No tooling prevents future dependency violations.

**File to Update**: `eslint.config.mjs`

**Rules to Add**:

```javascript
// Rule 1: lib/* must not import components/*
{
  name: 'no-lib-to-components',
  meta: { type: 'problem' },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value
        if (source.startsWith('@/lib/') && source.includes('/components/')) {
          context.report({
            node,
            message: 'lib/* should not import from components/* — move shared code to lib/*',
          })
        }
      },
    }
  },
}

// Rule 2: components/ui/* should only import allowed packages
{
  name: 'ui-clean-imports',
  meta: { type: 'problem' },
  create(context) {
    const ALLOWED = ['@/lib/utils', 'lucide-react', '@radix-ui', '@base-ui', 'react', 'react-dom']
    return {
      ImportDeclaration(node) {
        const filename = context.filename
        if (!filename.includes('/components/ui/')) return
        const source = node.source.value
        if (!ALLOWED.some(p => source.startsWith(p)) && source.startsWith('@/lib/')) {
          context.report({
            node,
            message: 'UI primitives should only import from @/lib/utils or external packages',
          })
        }
      },
    }
  },
}

// Rule 3: No mock data in components/
{
  name: 'no-mock-in-components',
  meta: { type: 'problem' },
  create(context) {
    return {
      ImportDeclaration(node) {
        const filename = context.filename
        const source = node.source.value
        if (filename.includes('/components/') && source.includes('/mock-')) {
          context.report({
            node,
            message: 'Mock data should be imported from lib/mock-data/, not components/',
          })
        }
      },
    }
  },
}
```

---

### ACTION 7: Update tsconfig.json with Granular Aliases

**Problem**: Single `@/*` alias lacks semantic meaning.

**File to Update**: `tsconfig.json`

**Change**:
```json
{
  "paths": {
    "@/*": ["./*"],
    "@/ui/*": ["./components/ui/*"],
    "@/components/*": ["./components/*"],
    "@/lib/*": ["./lib/*"],
    "@/hooks/*": ["./hooks/*"],
    "@/types/*": ["./types/*"]
  }
}
```

---

## 13. EXECUTION ORDER

| Priority | Action | Blocking | Estimated Effort |
|----------|--------|----------|------------------|
| 1 | ACTION 3: Decouple Auth from Roles | Blocks 2 | Low |
| 2 | ACTION 1: Consolidate Mock Data | Independent | Low |
| 3 | ACTION 2: Create Navigation Hooks | Independent | Medium |
| 4 | ACTION 4: Refactor content-map | Blocks shell cleanup | Medium |
| 5 | ACTION 6: Add ESLint Rules | Independent | Low |
| 6 | ACTION 5: Standardize Import Style | After 1-4 | Low |
| 7 | ACTION 7: Update tsconfig | After 6 | Low |

**Note**: Actions 2 and 3 can be done in parallel. Action 4 depends on Action 3 completing first (for hook structure).

---

## 14. VALIDATION CHECKLIST

After each action, verify:

| Action | Validation Command |
|--------|-------------------|
| 1 | `grep -r "mock-profile-data" components/` returns 0 |
| 2 | `grep -r "from '@/lib/gtg-" components/shell/` returns 0 |
| 3 | `grep -r "from '@/lib/gtg-roles" components/auth/` returns 0 |
| 4 | `grep -r "from '@/lib/gtg-content-map" components/` returns 0 |
| 5 | `grep -rn "from '\.\/" components/shell/` returns 0 |
| 6 | Run `npm run lint` with no new errors |
| 7 | Run `npm run build` with no errors |

---

*Audit completed: 2026-07-08*
*Action plan added: 2026-07-08*
