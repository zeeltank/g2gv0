# 1. OBJECTIVE

Create a practical, scalable folder structure for the GTG frontend codebase and document it in `docs/frontend/folder-structure.md`.

The structure must support:
- shadcn/ui base components
- App-level UI components
- Domain components
- Feature modules
- Shared utilities
- Hooks
- Services
- Types
- Config
- Docs
- Future registries or packages

# 2. CONTEXT SUMMARY

**Current State:**
- Next.js 16.2.6 with App Router
- shadcn/ui components in `components/ui/`
- Domain components flat in `components/` root (auth, org, task, lms, talent, hrit, competency, compliance-discipline, settings, profile, organization-setup)
- Shared components scattered (business, data, workflow, illustration)
- Shell components in `components/shell/`
- Mixed utilities in `lib/`
- Shared hooks in `hooks/`
- TypeScript types in `types/`
- Path aliases configured in `tsconfig.json`

**Key Problems to Solve:**
1. Domain components are flat, making navigation difficult
2. Shared vs domain component boundaries unclear
3. No dedicated services folder for API abstraction
4. Inconsistent naming and barrel file practices
5. No documented import direction rules

# 3. APPROACH OVERVIEW

Design a layered folder structure with clear boundaries:

```
components/
├── ui/         → Layer 1: shadcn/ui primitives (foundation)
├── shared/     → Layer 2: Cross-domain components
├── domain/     → Layer 3: Domain-specific components
└── shell/      → Layer 4: Layout components
```

Define import direction rules: **downward through layers only**.

Key decisions:
- **Flat domain folders → nested:** `components/{domain}/` → `components/domain/{domain}/`
- **Scattered shared → consolidated:** `components/{business,data,workflow,illustration}/` → `components/shared/{...}/`
- **Create future folders:** `services/`, `config/` (not implemented yet)
- **Barrel files:** Required for domain and shared directories

# 4. IMPLEMENTATION STEPS

## Step 1: Create Folder Structure Documentation

**Goal:** Document the complete folder structure and all organizational rules.

**Method:** Create `/workspace/project/g2gv0/docs/frontend/folder-structure.md` with:

1. **Target folder structure** (tree diagram)
2. **Folder definitions** (purpose, what belongs, what doesn't)
3. **Import direction rules** (with diagrams and tables)
4. **File naming rules** (conventions for components, hooks, utils, types)
5. **Index/barrel file rules** (when to use, pattern examples)
6. **Migration priority** (phased approach with priorities)
7. **Quick reference** (where to put new files)

**Output file:** `/workspace/project/g2gv0/docs/frontend/folder-structure.md`

**Reference files examined:**
- `/workspace/project/g2gv0/components/` - current component structure
- `/workspace/project/g2gv0/hooks/` - current hooks structure
- `/workspace/project/g2gv0/lib/` - current utilities structure
- `/workspace/project/g2gv0/types/` - current types structure
- `/workspace/project/g2gv0/tsconfig.json` - path alias configuration
- `/workspace/project/g2gv0/docs/frontend/component-structure.md` - existing documentation

## Step 2: Document Migration Priority (in same file)

**Goal:** Provide actionable guidance for future reorganization.

**Method:** Add migration phases to the documentation:

| Phase | Action | Priority |
|-------|--------|----------|
| 1 | Documentation only (current) | ✅ Done |
| 2 | Rename `components/{domain}/` → `components/domain/{domain}/` | Medium |
| 3 | Move shared to `components/shared/` | Medium |
| 4 | Create `services/` and `config/` | Low |

# 5. TESTING AND VALIDATION

1. **File creation:** Confirm `/workspace/project/g2gv0/docs/frontend/folder-structure.md` exists with content
2. **Structure completeness:** Verify all 8 required sections are present:
   - Target folder structure
   - Purpose of each folder
   - What belongs/doesn't belong
   - Import direction rules
   - File naming rules
   - Index/barrel file rules
   - Migration priority
3. **Consistency check:** Terminology matches existing docs in `docs/frontend/`
4. **Accuracy check:** Paths and examples reflect current codebase
5. **Readability:** Document is clear for both developers and AI agents

---

# APPENDIX: Complete Folder Structure Documentation

The following content should be written to `/workspace/project/g2gv0/docs/frontend/folder-structure.md`:

---

## Document Content for folder-structure.md

```markdown
---
title: Frontend Folder Structure
description: Guidelines for organizing the GTG frontend codebase
lastUpdated: 2026-07-12
tags: [architecture, folder-structure, guidelines]
audience: [developers, ai-agents]
---

# Frontend Folder Structure

This document defines the target folder structure for the GTG frontend codebase.

## Target Folder Structure

\`\`\`
├── app/                      # Next.js App Router pages
│   ├── (auth)/               # Auth route group
│   ├── (dashboard)/          # Dashboard route group
│   └── api/                  # API routes
│
├── components/               # React components
│   ├── ui/                   # Layer 1: shadcn/ui base components
│   ├── shared/               # Layer 2: App-level shared components
│   ├── domain/               # Layer 3: Domain-specific components
│   └── shell/                # App shell components
│
├── hooks/                    # React hooks
├── lib/                      # Utilities and helpers
├── services/                 # API service layer (future)
├── types/                    # TypeScript type definitions
├── config/                   # Configuration files (future)
└── docs/                     # Documentation
\`\`\`

## Folder Definitions

### \`app/\` — Next.js App Router

**What belongs here:** Pages, layouts, route groups, API routes, loading/error states.

**What does NOT belong here:** Shared components, utilities, business logic.

### \`components/ui/\` — Base Components

**Purpose:** shadcn/ui primitive components (foundation layer).

**What belongs here:** shadcn/ui components, Radix wrappers, pure UI primitives (Button, Input, Badge).

**What does NOT belong here:** Domain-specific components, business logic.

**Important:** READ-ONLY for shadcn components.

### \`components/shared/\` — App-Level Shared Components

**Purpose:** Cross-domain components used by multiple features.

**What belongs here:** KPI cards, charts, filters, EmptyState, ErrorState, data tables.

**What does NOT belong here:** Single-domain components, route-specific layouts.

### \`components/domain/\` — Domain Components

**Purpose:** Domain-specific components organized by business capability.

**Domain directories:**
\`\`\`
components/domain/
├── auth/                     # Authentication
├── org/                      # Organization management
├── profile/                  # User profiles
├── task/                     # Task management
├── lms/                      # Learning management
├── talent/                   # Talent management
├── competency/              # Competency management
├── hrit/                     # HRIT (attendance, leave)
├── compliance/               # Compliance & discipline
├── settings/                 # Module settings
└── onboarding/              # Organization onboarding
\`\`\`

### \`components/shell/\` — App Shell

**What belongs here:** AppShell, Sidebar, Header, PageHeader, Breadcrumb, BrandMark.

### \`hooks/\` — React Hooks

**Naming:** \`use-CamelCase.ts\` → \`useAuth.ts\`

### \`lib/\` — Utilities

**Naming:** \`camelCase.ts\` → \`formatDate.ts\`

### \`services/\` — API Service Layer (Future)

**Purpose:** API calls and data fetching abstractions.

### \`types/\` — TypeScript Types

**Purpose:** Shared type definitions.

## Import Direction Rules

### The Dependency Rule

Imports flow downward: \`app\` → \`domain\` → \`shared\` → \`ui\`

### Forbidden Imports

| From | To | Allowed? |
|------|----|----------|
| \`components/ui/\` | \`components/domain/\` | ❌ No |
| \`components/shared/\` | \`components/domain/\` | ❌ No |
| \`components/domain/\` | \`app/\` | ❌ No |
| \`lib/\` | \`components/*/\` | ❌ No |

### Allowed Imports

| From | To | Allowed? |
|------|----|----------|
| \`app/\` | \`components/*/\` | ✅ Yes |
| \`components/domain/\` | \`components/shared/\` | ✅ Yes |
| \`components/domain/\` | \`components/ui/\` | ✅ Yes |
| \`hooks/\` | \`lib/\` | ✅ Yes |

## File Naming Rules

| Type | Convention | Example |
|------|------------|---------|
| Component | \`PascalCase.tsx\` | \`TaskBoardView.tsx\` |
| Folder | \`kebab-case\` | \`task-board/\` |
| Hook | \`use-CamelCase.ts\` | \`useAuth.ts\` |
| Utility | \`camelCase.ts\` | \`formatDate.ts\` |
| Type | \`camelCase.ts\` | \`userTypes.ts\` |

## Index/Barrel File Rules

**Use barrel exports for:**
- Domain directories
- Shared component directories
- Root-level utility exports

**Avoid for:**
- \`components/ui/\` (shadcn manages)
- Deeply nested (>3 levels)
- Single-component directories

**Pattern:**
\`\`\`typescript
// components/shared/feedback/index.ts
export { EmptyState } from './empty-state'
export { ErrorState } from './error-state'
\`\`\`

## Migration Priority

| Phase | Action | Priority |
|-------|--------|----------|
| 1 | ✅ Document structure (current) | Done |
| 2 | Rename \`components/{domain}/\` → \`components/domain/{domain}/\` | Medium |
| 3 | Move shared to \`components/shared/\` | Medium |
| 4 | Create \`services/\` and \`config/\` | Low |

## Quick Reference

| Question | Answer |
|----------|--------|
| shadcn component? | \`components/ui/\` |
| Used by 2+ domains? | \`components/shared/\` |
| Domain-specific? | \`components/domain/{name}/\` |
| Layout? | \`components/shell/\` |
| Hook? | \`hooks/\` |
| Utility? | \`lib/\` |
| API call? | \`services/\` (future) |
| Shared type? | \`types/\` |
| Page? | \`app/\` |
```

---

**Note:** The code agent should create the file `/workspace/project/g2gv0/docs/frontend/folder-structure.md` with the complete documentation content shown above.
