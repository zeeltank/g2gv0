# 1. OBJECTIVE

Analyze the current frontend folder structure, routing setup, component organization, styling approach, and architecture boundaries to identify inconsistencies, architecture smells, and risk areas.

---

# 2. CONTEXT SUMMARY

## Framework & Technology Stack
- **Framework**: Next.js 16.2.6 with App Router
- **React Version**: 19
- **UI Library**: shadcn/ui (style: "base-nova")
- **Styling**: Tailwind CSS v4.2.0 with custom design tokens
- **Icons**: Lucide React
- **Charts**: Recharts
- **Additional Libraries**: React Hook Form, Zod, date-fns, React Day Picker

### Project Name
- "GapstoGrowth" — an HRMS application

---

# 3. APPROACH OVERVIEW

### Routing Structure
The application uses **Next.js App Router** with the following route organization:

| Route Pattern | File | Purpose |
|--------------|------|---------|
| `/` | `app/page.tsx` | Landing page (redirects based on auth) |
| `/login` | `app/login/page.tsx` | Login page |
| `/dashboard/*` | `app/dashboard/*/page.tsx` | Role-specific dashboards (admin, hr, team, personal) |
| `/module/[moduleId]/[menuId]/[submenuId]` | `app/module/[moduleId]/[menuId]/[submenuId]/page.tsx` | Dynamic module routes |
| `/organization/*` | `app/organization/*/page.tsx` | Organization setup pages (parallel legacy routes) |
| `/api/onboarding` | `app/api/onboarding/route.ts` | Onboarding API |

### Navigation Architecture
- Navigation is centralized in `lib/gtg-navigation.ts`
- Module hierarchy: **6 Modules → 16 Menus → 30 Submenus**
- Active navigation state: `{ moduleId, menuId, submenuId }`
- URL pattern: `/module/{moduleId}/{menuId}/{submenuId}`

### Routing Mechanism
**The routing is hybrid**: URL changes drive navigation, but content rendering is **NOT** route-driven. The `GtgAppShell` component (lines 107-272 of `components/shell/gtg-app-shell.tsx`) uses a massive `renderContent()` switch statement to map navigation state to components. This creates a tight coupling between URL segments and component rendering.

### Auth Flow
- `AuthProvider` wraps the entire app in `app/layout.tsx`
- `useAuth` hook provides session state
- `ProtectedLayout` component handles auth redirects
- Session stored in `localStorage` (mock auth, no server-side validation)
- **No middleware.ts file** for route protection

---

# 4. IMPLEMENTATION STEPS

## Folder Structure

```
/workspace/project/g2gv0/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx               # Root layout (only layout.tsx in project!)
│   ├── page.tsx                 # Landing page
│   ├── login/page.tsx
│   ├── dashboard/                # Role-specific dashboards
│   │   ├── admin/
│   │   ├── hr-operations/
│   │   ├── team/
│   │   ├── personal/
│   │   └── ...
│   ├── module/                  # Dynamic module routes
│   │   └── [moduleId]/
│   │       └── [menuId]/
│   │           └── [submenuId]/
│   ├── organization/            # Legacy/parallel routes
│   ├── profile/
│   ├── settings/
│   └── api/
│       └── onboarding/
│
├── components/                  # React components
│   ├── ui/                     # shadcn/ui primitives (35 files)
│   ├── shell/                  # App shell components
│   │   ├── gtg-app-shell.tsx   # Main shell (386 lines, monolithic)
│   │   ├── gtg-sidebar.tsx
│   │   ├── gtg-header.tsx
│   │   ├── gtg-breadcrumb.tsx
│   │   ├── gtg-page-header.tsx
│   │   ├── gtg-floating-toolbar.tsx
│   │   ├── gtg-brand-mark.tsx
│   │   └── agent/              # AI Agent panel
│   ├── attendance/             # Feature component
│   ├── auth/                   # Auth components
│   ├── business/               # Business widgets
│   ├── competency/             # Competency management
│   ├── compliance-discipline/  # Compliance features
│   ├── data/                   # Data utilities
│   ├── illustration/          # Illustrations
│   ├── leave-managemnt/       # ⚠️ TYPO: "managemnt"
│   ├── lms/                    # LMS module
│   ├── org/                   # Organization features
│   ├── organization/           # Setup wizard components
│   ├── profile/               # Profile features
│   ├── settings/              # Settings components
│   ├── task/                  # Task management
│   ├── talent/                # Talent management
│   └── workflow/              # Workflow components
│
├── lib/                        # Utilities and logic
│   ├── utils.ts               # cn() utility
│   ├── gtg-auth.tsx           # Auth context (client component!)
│   ├── gtg-navigation.ts      # Navigation config
│   ├── gtg-roles.ts          # Role types
│   ├── gtg-dashboard-routing.ts
│   ├── gtg-nav-visibility.ts
│   ├── gtg-org-data.ts
│   ├── onboarding.ts
│   ├── task-utils.ts
│   ├── Leavemanagment-data.ts  # ⚠️ TYPO
│   └── mock-data/             # Mock data
│
├── types/                      # TypeScript types
│   ├── employee.ts
│   ├── task-management.ts
│   └── Leavedashboard.ts
│
├── public/                     # Static assets
├── docs/                       # Documentation
├── components.json             # shadcn/ui config
├── globals.css                 # Global styles + design tokens
└── package.json
```

### Missing Standard Directories
- **No `hooks/` directory** — Custom hooks are placed in feature directories (e.g., `components/attendance/use-attendance.ts`)
- **No `services/` directory** — API calls mixed with components or in lib files
- **No `constants/` directory** — Constants mixed with utilities

## Component Organization Summary

### Component Structure Patterns

| Pattern | Location | Example |
|---------|---------|---------|
| **shadcn/ui Primitives** | `components/ui/` | Button, Dialog, Card, Input |
| **Feature Components** | `components/{feature}/` | `components/attendance/`, `components/task/` |
| **Shell Components** | `components/shell/` | GtgAppShell, Sidebar, Header |
| **Index Files** | Selective | `components/ui/index.ts`, `components/attendance/index.ts` |

### Index Files (Barrel Exports)
**8 index files exist:**
- `components/ui/index.ts` ✅ Full exports
- `components/attendance/index.ts` ✅
- `components/attendance/dashboard-widgets/index.ts` ✅
- `components/business/index.ts` ✅
- `components/data/index.ts` ✅
- `components/organization/index.ts` ✅
- `components/workflow/index.ts` ✅
- `components/shell/agent/index.ts` ✅

**Missing index files in:**
- `components/org/` ❌ (7 components, no index)
- `components/profile/` ❌
- `components/settings/` ❌
- `components/talent/*/` ❌ (multiple subdirs)
- `components/lms/*/` ❌ (multiple subdirs)

### Component File Naming Conventions
- **PascalCase** for component files: `TaskWorkspace.tsx`
- **camelCase** for utilities: `use-attendance.ts`
- **kebab-case** in some places: `leave-balance-card.tsx`

## Styling Approach Summary

### Design System
- **Tailwind CSS v4.2.0** with CSS-first configuration
- Custom design tokens in `globals.css`:
  - Color tokens (--primary, --secondary, --success, --warning, --danger, etc.)
  - Radius scale (--radius-xs through --radius-3xl)
  - Shadow scale (--shadow-xs through --shadow-xl)
  - Brand colors (--brand, --brand-accent)
  - Sidebar-specific tokens

### Token Aliases
Custom semantic aliases exist:
- `--surface` → white/surface
- `--surface-muted` → subtle background
- `--danger` → destructive (aliased from --destructive)

### Dark Mode
Full dark mode support with CSS custom properties in `.dark` selector.

### Global Utility Classes
Custom classes defined in `globals.css`:
- `.g2g-page-scroll` — Page scrolling container
- `.g2g-scrollbar` — Custom scrollbar styling

## Key Architecture Problems

### 🔴 Critical Issues

#### 1. **Monolithic App Shell** (`components/shell/gtg-app-shell.tsx`)
- **386 lines** in a single file with massive `renderContent()` switch statement
- Renders 50+ different components inline based on navigation state
- All imports at top of file for every possible component
- This is a **God Object anti-pattern** that will become unmaintainable
- Adding new features requires modifying this file

#### 2. **Hybrid Routing Anti-Pattern**
- URLs follow `/module/{id}/{id}/{id}` pattern
- But content rendering is NOT route-driven — it's driven by `renderContent()` in AppShell
- Each page.tsx just renders `<GtgAppShell />` — pages are shells, not content
- This defeats the purpose of Next.js App Router file-based routing

#### 3. **Client Component Everywhere**
- ~100 files marked with `'use client'`
- `lib/gtg-auth.tsx` is a client component but in `lib/`
- `lib/` is typically for server-side utilities
- This creates confusion about what can/cannot be server components

#### 4. **Missing Middleware**
- No `middleware.ts` for route protection
- Auth checks happen client-side in `ProtectedLayout`
- Vulnerable to direct URL access without auth

### 🟡 Moderate Issues

#### 5. **Duplicate/Parallel Routes**
- `/module/m1/org-setup/org-profile` AND `/organization/information`
- Both seem to render OrganizationInformation component
- Creates confusion about canonical URLs

#### 6. **No Hooks Directory**
- Custom hooks placed in feature directories (`components/attendance/use-attendance.ts`)
- `components.json` defines `@/hooks` alias that doesn't exist
- Inconsistent with stated conventions

#### 7. **Inconsistent Index Files**
- Some feature dirs have index.ts, others don't
- Makes tree-shaking and imports inconsistent

#### 8. **TypeScript Files in Root lib/ Not Exported**
- `lib/Leavemanagment-data.ts`, `lib/task-utils.ts`, etc.
- These should be in `lib/data/` or `lib/services/`

#### 9. **Missing Shared Types Organization**
- Types scattered: `types/`, `lib/`, `components/*/types.ts`
- `components/attendance/types.ts` exists alongside `types/`

### 🟢 Minor Issues

#### 10. **Typo in Directory Names**
- `components/leave-managemnt/` (missing 'e' in 'management')
- `lib/Leavemanagment-data.ts`

#### 11. **Backup File**
- `app/globals.css.backup` — should be gitignored or removed

#### 12. **Inconsistent File Naming**
- Some use camelCase: `use-attendance.ts`, `report-data.ts`
- Some use kebab-case: `leave-balance-card.tsx`
- Some use snake_case: `Leave_managemntChart.tsx`

## Risk Areas

| Risk | Severity | Description |
|------|----------|-------------|
| **AppShell Maintainability** | 🔴 Critical | Adding new modules requires modifying a 386-line switch statement |
| **Bundle Size** | 🔴 Critical | All 50+ components imported in AppShell, no code splitting |
| **Route Integrity** | 🟡 High | No middleware means potential unauthorized access |
| **Scaling** | 🟡 High | Navigation state explosion as more modules are added |
| **Type Safety** | 🟡 High | Inconsistent type locations may cause import errors |
| **Code Duplication** | 🟡 Moderate | Parallel routes may render same components inconsistently |
| **Component Discovery** | 🟡 Moderate | No consistent index files makes imports verbose |
| **Naming Chaos** | 🟢 Low | Mixed naming conventions confuse new developers |

---

# 5. TESTING AND VALIDATION

## Recommended Next Audit Steps

### Phase 1: Deep Dive Analysis (Priority Order)

1. **Audit AppShell Dependencies**
   - File: `components/shell/gtg-app-shell.tsx`
   - Goal: Understand full component dependency graph
   - Identify which components are truly needed vs lazy-loaded

2. **Audit Route Coverage**
   - Compare `lib/gtg-navigation.ts` with actual page routes
   - Identify orphaned or unused navigation items
   - Map URL patterns to rendered content

3. **Audit Auth Architecture**
   - File: `lib/gtg-auth.tsx`
   - Goal: Understand auth flow and identify security gaps
   - Recommend middleware implementation

4. **Audit Component Index Coverage**
   - Goal: Identify all missing barrel exports
   - Create consistency report

5. **Audit Type Organization**
   - Goal: Map all TypeScript types to their locations
   - Identify duplicates and inconsistencies

### Phase 2: Quality Metrics

6. **Measure Bundle Impact**
   - Run `next build` with bundle analysis
   - Identify largest dependencies

7. **Count 'use client' Directives**
   - Goal: Understand client/server component ratio
   - Identify opportunities for server components

8. **Audit CSS Custom Properties**
   - Goal: Map all design tokens to their usage
   - Identify unused or duplicate tokens

### Phase 3: Documentation

9. **Update Architecture Diagram**
   - Create visual map of component relationships
   - Document navigation flow

10. **Create Component Registry**
    - Document all reusable components
    - Define ownership and dependencies

## Summary

This is a **Next.js 16 App Router** application using **shadcn/ui** with **Tailwind CSS v4**. The codebase has:
- **Good**: Solid design system, well-organized UI primitives, clear component structure
- **Concerning**: Monolithic AppShell, hybrid routing, client-heavy architecture
- **Actionable**: Establish routing conventions, extract AppShell content, organize types/hooks

**Primary Risk**: The `GtgAppShell` component is a single point of failure that will become unsustainable as the application grows. Refactoring to use proper route-driven rendering is the highest priority architectural improvement.

---

*Audit completed: 2026-07-07*
