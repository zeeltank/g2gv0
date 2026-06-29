# Phase 5 — Role-Based Access Control (RBAC) Audit

## Overview
The application defines four primary roles: `admin`, `hr`, `dept-head`, and `employee`. 
RBAC is implemented in two main areas:
1. **Navigation Visibility** (`lib/gtg-nav-visibility.ts`): Determines which modules and menus appear in the sidebar based on the user's role.
2. **Page-Level Protection** (`app/dashboard/*/page.tsx`): Hardcoded checks to ensure a user accessing a specific dashboard URL actually possesses the required role.

## Role Permission Matrix (Observed)

| Module / Area | Admin | HR | Dept Head | Employee |
| --- | --- | --- | --- | --- |
| M1 (Org Setup) | Full | Full | Full | Full |
| M2 (Competency) | Full | Full | Full | Full |
| M3 (Talent) | Full | Full | Scoped | Scoped |
| M4 (LMS) | Full | Full | Full | Full |
| M5 (HRIT) | Full | Full | Scoped | Scoped |
| M6 (Tasks) | Full | Full | Full | Full |
| Admin Dashboard | **Yes** | No | No | No |
| HR Dashboard | No | **Yes** | No | No |
| Team Dashboard | No | No | **Yes** | No |
| Personal Dashboard | No | No | No | **Yes** |

## Implementation Analysis
- **Sidebar Visibility**: Handled gracefully via `filterNavigationByRole` which trims the `GTG_NAVIGATION` tree before rendering `GtgSidebar`.
- **Route Authorization Mismatch**: 
  - **CRITICAL**: The dynamic route catch-all `/module/[moduleId]/[menuId]/[submenuId]` maps directly to the `GtgAppShell` which renders content using a `switch` statement based on URL parameters. 
  - **The Flaw**: `gtg-app-shell.tsx` does **not** re-verify if the user actually has permission to view the component it is rendering. While the sidebar hides unauthorized links, a user can manually type `/module/m1/user-management/role-permissions` into the URL bar and bypass the sidebar restriction.
- **Component-Level Access**: `gtg-roles.ts` defines a `MATRIX` and a `getAccess` function (returning 'full', 'view', 'scoped', 'none') for the M1 Org Setup screens. This is a very robust pattern! However, it is **only implemented for 4 pages** (`organization-information`, `add-organization-detail`, `department-list`, `department-hierarchy`).

## Issues Identified
- **Severity Critical**: Dynamic routes (`/module/...`) lack server-side or even client-side authorization checks against the requested `submenuId`. They blindly render what is requested if the component exists in the `switch` statement.
- **Severity Medium**: Inconsistent RBAC enforcement. M1 uses a sophisticated `getAccess` matrix, while other modules do not implement granular component-level permissions at all.

## Recommendations
1. Secure the dynamic `/module/...` catch-all by checking `canAccessMenu(submenuId, user.role)` inside `gtg-app-shell.tsx` (or better, in middleware). If false, render the `AccessDeniedPage`.
2. Expand the `gtg-roles.ts` permission MATRIX to cover all modules and screens consistently.
