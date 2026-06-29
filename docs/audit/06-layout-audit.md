# Phase 6 — Layout Audit

## Overview
The application utilizes Next.js App Router layouts.
- Root Layout (`app/layout.tsx`): Wraps the HTML/Body and provides the `AuthProvider`.
- The application then heavily relies on a custom "Master Layout" component (`GtgAppShell` in `components/shell/gtg-app-shell.tsx`) rather than standard nested `layout.tsx` files.

## Layout Hierarchy Analysis

### The Expected Standard
Ideally, a Next.js App Router app uses nested layouts:
`RootLayout` -> `DashboardLayout` -> `ModuleLayout` -> `PageContent`

### The Implemented Reality
The application uses a hybrid approach:
1. Root `layout.tsx` establishes fonts, basic styling, and `AuthContext`.
2. Protected routes (`app/dashboard/*/page.tsx`) explicitly wrap their content in a client-side `<ProtectedLayout>`.
3. Inside the protected layout, the `<GtgAppShell>` is invoked.
4. `GtgAppShell` renders the Sidebar, Header, Breadcrumbs, and a main `<main>` content area. 
5. `GtgAppShell` dynamically injects the appropriate module component based on the URL.

## Issues Identified
- **Severity Medium**: Departure from Next.js conventions. By relying on a master `GtgAppShell` component containing a massive `switch` statement to render sub-components based on route params, the application bypasses the built-in benefits of Next.js layouts (e.g., partial rendering, parallel routes, localized error boundaries). 
- **Severity Medium**: The `GtgAppShell` is a monolithic file (~370 lines) that imports nearly every top-level module screen component in the app. This creates a massive single bundle if not utilizing dynamic imports (Next.js `dynamic()`).
- **Severity Low**: The `app/organization` and `app/settings` folders do not utilize the `GtgAppShell` and seem to be disconnected from the current layout paradigm.

## Recommendations
1. **Refactor `GtgAppShell` routing**: Instead of the `GtgAppShell` rendering the content via a `switch` statement, `GtgAppShell` should act as a true layout component (`app/module/layout.tsx`) that simply takes `{ children }` as a prop.
2. The individual screens should be actual `page.tsx` files under `/app/module/...` which Next.js will naturally inject into the `{ children }` of the layout. This restores standard Next.js conventions, code-splitting, and partial rendering.
