# Phase 10 — API & Database Audit

## Overview
The application is currently operating as a frontend-heavy prototype. There is virtually no backend API infrastructure, no database connection, and no Server Actions implemented.

## Implementation Analysis
- **API Routes**: Only one API route exists (`/app/api/onboarding/route.ts`). It uses an in-memory `Map` attached to `globalThis` to simulate storing onboarding state. This state will wipe out every time the Next.js development server restarts or serverless functions cold-boot in production.
- **Data Access**: Data is hardcoded directly inside components (e.g., arrays of mock activities, users, competencies).
- **Authentication API**: Handled locally via `lib/gtg-auth.tsx` simulating a network delay and checking against a static dictionary of 4 users.
- **Server Actions**: None observed. The codebase is heavily reliant on `"use client"` directives at the top of virtually every major component.

## Issues Identified
- **Severity Critical**: No Data Persistence. The application cannot save data permanently.
- **Severity Critical**: Lack of API Security. The mock `/api/onboarding` route does not validate authentication headers or JWTs. It simply expects a `userId` query parameter, making it entirely insecure and susceptible to tampering (IDOR vulnerability).

## Recommendations
1. Establish a database connection (e.g., PostgreSQL via Prisma or Drizzle ORM).
2. Migrate hardcoded mock data to database seeding scripts.
3. Replace the mock authentication with a real provider (Auth.js) and establish API route protection logic (verifying sessions before returning data).
4. Refactor client-side data fetching (currently mostly static) to use React Server Components (fetching data directly on the server) or `tRPC` / `SWR` / `React Query` for client-side hydration.
