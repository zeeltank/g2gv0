# Phase 8 — Component Audit

## Overview
The application uses a component library based on Shadcn UI (accessible via `/components/ui/`), combined with custom domain-specific components organized by feature module.

## Reusable UI Components (`/components/ui/`)
- Contains 37 primitive components.
- Heavily relies on Radix UI (`@radix-ui/react-*`), `clsx`, and `tailwind-merge` (`cn` utility).
- Standard implementation of modern React primitives (Accordion, Dialog, Select, Table, Switch, etc.).
- The components are robust and follow accessibility (a11y) best practices out-of-the-box thanks to Radix.

## Domain Components (`/components/org/`, `/components/task/`, etc.)
- Highly complex components. For example, `employee-directory.tsx` is exceptionally large (nearly 50KB) and handles a massive amount of internal state (filtering, view toggles, mock data initialization, row selection, pagination).
- **Duplication**: Similar table structures (e.g., pagination controls, filter bars) are recreated across different modules (`attendance-pagination.tsx` vs pagination logic embedded in `employee-directory.tsx`).
- **Responsibility**: Components like `cm-development-career.tsx` handle rendering the layout, parsing mock data, managing complex internal tab state, and handling nested UI elements. This violates the Single Responsibility Principle.

## Issues Identified
- **Severity High**: Component Size and Complexity. Major screens (like Employee Directory, Framework Mapping) exceed recommended limits for a single React component. They are difficult to maintain and test.
- **Severity Medium**: Logic Duplication. Common interaction patterns (like table filtering and pagination) are not fully abstracted into reusable smart components; instead, the UI primitives are reused, but the state logic is copy-pasted.

## Recommendations
1. Extract business logic, mock data initialization, and complex state management into custom hooks (e.g., `useEmployeeDirectory()`).
2. Break down monolithic screen components into smaller, composable parts (e.g., `DirectoryTable`, `DirectoryFilters`, `DirectoryHeader`).
3. Standardize higher-order patterns (like a generic `DataGrid` component that handles pagination/filtering internally).
