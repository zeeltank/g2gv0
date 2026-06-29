# Phase 1 — Project Architecture

## Executive Summary
The GapstoGrowth ERP is built as a Next.js (App Router) application. It implements a monolithic front-end architecture leveraging React, TypeScript, and Tailwind CSS. The application employs a Role-Based Access Control (RBAC) model driven by client-side mock authentication.

## Folder Structure
- `/app`: Next.js App Router root containing all routing logic.
- `/app/dashboard`: Role-specific dashboard entry points (admin, hr-operations, personal, team).
- `/app/module`: Dynamic routing layer (`/module/[moduleId]/[menuId]/[submenuId]`) mapping the navigation structure to UI components.
- `/app/api`: Very lightweight API layer, primarily for onboarding state mock via `/api/onboarding`.
- `/components`: Heavy UI layer divided by feature domains (attendance, auth, business, competency, org, task, shell, ui, etc.).
- `/lib`: Core utilities, including mock authentication (`gtg-auth.tsx`), role definition (`gtg-roles.ts`), and navigation structures (`gtg-navigation.ts`, `gtg-nav-visibility.ts`).
- `/docs`: Project documentation and specifications.

## Architecture Highlights
- **Framework**: Next.js 16.2.6 (App Router).
- **Styling**: Tailwind CSS v4.2.0 (using `@tailwindcss/postcss`) combined with Shadcn UI (Radix UI primitives).
- **Authentication**: Custom mock provider (`AuthProvider` in `gtg-auth.tsx`) utilizing `localStorage` to persist session state. No real backend JWT/session mechanism exists yet.
- **Routing**: Client-side heavy. The `GtgAppShell` component acts as a master layout and dynamically resolves the required component based on the URL path (`moduleId/menuId/submenuId`).
- **State Management**: React Context (`AuthContext`), local state (`useState`), and custom hooks (e.g., `useAttendance`). No global state library (Redux/Zustand) is in use.
- **Data Access**: Currently, the application relies entirely on mock data objects defined in the codebase (e.g., `lib/mock-data`, `components/attendance/report-data.ts`).
- **Authorization**: Based on hardcoded roles (`admin`, `hr`, `dept-head`, `employee`) mapping to route visibility in `lib/gtg-nav-visibility.ts`.

## Missing or Incomplete Architectural Elements
- **Server/Backend Integration**: The application lacks a true backend API integration layer. Everything is mock-driven on the client side.
- **Middleware**: There is no Next.js `middleware.ts` to protect routes at the edge. Route protection relies entirely on client-side layout checks (`ProtectedLayout`).
- **Data Fetching**: Heavy reliance on `use client` directives means minimal use of React Server Components (RSC) for data fetching.

## Summary
The project architecture represents a robust, well-structured UI prototype/frontend monolith, but it is currently uncoupled from any real database or backend service, relying heavily on client-side state and mock data.
