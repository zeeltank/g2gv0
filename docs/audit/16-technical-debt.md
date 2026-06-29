# Phase 16 — Technical Debt

## Overview
Technical debt is categorized by severity to help prioritize refactoring efforts before transitioning from a frontend prototype to a production-ready application.

## Critical Severity (Fix Immediately)
1. **Category**: Architecture & Security
   - **Description**: Entire application relies on mock client-side authentication and routing checks.
   - **Why**: Anyone can bypass the UI and access protected client bundles.
   - **Solution**: Implement Next.js `middleware.ts` and a real Auth Provider (e.g., Auth.js).
   - **Effort**: High

2. **Category**: Data Persistence
   - **Description**: No database or API layer. All data is hardcoded mock data.
   - **Why**: The app cannot save or retrieve real user data.
   - **Solution**: Set up Prisma/Drizzle ORM and migrate mock data to a database.
   - **Effort**: Very High

## High Severity (Fix Before Release)
1. **Category**: Performance & Layout
   - **Description**: `GtgAppShell` statically imports every single module component in the ERP.
   - **Why**: Results in a massive initial JavaScript payload.
   - **Solution**: Refactor to use standard Next.js nested `page.tsx` routes, or use `next/dynamic` for code splitting.
   - **Effort**: Medium

2. **Category**: Code Quality
   - **Description**: "God components" (e.g., `employee-directory.tsx`) handling too much state and UI.
   - **Why**: Unmaintainable and untestable over time.
   - **Solution**: Break down into smaller composite components and custom hooks.
   - **Effort**: High

## Medium Severity (Fix as you go)
1. **Category**: Routing
   - **Description**: Dead routing folders (`/app/organization`, `/app/settings`).
   - **Why**: Clutters codebase and causes confusion.
   - **Solution**: Delete unused route folders.
   - **Effort**: Low

2. **Category**: Linting
   - **Description**: `next.config.mjs` ignores TypeScript build errors.
   - **Why**: Hides bad imports and typing errors.
   - **Solution**: Remove `ignoreBuildErrors: true` and fix the resulting errors.
   - **Effort**: Low to Medium
