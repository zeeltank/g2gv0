# Phase 7 — Dashboard Structure Audit

## Overview
The application organizes its features structurally inside the `/components` folder rather than directly inside `/app` Next.js routes. 

## Structure Analysis

### `/app/dashboard`
- Purpose: Entry points based on role (`admin`, `hr-operations`, `personal`, `team`).
- Content: Minimal routing pages (`page.tsx`) that enforce RBAC and wrap the UI in the `ProtectedLayout` and `GtgAppShell`.
- Completeness: Contains only the necessary entry logic. Misses standard `loading.tsx` and `error.tsx` files.

### Feature Modules (inside `/components/`)
The actual domain logic and UI for the ERP modules are stored as feature directories within `/components/`.

1. **`attendance`**
   - Contains 30+ files.
   - Extremely dense folder structure.
   - Includes custom types (`types.ts`), hooks (`use-attendance.ts`), and mock data (`report-data.ts`).
   - Missing subdirectories for logical grouping (e.g., all dialogs/drawers are at the root of the folder).

2. **`competency`**
   - Contains 8 monolithic UI files (`cm-*.tsx`).
   - Clean naming convention (`cm-prefix`).
   - Completely missing `types`, `hooks`, `services` separation. Everything is embedded inside the large component files.

3. **`org`**
   - Contains 8 large UI files.
   - Contains an `edit-employee` subdirectory, indicating an attempt at nested routing/forms, but generally flat.
   - Missing `types`, `hooks`, `services` separation.

4. **`task`**
   - Contains 17 files (`tm-*.tsx` and view files).
   - Flat structure.
   - Misses isolated data fetching/services separation.

## Issues Identified
- **Severity Medium**: Missing `loading.tsx`, `error.tsx`, and `not-found.tsx` across the `/app` routing structure. Next.js Suspense and Error Boundaries are not being utilized.
- **Severity High**: Component folder bloat. Domain modules in `/components/` (like attendance) are becoming monolithic folders. They lack internal structure (e.g., `/components/attendance/ui/`, `/components/attendance/hooks/`).
- **Severity High**: Mixing UI and Business Logic. The feature components contain inline mock data, state management, and UI rendering in the same files.

## Recommendations
1. Reorganize feature folders (e.g., `/components/attendance/`) to include standard subdirectories: `/ui`, `/hooks`, `/types`, `/services`.
2. Add `loading.tsx` (using skeletons) and `error.tsx` (using error states) to the `/app/dashboard/*` and `/app/module/*` routes to leverage React Error Boundaries.
