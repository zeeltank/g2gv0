---
title: GTG Frontend Design System Strategy
description: Design system rules and conventions for GTG frontend
lastUpdated: 2026-07-08
tags: [design-system, frontend, react, nextjs, typescript, ai-development]
audience: [developers, ai-agents]
---

# GTG Frontend Design System Strategy

This document establishes clear rules for the GTG frontend design system, maintaining consistency across the codebase while enabling rapid development by both humans and AI agents.

---

## Quick Reference Card

> **TL;DR** — The essential rules for quick lookup during development.

### The 5 Commandments

| # | Rule | Why |
|---|------|-----|
| 1 | **NEVER** modify `components/ui/*.tsx` directly | Preserve shadcn upgrade path |
| 2 | **ALWAYS** use `hsl(var(--token))` for colors | Theme consistency |
| 3 | **NEVER** import across domain layers | Prevent coupling |
| 4 | **ALWAYS** use CVA for variants | Type-safe, composable |
| 5 | **ALWAYS** export via barrel `index.ts` | Clean imports |

### Layer Selection Decision Tree

```
Is it a Radix/shadcn primitive?
├── YES → Layer 1 (components/ui/)
└── NO
    ├── Used by 2+ domains without domain knowledge?
    │   ├── YES → Layer 2 (components/business/)
    │   └── NO
    │       ├── Domain-specific logic/data types?
    │       │   ├── YES → Layer 3 (components/{domain}/)
    │       │   └── NO → Reconsider if component is needed
    │       └── Used only within one feature? → Layer 3
```

### File Naming Rules

| Type | Convention | Example |
|------|------------|---------|
| Components | `PascalCase.tsx` | `AttendanceCard.tsx` |
| Utilities | `camelCase.ts` | `formatDate.ts` |
| Types | `camelCase.ts` | `attendanceTypes.ts` |
| Hooks | `camelCase.ts` | `useAttendance.ts` |
| Tests | `ComponentName.test.tsx` | `KPICard.test.tsx` |
| Stories | `ComponentName.stories.tsx` | `Button.stories.tsx` |
| Styles | `kebab-case.module.css` | `attendance-card.module.css` |

### ALWAYS / NEVER Quick Reference

```markdown
✅ ALWAYS
- Use @/ path aliases (never relative paths like ../../)
- Export types alongside components
- Use named exports (never default exports)
- Add 'use client' directive for client components
- Use forwardRef with displayName for wrapped components
- Co-locate tests with components

❌ NEVER
- Modify components/ui/*.tsx (except accessibility fixes)
- Use hardcoded colors (#fff, rgb(), etc.)
- Import from Layer 3 domains
- Create utility wrappers for single elements
- Use inline styles for static values
- Prop drill beyond 2 levels
```

---

## Design System Goals

1. **shadcn/ui First**: Keep base components pristine, never modify source
2. **Extension Over Forking**: Build custom variants on top, not replacements
3. **Layered Architecture**: Clear boundaries between tokens → primitives → app UI → domain
4. **Minimal Abstractions**: No new component libraries unless truly reusable across domains
5. **Token-Driven Theming**: All visual decisions via CSS custom properties

---

## Layer Model

### Layer 0: Design Tokens
- **Location**: `app/globals.css`
- **Owner**: Frontend lead
- **Purpose**: CSS custom properties for colors, spacing, typography, shadows, radii
- **Rules**:
  - All color values MUST reference tokens, never hardcoded hex
  - New tokens require design review
  - Token naming: `--color-{name}-{weight}` (e.g., `--color-primary-500`)

### Layer 1: UI Primitives (shadcn/ui)
- **Location**: `components/ui/`
- **Owner**: Frontend team (read-only)
- **Purpose**: Accessible Radix-based base components
- **Rules**:
  - NEVER edit source files directly
  - Use CVA to add variants without modifying base
  - When shadcn updates, accept changes without conflict
  - Import from `@/components/ui` only

### Layer 2: App UI Components
- **Location**: `components/{shell,business,workflow,data}/`
- **Owner**: Frontend team
- **Purpose**: GTG-specific compositions used across multiple domains
- **Examples**: KPICard, StatusBadge, WorkflowStepper, DataTable
- **Rules**:
  - Compose from Layer 1 components
  - May have business logic but no domain knowledge
  - Re-exported via `components/ui/index.ts` for convenience

### Layer 3: Domain Components
- **Location**: `components/{feature}/`
- **Owner**: Feature team
- **Purpose**: Feature-specific components used only in one domain
- **Examples**: LeaveCalendar, TaskBoard, TalentProfile
- **Rules**:
  - May import from Layers 0-2
  - Cannot be imported by other domains without going through Layer 2
  - Co-locate tests and stories

---

## shadcn/ui Base Layer Rules

### When You MAY Edit `components/ui/*.tsx` Files
- Fix accessibility bugs (ARIA attributes, keyboard navigation)
- Fix TypeScript type errors from genuine bugs, not missing props
- Accept shadcn version updates without conflicts

### When You MUST NOT Edit `components/ui/*.tsx` Files
- Add custom styling that belongs in Layer 2
- Add business-specific variants (create Layer 2 wrapper instead)
- Change Radix primitive behavior
- Add feature-specific props

### How to Extend Without Editing

**Pattern 1: CVA Wrapper (Preferred)**
```typescript
// components/business/status-badge.tsx
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { cva, type VariantProps } from 'class-variance-authority'

const statusVariants = cva('capitalize', {
  variants: {
    status: {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      approved: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300',
    },
  },
})

export type StatusBadgeProps = VariantProps<typeof statusVariants> & {
  children: React.ReactNode
}

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  return (
    <Badge className={cn(statusVariants({ status }), className)}>
      {children}
    </Badge>
  )
}
```

**Pattern 2: Re-export with Defaults**
```typescript
// components/ui/button.tsx (GTG customizations)
export { Button } from './button'  // shadcn source
export { buttonVariants } from './button'  // re-export for extension
export type { ButtonProps } from './button'
```

---

## App UI Layer Rules

### What Belongs Here
Components used by 2+ domains that have no domain-specific knowledge:

| Component | Purpose | Domains Using |
|-----------|---------|---------------|
| KPICard | Display metric summaries | Dashboard, Attendance, Tasks |
| StatusBadge | Workflow status display | Tasks, Leave, Approvals |
| DataTable | Generic data grids | Multiple |
| WorkflowStepper | Multi-step process UI | Leave, Tasks |
| EmptyState | No-data placeholders | All |
| LoadingSkeleton | Content loading states | All |

### When to Create App UI Components
- Used by ≥2 domains (verify via grep before creating)
- No feature-specific logic or data shapes
- Could theoretically be open-sourced

### When NOT to Create App UI Components
- Single domain use → create in domain layer
- Contains business logic → move logic to hooks first
- Requires domain types → belongs in domain layer

### Folder Structure
```
components/
├── ui/                    # Layer 1: shadcn primitives
├── business/              # Layer 2: App UI components
│   ├── kpi-card.tsx
│   ├── status-badge.tsx
│   ├── data-table.tsx
│   └── index.ts           # Re-exports for convenience
├── shell/                 # App shell (layout, navigation)
└── workflow/              # Workflow-specific compositions
```

### Ownership
- PRs require 1 approval from any frontend team member
- Breaking changes require deprecation notice in PR

---

## Domain Component Rules

### Folder Structure
```
components/
├── attendance/
│   ├── components/       # Domain components
│   │   ├── attendance-calendar.tsx
│   │   ├── attendance-summary.tsx
│   │   └── index.ts
│   ├── hooks/            # Domain logic
│   ├── types.ts          # Domain types
│   └── utils.ts          # Domain utilities
├── task/
│   └── ...
```

### When to Create Domain Components
- Component is only used within this feature
- Component knows about domain types/hooks
- Component would not make sense in another domain

### When NOT to Create Domain Components
- 2+ domains need it → move to Layer 2
- Pure UI with no domain knowledge → could be Layer 2 candidate
- Utility function with no domain logic → belongs in `lib/`

### Import Rules
```
ALLOWED IMPORTS:
✓ @/components/ui/*       (Layer 1)
✓ @/components/business/* (Layer 2)
✓ @/lib/utils            (utilities only)
✓ @/hooks/*              (hooks only)
✓ @/types/*              (types only)
✓ @/lib/mock-data/*     (mock data)

FORBIDDEN IMPORTS:
✗ @/components/attendance (Layer 3)
✗ @/components/task       (Layer 3)
✗ Other domain imports    (Layer 3)
```

---

## Token Usage Guidelines

### CSS Custom Properties

**Color tokens** must use the `hsl(var(--token))` pattern:

```tsx
// Correct
<div className="text-primary bg-card border-border" />
<div style={{ color: 'hsl(var(--primary))' }} />

// Incorrect
<div className="text-orange-500" />
<div style={{ color: '#ff6a00' }} />
```

### Available Token Categories

| Category | Tokens | Usage |
|----------|--------|-------|
| Surfaces | `--background`, `--foreground`, `--card`, `--muted` | Page backgrounds, text |
| Actions | `--primary`, `--secondary`, `--accent` | Buttons, links, highlights |
| Status | `--success`, `--warning`, `--destructive` | Feedback states |
| Borders | `--border`, `--input`, `--ring` | Dividers, form fields, focus |
| Brand | `--brand`, `--brand-foreground`, `--brand-accent` | Brand colors (navy/orange) |

### Spacing Scale

Use Tailwind spacing utilities:

| Token | rem | px | Tailwind |
|-------|-----|----|----------|
| xs | 0.25 | 4 | `space-1` |
| sm | 0.5 | 8 | `space-2` |
| md | 1 | 16 | `space-4` |
| lg | 1.5 | 24 | `space-6` |
| xl | 2 | 32 | `space-8` |

---

## Variant Management

### CVA (class-variance-authority)

Use CVA for component variants:

```typescript
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva('inline-flex items-center justify-center', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground hover:bg-primary/90',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      ghost: 'hover:bg-accent hover:text-accent-foreground',
      destructive: 'bg-destructive text-destructive-foreground',
    },
    size: {
      default: 'h-10 px-4 py-2',
      sm: 'h-9 px-3',
      lg: 'h-11 px-8',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
})
```

### Variant Naming Conventions

| Pattern | Example | Use |
|---------|---------|-----|
| `{component}Variants` | `buttonVariants` | CVA variant definitions |
| `{Component}Props` | `ButtonProps` | Component prop types |
| `{noun}{adjective}` | `statusBadge`, `userAvatar` | Compound names |

---

## Import Organization

### Barrel Exports (index.ts)

Every layer should have an `index.ts`:

```typescript
// components/business/index.ts
export { KPICard } from './kpi-card'
export { StatusBadge } from './status-badge'
export { DataTable } from './data-table'
```

### Import Order

1. React/Next.js imports
2. Third-party libraries
3. Internal abstractions (`@/lib/`, `@/hooks/`, `@/types/`)
4. Layer 1: `@/components/ui/*`
5. Layer 2: `@/components/business/*`
6. Layer 3: `@/components/{domain}/*`

```tsx
import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KPICard } from '@/components/business/kpi-card'
import { useAttendance } from '@/components/attendance/hooks/use-attendance'
```

### Preferred Import Style

```typescript
// Preferred - barrel import
import { Button } from '@/components/business/status-badge'

// Acceptable - direct import
import { StatusBadge } from '@/components/business/status-badge/status-badge'
```

---

## Anti-Patterns

### Component Anti-Patterns

**❌ Creating utility components that wrap single elements**
```tsx
// BAD - unnecessary wrapper
export function BoldText({ children }) {
  return <strong>{children}</strong>
}

// GOOD - use existing primitives
<p className="font-bold">{children}</p>
```

**❌ Deeply nested providers without cleanup**
```tsx
// BAD
function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <DataProvider>
          <AnotherProvider>
            <Content />
          </AnotherProvider>
        </DataProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

// GOOD - use composition, limit depth to 3-4
function AppProviders({ children }) { ... }
```

**❌ Prop drilling beyond 2 levels**
```tsx
// BAD - passed through too many components
<Grandparent userId={id} orgId={org} onSave={handleSave}>
  <Parent userId={id} orgId={org} onSave={handleSave}>
    <Child userId={id} orgId={org} onSave={handleSave} />
  </Parent>
</Grandparent>

// GOOD - use context or hooks
const { org } = useOrgContext()
<Child />
```

### Styling Anti-Patterns

**❌ Inline styles for anything other than dynamic values**
```tsx
// BAD
<div style={{ marginTop: '1rem', padding: '16px' }} />

// GOOD
<div className="mt-4 p-4" />
```

**❌ !important without justification**
```tsx
// BAD
.special-case { color: red !important; }

// GOOD - restructure or use specific selector
.parent .child.special-case { color: red; }
```

**❌ Magic numbers**
```tsx
// BAD
<div className="mt-[23px]" />

// GOOD
<div className="mt-6" />  // uses spacing scale
```

### Import Anti-Patterns

**❌ Relative imports across layers**
```tsx
// BAD
import { Button } from '../../../ui/button'

// GOOD
import { Button } from '@/components/ui/button'
```

**❌ Importing from domain for cross-domain use**
```tsx
// BAD - task imports from attendance
import { AttendanceCalendar } from '@/components/attendance'

// GOOD - attendance feature exports shared component to Layer 2
import { AttendanceCalendar } from '@/components/business'
```

**❌ Default exports (inconsistent)**
```tsx
// BAD - mixed with named exports
export default function Button() { ... }

// GOOD - named exports only
export function Button() { ... }
```

### State Management Anti-Patterns

**❌ Storing derived data in state**
```tsx
// BAD
const [filteredItems, setFilteredItems] = useState([])
useEffect(() => {
  setFilteredItems(items.filter(...))
}, [items])

// GOOD
const filteredItems = useMemo(() => items.filter(...), [items])
```

**❌ prop drilling state that belongs in context**
```tsx
// BAD - theme passed through 5+ components
<Root theme={theme}>
  <Layout theme={theme}>
    <Sidebar theme={theme}>
      <Menu theme={theme}>
        <Item theme={theme} />
      </Menu>
    </Sidebar>
  </Layout>
</Root>

// GOOD - context
const { theme } = useTheme()
<Item />
```

---

## Migration Notes

### Migrating Hardcoded Colors to Tokens

**Before**:
```tsx
<div className="text-[#1a1a1a] bg-[#f5f5f5] border-[#e5e5e5]" />
```

**After**:
```tsx
<div className="text-foreground bg-background border-border" />
// Or with specific tokens:
<div className="text-primary-900 bg-primary-50" />
```

**Migration command**:
```bash
# Find files needing migration
grep -rn "text-\[#\|bg-\[#\|border-\[" components/ --include="*.tsx"
```

### Migrating Layer 3 → Layer 2

When a component is used by 2+ domains:

1. **Move file**:
   ```bash
   mv components/task/task-status.tsx components/business/task-status-badge.tsx
   ```

2. **Rename component** (if needed):
   ```tsx
   // Before: TaskStatusBadge
   // After: TaskStatusBadge (keep name if meaningful)
   ```

3. **Update imports** in both domains:
   ```tsx
   // Old
   import { TaskStatusBadge } from '@/components/task'
   // New
   import { TaskStatusBadge } from '@/components/business'
   ```

4. **Add barrel export**:
   ```typescript
   // components/business/index.ts
   export { TaskStatusBadge } from './task-status-badge'
   ```

5. **Remove from domain index**:
   ```typescript
   // Remove from components/task/index.ts
   ```

### Migrating to CVA Variants

**Before** (if/else pattern):
```tsx
export function Badge({ variant, children }) {
  if (variant === 'success') {
    return <span className="bg-green-100 text-green-800">{children}</span>
  }
  if (variant === 'error') {
    return <span className="bg-red-100 text-red-800">{children}</span>
  }
  return <span className="bg-gray-100 text-gray-800">{children}</span>
}
```

**After** (CVA):
```tsx
import { cva } from 'class-variance-authority'

const badgeVariants = cva('rounded-full px-2.5 py-0.5 text-xs font-semibold', {
  variants: {
    variant: {
      success: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800',
      default: 'bg-gray-100 text-gray-800',
    },
  },
})

export function Badge({ variant = 'default', children, className }) {
  return <span className={cn(badgeVariants({ variant }), className)}>{children}</span>
}
```

### Validation Commands

```bash
# Verify no hardcoded colors in components
grep -rn "#[0-9a-fA-F]\{3,6\}" components/ --include="*.tsx" | grep -v "node_modules" | grep -v ".stories.tsx" | head -20

# Verify no inline styles for layout
grep -rn "style={{" components/ --include="*.tsx" | grep -v "node_modules" | head -20

# Verify layer boundaries
grep -rn "from '@/components/attendance'" components/task --include="*.tsx"
grep -rn "from '@/components/task'" components/attendance --include="*.tsx"

# Verify all components have index exports
find components/*/index.ts -type f | wc -l  # Should match domain count
```

### Deprecation Process

When removing a component from Layer 2:

1. Add deprecation warning in JSDoc:
   ```typescript
   /**
    * @deprecated Use DataTableV2 instead. Will be removed in v3.0.
    */
   export function DataTable() { ... }
   ```

2. Add console warning at runtime:
   ```tsx
   if (process.env.NODE_ENV === 'development') {
     console.warn('DataTable is deprecated. Use DataTableV2.')
   }
   ```

3. Keep old component for 1 sprint minimum
4. Update all imports before removing

---

## AI Generation Prompts & Templates

### Component Generation Prompt Template

Use this template when generating new components:

```markdown
## Component Generation Prompt

Generate a React component for [component name] following GTG design system:

### Requirements
- **Layer**: [1/2/3 - see decision tree]
- **Location**: `components/{layer}/{ComponentName}.tsx`
- **Purpose**: [1-2 sentence description]
- **Used by**: [domains that will use this component]

### Props Interface
```typescript
interface [ComponentName]Props {
  // Required props
  [propName]: [type]
  
  // Optional props with defaults
  [propName]?: [type]
  variant?: [CVA variant type]
  size?: [size type]
  
  // Standard props
  className?: string
  id?: string
}
```

### Variant Requirements
```typescript
// Define variants using CVA
const [component]Variants = cva('[base classes]', {
  variants: {
    variant: {
      default: '[default styles]',
      [variant]: '[styles]',
    },
    size: {
      sm: '[sm styles]',
      md: '[md styles]',
      lg: '[lg styles]',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
})
```

### Dependencies
- Import from: `@/components/ui/*` (Layer 1)
- Import from: `@/components/business/*` (Layer 2)  
- Types from: `@/types/*` or domain `types.ts`
- Utilities from: `@/lib/utils` (cn function)

### Token Requirements
- Use design tokens: `text-foreground`, `bg-card`, `border-border`
- Use spacing scale: `space-1` to `space-12`
- NEVER use hardcoded colors

### Export Requirements
```typescript
// Export component
export function [ComponentName]({ ... }: [ComponentName]Props) { ... }

// Export variants type
export type { [ComponentName]Props } from './[ComponentName]'

// Export via barrel (Layer 2/3 index.ts)
export { [ComponentName] } from './[ComponentName]'
```
```

### AI Prompt: Layer Selection

```
When creating a new component, determine its layer:

LAYER 1 (UI Primitives) - `components/ui/`
→ Use shadcn/ui components directly
→ Only if it's a Radix UI primitive variant
→ Examples: Dialog, Select, Calendar, Table

LAYER 2 (App UI) - `components/business/`
→ Used by 2+ different domains
→ No domain-specific types or hooks
→ Examples: KPICard, StatusBadge, DataTable, EmptyState

LAYER 3 (Domain) - `components/{domain}/`
→ Single domain only
→ Uses domain types from types.ts
→ Uses domain hooks
→ Examples: AttendanceCalendar, TaskBoard, LeaveForm

If unsure: Start at Layer 3, promote to Layer 2 if reuse emerges.
```

### AI Prompt: Error Prevention

```
BEFORE generating any component code, verify:

1. NO hardcoded colors
   - ✅ text-foreground, bg-card, border-border
   - ❌ #ff6a00, rgb(255, 106, 0), orange-500

2. NO Layer violations
   - Layer 3 components CANNOT import from other Layer 3 domains
   - Layer 2 components CANNOT import from any Layer 3 domain

3. Proper typing
   - ✅ import type { Something } from '@/types'
   - ❌ no types defined locally

4. CVA for variants
   - ✅ cva('base-class', { variants: { variant: {...} } })
   - ❌ if/else or ternary for styling
```

---

## Component Scaffolding Templates

### Layer 2 Component Template

```typescript
'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { [BaseComponent] } from '@/components/ui/[base-component]'

// CVA Variants
const [ComponentName]Variants = cva(
  '[base classes using design tokens]',
  {
    variants: {
      variant: {
        default: '[default styles]',
        [variant1]: '[variant1 styles]',
        [variant2]: '[variant2 styles]',
      },
      size: {
        sm: '[sm styles]',
        md: '[md styles]',
        lg: '[lg styles]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)

// Props Interface
export interface [ComponentName]Props
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof [ComponentName]Variants> {
  /** Required: Description of [prop] */
  [requiredProp]: [type]
  /** Optional: Description of [prop] */
  [optionalProp]?: [type]
}

// Component
const [ComponentName] = React.forwardRef<HTMLDivElement, [ComponentName]Props>(
  ({ className, variant, size, [requiredProp], [optionalProp], ...props }, ref) => {
    return (
      <[BaseComponent]
        ref={ref}
        className={cn([ComponentName]Variants({ variant, size }), className)}
        {...props}
      >
        {/* JSX content */}
      </[BaseComponent]>
    )
  },
)
[ComponentName].displayName = '[ComponentName]'

// Exports
export { [ComponentName], type [ComponentName]Props }
```

### Layer 3 Domain Component Template

```typescript
'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { use[Domain] } from '@/hooks/use[Domain]'
import type { [Domain]Type } from './types'

interface [Domain]ComponentProps {
  id: string
  className?: string
  onAction?: (id: string) => void
}

export function [Domain]Component({
  id,
  className,
  onAction,
}: [Domain]ComponentProps) {
  const { data, isLoading, error } = use[Domain](id)

  if (isLoading) {
    return <Skeleton className={className} />
  }

  if (error || !data) {
    return <ErrorState message="Failed to load" className={className} />
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <CardTitle>{data.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Domain-specific content */}
      </CardContent>
    </Card>
  )
}
```

### Domain index.ts Template

```typescript
'use client'

// Components
export { [Component1] } from './[component-1]'
export { [Component2] } from './[component-2]'
export { [Component3] } from './[component-3]'

// Hooks
export { use[Domain] } from '@/hooks/use[Domain]'

// Types
export type { [Domain]Type, [RelatedType] } from './types'
```

---

## Testing Standards

### Test Structure

```typescript
// ComponentName.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { [ComponentName] } from './[ComponentName]'

// Mock dependencies
vi.mock('@/hooks/use[Domain]', () => ({
  use[Domain]: vi.fn(() => ({
    data: mockData,
    isLoading: false,
  })),
}))

describe('[ComponentName]', () => {
  // Unit tests
  describe('Rendering', () => {
    it('renders with default props', () => {
      render(<[ComponentName] />)
      expect(screen.getByRole('[role]')).toBeInTheDocument()
    })

    it('renders with all variants', () => {
      const variants = ['default', 'primary', 'secondary']
      variants.forEach(variant => {
        const { container } = render(<[ComponentName] variant={variant} />)
        expect(container.firstChild).toHaveClass('variant-[variant]')
      })
    })
  })

  // Interaction tests
  describe('Interactions', () => {
    it('calls onClick when clicked', async () => {
      const onClick = vi.fn()
      render(<[ComponentName] onClick={onClick} />)
      
      fireEvent.click(screen.getByRole('button'))
      expect(onClick).toHaveBeenCalledTimes(1)
    })
  })

  // Accessibility tests
  describe('Accessibility', () => {
    it('has accessible label', () => {
      render(<[ComponentName] aria-label="Test label" />)
      expect(screen.getByLabelText('Test label')).toBeInTheDocument()
    })

    it('is keyboard navigable', () => {
      render(<[ComponentName] />)
      expect(screen.getByRole('[role]')).toHaveAttribute('tabindex')
    })
  })
})
```

### Test Coverage Requirements

| Layer | Coverage Target | Focus |
|-------|-----------------|-------|
| Layer 1 (UI) | 90%+ | Interaction, accessibility |
| Layer 2 (App UI) | 80%+ | Props, variants, edge cases |
| Layer 3 (Domain) | 70%+ | Integration with hooks |

### Mock Patterns

```typescript
// Mock shadcn/ui components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children }: any) => <div>{children}</div>,
}))

// Mock hooks
vi.mock('@/hooks/useAttendance', () => ({
  useAttendance: () => ({
    data: mockAttendanceData,
    isLoading: false,
    error: null,
  }),
}))
```

---

## Accessibility Requirements

### Mandatory Checklist

Every component MUST pass these checks before merge:

```markdown
### Keyboard Navigation
- [ ] All interactive elements are focusable
- [ ] Focus order is logical (top-to-bottom, left-to-right)
- [ ] Focus is visible (ring uses `--ring` token)
- [ ] Tab navigation escapes modal/drawer correctly
- [ ] Escape key closes overlays

### Screen Reader Support
- [ ] Images have alt text (or aria-label)
- [ ] Icons have accessible labels
- [ ] Form fields have associated labels
- [ ] Error messages use aria-describedby
- [ ] Live regions announce dynamic changes

### ARIA Patterns
```typescript
// Button
<button aria-label="Submit form" disabled={isLoading}>
  {isLoading ? 'Loading...' : 'Submit'}
</button>

// Dialog
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Title</h2>
</div>

// Form field
<div>
  <label htmlFor="email">Email</label>
  <input 
    id="email" 
    type="email" 
    aria-invalid={hasError}
    aria-describedby={hasError ? 'email-error' : undefined}
  />
  {hasError && <span id="email-error">Invalid email</span>}
</div>
```

### Accessibility Testing Commands

```bash
# Install axe for automated testing
npm install @axe-core/react

# Run accessibility audit
npx @axe-core/react

# Check with eslint-plugin-jsx-a11y
npx eslint src --ext .tsx --rule 'jsx-a11y/*:error'
```

---

## API/Data Patterns

### Data Fetching Conventions

```typescript
// ✅ Use SWR or React Query
import useSWR from 'swr'
import { useQuery, useMutation } from '@tanstack/react-query'

// Fetching
function AttendanceComponent({ employeeId }: { employeeId: string }) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['attendance', employeeId],
    queryFn: () => fetchAttendance(employeeId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  if (isLoading) return <Skeleton />
  if (error) return <ErrorState message={error.message} />
  return <AttendanceData data={data} />
}

// Mutations
function LeaveRequestForm() {
  const mutation = useMutation({
    mutationFn: submitLeaveRequest,
    onSuccess: () => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['leave'] })
      toast.success('Request submitted')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
      {/* form fields */}
    </form>
  )
}
```

### Error Handling Patterns

```typescript
// Error Boundary Component
class ErrorBoundary extends React.Component {
  state = { hasError: false }
  
  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError(error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return <ErrorState message="Something went wrong" />
    }
    return this.props.children
  }
}

// Suspense Boundary
<Suspense fallback={<LoadingSkeleton />}>
  <AttendanceDashboard />
</Suspense>
```

### API Response Types

```typescript
// Standard API response
interface ApiResponse<T> {
  data: T
  meta?: {
    page: number
    total: number
    limit: number
  }
  error?: {
    code: string
    message: string
  }
}

// Fetch wrapper
async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}
```

---

## Codebase Improvement Playbook

### Phase 1: Automated Audit

Run these commands to identify violations:

```bash
#!/bin/bash
# audit.sh - Run comprehensive codebase audit

echo "=== GTG Codebase Audit ==="
echo ""

echo "1. Missing index.ts files:"
for dir in components/*/; do
  if [ ! -f "${dir}index.ts" ]; then
    echo "  ❌ $(basename $dir) - Missing index.ts"
  fi
done

echo ""
echo "2. Hardcoded colors:"
grep -rn "#[0-9a-fA-F]\{3,6\}" components --include="*.tsx" | grep -v "node_modules" | head -10

echo ""
echo "3. Cross-domain imports (violations):"
for domain in attendance task org profile; do
  for other in attendance task org profile; do
    if [ "$domain" != "$other" ]; then
      violations=$(grep -rn "from '@/components/$other'" "components/$domain" --include="*.tsx" 2>/dev/null)
      if [ -n "$violations" ]; then
        echo "  ❌ $domain → $other: $(echo "$violations" | wc -l) violations"
      fi
    fi
  done
done

echo ""
echo "4. Inline styles (potential violations):"
grep -rn "style={{" components --include="*.tsx" | grep -v "node_modules" | head -10

echo ""
echo "5. Missing 'use client' directives:"
grep -L "'use client'" components/**/*.tsx 2>/dev/null | head -10
```

### Phase 2: Gap Analysis Report

Generate this report for codebase assessment:

```markdown
## Gap Analysis Report

### Missing Index Files (Priority: HIGH)
| Domain | Status | Action |
|--------|--------|--------|
| task | Missing | Generate index.ts |
| attendance | ✅ OK | - |
| ... | ... | ... |

### Layer Violations (Priority: CRITICAL)
| File | Issue | Fix |
|------|-------|-----|
| task/some-component.tsx | Imports from attendance | Move to Layer 2 |
| ... | ... | ... |

### Token Compliance (Priority: MEDIUM)
| File | Violation | Count |
|------|-----------|-------|
| attendance/table.tsx | Hardcoded #fff | 3 |
| ... | ... | ... |

### Component Size Issues (Priority: LOW)
| File | Lines | Recommendation |
|------|-------|----------------|
| task/large-component.tsx | 800 | Split into sub-components |
```

### Phase 3: Remediation Templates

#### Generate Missing index.ts

```bash
#!/bin/bash
# generate-index.sh - Auto-generate index.ts for a domain

DOMAIN=$1
DIR="components/$DOMAIN"

# Get all .tsx files (excluding index.ts and test files)
files=$(find "$DIR" -maxdepth 1 -name "*.tsx" ! -name "index.ts" ! -name "*.test.tsx" ! -name "*.stories.tsx")

# Generate index.ts content
echo "'use client'" > "$DIR/index.ts"
echo "" >> "$DIR/index.ts"

for file in $files; do
  name=$(basename "$file" .tsx)
  # Convert to PascalCase for export
  pascal=$(echo "$name" | sed 's/-[a-z]/\U&/g' | tr -d '-')
  echo "export { $pascal } from './$name'" >> "$DIR/index.ts"
done

echo "✅ Generated $DIR/index.ts"
```

#### Fix Cross-Domain Imports

```typescript
// Before: task/components/TaskCard.tsx
import { AttendanceBadge } from '@/components/attendance'

// After: Move AttendanceBadge to Layer 2
// 1. Move to components/business/attendance-badge.tsx
// 2. Update import
import { AttendanceBadge } from '@/components/business'
```

### Phase 4: Refactoring Priority Matrix

| Priority | Component | Issue | Effort | Impact |
|----------|-----------|-------|--------|--------|
| P0-Critical | task → attendance import | Breaks architecture | 1h | Architecture |
| P1-High | Missing index.ts (task) | DX impact | 30m | DX |
| P2-Medium | Hardcoded colors in lms | Theme broken | 4h | Visual |
| P3-Low | Large components | Hard to maintain | 8h | DX |

---

## ESLint & Prettier Configuration

### Recommended .eslintrc.json additions

```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:jsx-a11y/recommended"
  ],
  "rules": {
    // Layer boundary enforcement
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          {
            "group": ["@/components/attendance", "@/components/task", "@/components/org", "@/components/profile"],
            "message": "Layer 3 imports are not allowed. Use Layer 2 or specific hook imports."
          }
        ]
      }
    ],
    
    // Prefer path aliases
    "no-restricted-patterns": [
      "error",
      {
        "name": "relative-imports",
        "message": "Use @/ path aliases instead of relative imports"
      }
    ],
    
    // Token enforcement
    "react/no-inline-styles": "warn",
    
    // Display name requirement
    "react/display-name": "error",
    
    // Prop types
    "react/prop-types": "error"
  }
}
```

### Recommended tsconfig.json

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@/components/*": ["./components/*"],
      "@/components/ui/*": ["./components/ui/*"],
      "@/components/business/*": ["./components/business/*"],
      "@/lib/*": ["./lib/*"],
      "@/hooks/*": ["./hooks/*"],
      "@/types/*": ["./types/*"]
    }
  }
}
```

### Prettier Configuration

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

### Git Pre-commit Hook

```yaml
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "Running pre-commit checks..."

# Run ESLint
npx lint-staged

# Run type check
npx tsc --noEmit

# Run tests for changed files
npx vitest run --changed

echo "✅ Pre-commit checks passed"
```

---

## Related Documentation

### Component Reference
Component API details are documented in the **source code**:
- UI Primitives: `components/ui/*.tsx`
- Business Components: `components/business/*.tsx`
- Domain Components: `components/{domain}/*.tsx`

### Other Documentation
- [Design Tokens](./design-tokens.md) - Token reference and code patterns
- [Component Structure](./component-structure.md) - Component organization
- [Component Variants](./component-variants.md) - Variant strategy (CVA)

### Source of Truth Hierarchy
```
1. This Document (strategy, patterns, rules)
2. Source Code (component implementations)
3. design-tokens.md (token reference & code patterns)
```
