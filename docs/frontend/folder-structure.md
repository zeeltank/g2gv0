---
title: Frontend Folder Structure
description: Guidelines for organizing the GTG frontend codebase
lastUpdated: 2026-07-12
tags: [architecture, folder-structure, guidelines]
audience: [developers, ai-agents]
---

# Frontend Folder Structure

This document defines the folder structure for the GTG frontend codebase.

## Current Folder Structure

```
├── app/                      # Next.js App Router pages
│   ├── api/                  # API routes
│   ├── dashboard/            # Dashboard pages
│   ├── login/                # Authentication pages
│   ├── module/               # Module pages
│   ├── organization/         # Organization pages
│   ├── profile/              # Profile pages
│   └── settings/             # Settings pages
│
├── components/               # React components
│   ├── ui/                   # Layer 1: shadcn/ui base components
│   ├── shared/               # Layer 2: App-level shared components
│   │   ├── business/         #   Business widgets (KPI cards, charts)
│   │   ├── data/             #   Data utilities
│   │   ├── workflow/         #   Workflow components
│   │   └── illustration/     #   Illustrations
│   ├── domain/               # Layer 3: Domain-specific components
│   │   ├── organization/      #   Organization Management
│   │   ├── competency/       #   Competency Management
│   │   ├── task/             #   Task Management
│   │   ├── lms/              #   Learning Management System
│   │   ├── hrms/             #   HRMS (attendance, leave, compliance)
│   │   └── talent/           #   Talent Management
│   ├── auth/                 # Authentication components
│   ├── profile/              # Profile components
│   ├── settings/             # Settings components
│   └── shell/                # App shell components
│
├── hooks/                    # React hooks
├── lib/                      # Utilities and helpers
├── services/                 # API service layer (future)
├── types/                    # TypeScript type definitions
├── config/                   # Configuration files (future)
└── docs/                     # Documentation
```

## Core Modules

The codebase is organized around 6 core business domains:

| Module | Path | Description |
|--------|------|-------------|
| **Organization Management** | `components/domain/organization/` | Departments, employees, roles, onboarding |
| **Competency Management** | `components/domain/competency/` | Competency frameworks, assessments, certifications |
| **Task Management** | `components/domain/task/` | Projects, tasks, kanban, calendar views |
| **Learning Management (LMS)** | `components/domain/lms/` | Course catalog, assignments, delivery, records |
| **HRMS** | `components/domain/hrms/` | Attendance, leave management, compliance |
| **Talent Management** | `components/domain/talent/` | Recruitment, onboarding, performance, mobility |

## Folder Definitions

### `components/ui/` — Base Components

**Purpose:** shadcn/ui primitive components (foundation layer).

**What belongs here:** shadcn/ui components, Radix wrappers, pure UI primitives (Button, Input, Badge).

**What does NOT belong here:** Domain-specific components, business logic.

**Important:** READ-ONLY for shadcn components.

### `components/shared/` — App-Level Shared Components

**Purpose:** Cross-domain components used by multiple features.

**Subdirectories:**
- `business/` — KPI cards, charts, activity widgets
- `data/` — Data utilities
- `workflow/` — Workflow stepper, process components
- `illustration/` — Setup wizard illustrations

### `components/domain/` — Domain Components

**Purpose:** Domain-specific components organized by business capability.

Each domain module contains components specific to that business domain.

### `components/shell/` — App Shell

**What belongs here:** AppShell, Sidebar, Header, PageHeader, Breadcrumb, BrandMark.

### `hooks/` — React Hooks

**Naming:** `use-CamelCase.ts` → `useAuth.ts`

### `lib/` — Utilities

**Naming:** `camelCase.ts` → `formatDate.ts`

### `types/` — TypeScript Types

**Purpose:** Shared type definitions.

## Import Direction Rules

### The Dependency Rule

Imports flow downward: `app` → `domain` → `shared` → `ui`

### Forbidden Imports

| From | To | Allowed? |
|------|----|----------|
| `components/ui/` | `components/domain/` | ❌ No |
| `components/shared/` | `components/domain/` | ❌ No |
| `components/domain/` | `app/` | ❌ No |
| `lib/` | `components/*/` | ❌ No |

### Allowed Imports

| From | To | Allowed? |
|------|----|----------|
| `app/` | `components/*/` | ✅ Yes |
| `components/domain/` | `components/shared/` | ✅ Yes |
| `components/domain/` | `components/ui/` | ✅ Yes |
| `hooks/` | `lib/` | ✅ Yes |

## File Naming Rules

| Type | Convention | Example |
|------|------------|---------|
| Component | `PascalCase.tsx` | `TaskBoardView.tsx` |
| Folder | `kebab-case` | `task-board/` |
| Hook | `use-CamelCase.ts` | `useAuth.ts` |
| Utility | `camelCase.ts` | `formatDate.ts` |
| Type | `camelCase.ts` | `userTypes.ts` |

## Index/Barrel File Rules

**Use barrel exports for:**
- Domain directories (`components/domain/*/index.ts`)
- Shared component directories
- Root-level utility exports

**Avoid for:**
- `components/ui/` (shadcn manages)
- Deeply nested (>3 levels)
- Single-component directories

**Pattern:**
```typescript
// components/domain/task/index.ts
export { TaskBoardView } from './task-board-view'
export { TaskListView } from './task-list-view'
export { TaskCalendarView } from './task-calendar-view'
```

## Quick Reference

| Question | Answer |
|----------|--------|
| shadcn component? | `components/ui/` |
| Used by 2+ domains? | `components/shared/` |
| Organization/department/employee? | `components/domain/organization/` |
| Competency/assessment? | `components/domain/competency/` |
| Project/task? | `components/domain/task/` |
| Course/learning? | `components/domain/lms/` |
| Attendance/leave/compliance? | `components/domain/hrms/` |
| Recruitment/performance? | `components/domain/talent/` |
| Layout? | `components/shell/` |
| Hook? | `hooks/` |
| Utility? | `lib/` |
| API call? | `services/` (future) |
| Shared type? | `types/` |
| Page? | `app/` |
