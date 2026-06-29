# Phase 11 — Navigation Audit

## Overview
Navigation is highly centralized in `lib/gtg-navigation.ts` which exports the `GTG_NAVIGATION` tree (Modules -> Menus -> Submenus). This single source of truth is excellent.

## Implementation Analysis
- **Sidebar Integration**: The sidebar (`components/shell/gtg-sidebar.tsx`) ingests the navigation tree, filters it based on the user's role using `lib/gtg-nav-visibility.ts`, and renders the interactive UI.
- **Breadcrumbs Integration**: `gtg-navigation.ts` provides a `resolveBreadcrumb` utility that looks up the active IDs and returns human-readable labels for the `GtgBreadcrumb` component.
- **Routing Integration**: The URL structure exactly mirrors the navigation structure (`/module/[moduleId]/[menuId]/[submenuId]`).

## Issues Identified
- **Severity Low**: The `GtgAppShell` contains a massive `switch` statement that must be manually updated every time a new route is added to `gtg-navigation.ts`. This dual-maintenance is error-prone.
- **Severity Low**: Missing Default Routing. Clicking on a top-level Module or Menu that has children often requires an explicit click on the child Submenu. There is no auto-redirect to the first available child route.

## Recommendations
1. Instead of a hardcoded `switch` statement in `GtgAppShell`, implement Next.js dynamic imports based on the route mapping, or split the monolithic shell into standard nested `page.tsx` routes.
2. Implement intelligent default redirects (e.g., clicking "Competency Management" should auto-redirect to `/module/m2/cm-command-center`).
