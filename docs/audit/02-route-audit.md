# Phase 2 — Route Audit

## Overview
The application uses the Next.js App Router (`/app`). The primary navigation strategy bypasses standard Next.js file-based routing for individual feature screens, instead utilizing a dynamic catch-all structure (`/module/[moduleId]/[menuId]/[submenuId]`) and mapping these parameters to React components inside a single `GtgAppShell`.

## Next.js Routes Inspected

| Route | Folder | Page Exists | Protected | Layout | Sidebar | Role | Status | Severity | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | `/app` | Yes (`page.tsx`) | No | Yes (`layout.tsx`) | N/A | Any | OK | Low | Standard root redirect logic. |
| `/login` | `/app/login` | Yes | No | Inherited | N/A | Any | OK | Low | None. |
| `/dashboard` | `/app/dashboard` | Yes | Yes (Client) | Inherited | N/A | Any | OK | Low | Redirects based on role. |
| `/dashboard/admin` | `/app/dashboard/admin` | Yes | Yes (Client) | Inherited | N/A | Admin | OK | Low | None. |
| `/dashboard/hr-operations` | `/app/dashboard/hr-operations` | Yes | Yes (Client) | Inherited | N/A | HR | OK | Low | None. |
| `/dashboard/team` | `/app/dashboard/team` | Yes | Yes (Client) | Inherited | N/A | Dept Head | OK | Low | None. |
| `/dashboard/personal` | `/app/dashboard/personal` | Yes | Yes (Client) | Inherited | N/A | Employee | OK | Low | None. |
| `/dashboard/attendance` | `/app/dashboard/attendance` | Yes | Yes (Client) | Inherited | N/A | Empl/Mgr/HR | OK | Low | None. |
| `/module/[...id]` | `/app/module/..` | Yes | Yes (Client) | Inherited | Yes | All | OK | Medium | Needs edge middleware for protection. |

## Orphan Routes / Unreachable Folders
- `/app/organization/*`: Folders like `add-detail`, `departments`, `employees`, `hierarchy`, `information`, `roles`, `screens-showcase`, `setup` exist inside `/app/organization/`, but they **lack `page.tsx`** files. They are likely remnants of an older routing structure before the `GtgAppShell` + `/module/` dynamic routing pattern was adopted.
- `/app/settings/*`: Folders like `module-configuration`, `portal-review` exist but have no `page.tsx`.
- `/app/module/m6/tm-calendar/calendar-view`: Exists without a `page.tsx`. 

## Issues Identified
- **Severity High**: Missing Next.js Middleware. Route protection is handled strictly on the client-side inside `page.tsx` files and `ProtectedLayout`. This means HTML/JS for protected routes is still technically served to unauthenticated clients before the client-side redirect happens.
- **Severity Medium**: Dead folders in `/app`. The `/app/organization/` and `/app/settings/` directories are essentially dead code and should be removed if the new `/module/` routing architecture is the final direction.

## Recommendations
1. Implement a Next.js `middleware.ts` to perform edge authentication and redirection.
2. Clean up dead routing folders (`/app/organization`, `/app/settings`, and unused subdirectories in `/app/module`).
