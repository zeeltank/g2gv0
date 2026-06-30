# Enterprise Architecture Refactoring Plan

## Executive Summary
This document outlines the detailed roadmap to transform the GTG ERP prototype into an industry-standard, production-ready enterprise application. The current codebase serves as a high-fidelity frontend mockup but suffers from monolithic routing, tightly coupled mock data, and missing security primitives. 

This plan leverages **Next.js App Router best practices**, **Feature-Sliced Design (FSD)**, and a **Server-First approach** to ensure the codebase can scale to millions of users and dozens of developers.

---

## 1. Routing & Layout Architecture Redesign

### The Problem
The current application uses a single dynamic catch-all route (`app/module/[moduleId]/[menuId]/[submenuId]/page.tsx`) that renders a giant `switch` statement (`GtgAppShell`). This completely defeats the purpose of the Next.js App Router, causing massive initial bundle sizes, preventing server-side data fetching, and eliminating route-level error boundaries.

### The Industry Standard Solution
Adopt **Strict File-Based Routing**. Next.js automatically code-splits and optimizes based on folders.

#### Action Plan:
1. **Refactor `GtgAppShell`**: Convert it into `app/dashboard/layout.tsx`. It will no longer decide *what* to render; it will only render the Sidebar and Header, and wrap `{children}`.
2. **Expand the `/app` Directory**:
   Create dedicated routes for every screen:
   ```text
   /app
    └── /dashboard
         ├── layout.tsx                  (Secured by middleware, renders App Shell)
         ├── /organization               (M1)
         │    ├── /profile/page.tsx
         │    └── /directory/page.tsx
         ├── /competency                 (M2)
         │    └── /framework/page.tsx
         └── /attendance                 (M5)
              └── /reports/page.tsx
   ```
3. **Delete the Catch-All**: Delete the `app/module/...` dynamic route.

---

## 2. Directory Structure: Feature-Sliced Design (FSD)

### The Problem
Folders like `components/org/` and `components/attendance/` are becoming dumping grounds. `employee-directory.tsx` is an unmaintainable "God Component" (47KB, 900+ lines). It handles API mocking, local state, table layout, filtering, and sub-modals all in one file.

### The Industry Standard Solution
Adopt a variation of **Domain-Driven Design (DDD)** or **Feature-Sliced Design**. Group code by *feature*, not by *technical type*.

#### Action Plan:
1. Move from a flat `/components` structure to a `/features` structure.
2. Break down God Components.
   ```text
   /features
    └── /employee-directory
         ├── /api            (Server actions, data fetching for employees)
         ├── /components     (DirectoryTable, FilterBar, EmployeeModal)
         ├── /hooks          (useEmployeeSearch, usePagination)
         ├── /types          (Employee interface)
         └── /utils          (Formatting functions)
   ```
3. Keep `/components/ui` strictly for "dumb" Radix/Shadcn primitives (Buttons, Inputs, Dialogs).

---

## 3. Data Fetching & State Management

### The Problem
Currently, every file has `'use client'` at the top. Hardcoded mock arrays live inside the UI components. There is no infrastructure for fetching real data, caching it, or handling loading/error states cleanly.

### The Industry Standard Solution
**React Server Components (RSC) + React Query (TanStack Query)**.

#### Action Plan:
1. **Server-Side Fetching (The Default)**: The new `page.tsx` routes must NOT have `'use client'`. They will fetch secure data from the database directly on the server, resulting in zero-JS shipping to the client.
2. **Client-Side Mutations (TanStack Query)**: For highly interactive elements (like paginating a table, or submitting a form), use React Query. It handles caching, optimistic updates, and background refetching automatically.
3. **Abstract Mock Data**: Before connecting a real database, move all mock arrays into a `lib/services/mockDb.ts` file. UI components must accept data via `props`, completely decoupling the UI from the data source.

---

## 4. Authentication & Edge Security

### The Problem
Auth is currently faked using `localStorage` and checked via a client-side wrapper (`ProtectedLayout`). A bad actor can intercept the JavaScript payload before the redirect happens.

### The Industry Standard Solution
**NextAuth.js (Auth.js) + Next.js Middleware**.

#### Action Plan:
1. **Implement `middleware.ts`**: Create a middleware file at the root of the project. This runs on the Vercel Edge Network (or your server) *before* a request ever hits your application. If a user is not authenticated, they are blocked at the network level and redirected to `/login`.
2. **Install NextAuth.js**: Standardize session management, JWT signing, and secure cookie storage.
3. **Delete `ProtectedLayout`**: Once middleware is in place, client-side wrappers are no longer needed for route protection.

---

## 5. Database & ORM Strategy

### The Problem
There is no database.

### The Industry Standard Solution
**Prisma ORM** or **Drizzle ORM** with **PostgreSQL**.

#### Action Plan:
1. Initialize Prisma (`npx prisma init`).
2. Design the Enterprise Schema (`User`, `Organization`, `Department`, `Role`, `AttendanceLog`, `Task`).
3. Replace the `lib/services/mockDb.ts` calls with real `prisma.user.findMany()` calls inside your Server Components and Server Actions.

---

## Phased Execution Roadmap

### Phase 1: Structural Refactor (No DB yet)
- Restructure `GtgAppShell` into `app/dashboard/layout.tsx`.
- Create explicit file-based routes for all M1, M2, M5, and M6 modules.
- Abstract all mock data into a mock service layer.

### Phase 2: Component Breakdown
- Adopt the `/features` directory.
- Break apart monolithic files (`employee-directory.tsx`, `cm-framework-mapping.tsx`) into UI, hooks, and types.

### Phase 3: Security & Auth
- Install NextAuth.js.
- Implement Edge Middleware for route protection.

### Phase 4: Backend Integration
- Provision PostgreSQL Database.
- Implement Prisma ORM.
- Swap mock service calls for real database queries in Server Components.
