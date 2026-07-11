---
title: Component Variants Strategy
description: Standards for creating, naming, and extending component variants across shadcn/ui and app-level components
lastUpdated: 2026-07-11
tags: [variants, cva, components, design-system, frontend]
audience: [developers, ai-agents]
---

# Component Variants Strategy

This document defines standards for creating, naming, and extending component variants using `class-variance-authority` (CVA) across the GTG frontend codebase.

---

## Quick Reference

| Decision | Rule |
|-----------|------|
| **Tool** | Always use `class-variance-authority` (CVA) for variants |
| **Ownership** | `components/ui/` = base variants only; `components/business/` or domain = extended variants |
| **Naming** | `<ComponentName>Variants` for exports; `variant` and `size` for prop names |
| **Base class** | Always include in CVA base string, never rely on `cn()` fallback |
| **Override** | Pass `className` to `cn()` last; never duplicate base classes |

---

## 1. Variant Ownership Rules

### Ownership Decision Tree

```
Is the variant for shadcn/ui base components?
├── YES → Only add via shadcn upgrade path; no custom variants in components/ui/
└── NO
    ├── Used by 2+ domains without domain knowledge?
    │   ├── YES → components/business/*.tsx
    │   └── NO
    │       ├── Domain-specific? → components/{domain}/*.tsx
    │       └── Feature-specific? → Co-locate with feature
```

### Layer 1: shadcn/ui Components (`components/ui/`)

**Rule:** Base variants only. Never add business-specific variants.

**Allowed changes:**
- Accept shadcn version updates
- Accessibility fixes
- New variants if they align with shadcn conventions

**Not allowed:**
- Adding GTG-specific semantic variants (e.g., `success`, `warning`)
- Adding domain-specific variants
- Removing or renaming existing variants

**Rationale:** Preserves the shadcn upgrade path. Business variants live at Layer 2+.

### Layer 2: App UI Components (`components/business/`)

**Rule:** Cross-domain components with app-specific variants.

**Examples in codebase:**
- `StatusBadge` — used by Tasks, Leave, Recruitment
- `KPICard` — used by Dashboard, Attendance, Tasks
- `DataTable` — used across multiple domains

### Layer 3: Domain Components (`components/{domain}/`)

**Rule:** Domain-specific variants for domain-specific components.

---

## 2. Naming Conventions

### Variant Factory Naming

```typescript
// ✅ CORRECT: Export pattern
const buttonVariants = cva(...)
export { Button, buttonVariants }

const statusBadgeVariants = cva(...)
export { StatusBadge, statusBadgeVariants }

// ✅ CORRECT: Type export
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & 
  VariantProps<typeof buttonVariants>
```

### Prop Naming

| Prop | Type | Values | Notes |
|------|------|--------|-------|
| `variant` | `string` | Semantic or visual | Use semantic names when possible |
| `size` | `string` | `xs`, `sm`, `default`, `lg`, `xl` | Match shadcn pattern |
| `layout` | `string` | `horizontal`, `vertical` | For components with orientation |
| `status` | `string` | Domain-specific | Only for domain components |

### Variant Value Naming

**Semantic names (preferred):**
```typescript
variants: {
  variant: {
    default: '...',
    primary: '...',    // Primary action
    secondary: '...',  // Secondary action
    destructive: '...', // Danger/deletion
    ghost: '...',       // Minimal styling
    outline: '...',     // Bordered
  }
}
```

**Status-specific (for StatusBadge, Alert):**
```typescript
variants: {
  variant: {
    default: '...',
    success: '...',
    warning: '...',
    error: '...',        // OR destructive
    info: '...',         // OR processing
    inactive: '...',
  }
}
```

**Color-specific (when colors have meaning):**
```typescript
variants: {
  variant: {
    default: '...',
    active: 'bg-success/10 text-success',
    pending: 'bg-warning/10 text-warning',
    error: 'bg-destructive/10 text-destructive',
    processing: 'bg-primary/10 text-primary',
  }
}
```

### Anti-Pattern: Inconsistent Naming

```typescript
// ❌ WRONG: Mixed naming styles
variants: {
  type: {
    basic: '...',       // "type" instead of "variant"
    premium: '...',     // Inconsistent
  },
  colorScheme: {
    red: '...',         // "colorScheme" instead of "variant"
  }
}

// ✅ CORRECT: Consistent naming
variants: {
  variant: {
    basic: '...',
    premium: '...',
  }
}
```

---

## 3. Size Conventions

### Standard Size Scale

| Size | Use Case | Button Heights | Icon Sizes |
|------|----------|----------------|------------|
| `xs` | Tight spaces, table cells | h-6 | size-4 |
| `sm` | Compact UI, dropdowns | h-7 | size-4 |
| `default` | Standard UI | h-8 | size-4 |
| `lg` | Prominent actions | h-9 | size-5 |
| `xl` | Hero sections | h-10 | size-6 |

### Icon Button Sizes

Icon buttons follow the same scale but use `icon-` prefix for icon-only sizes:

```typescript
size: {
  'icon-xs': 'size-6',
  'icon-sm': 'size-7',
  'icon': 'size-8',      // default
  'icon-lg': 'size-9',
  'icon-xl': 'size-10',
}
```

### Cursor Override

When size implies specific cursor behavior:

```typescript
size: {
  default: 'h-8 px-3 text-sm cursor-pointer',
  lg: 'h-9 px-4 text-base cursor-wait',
  'icon-sm': 'h-7 w-7 cursor-grab',
}
```

---

## 4. className Override Rules

### The Override Pattern

```typescript
// ✅ CORRECT: className passed to cn() for override
const Component = ({ className, ...props }) => (
  <div className={cn(baseVariants({ ... }), className)} {...props} />
)

// ✅ CORRECT: Conditional override
const Component = ({ className, ...props }) => (
  <div 
    className={cn(
      baseVariants({ variant, size }),
      className,
      isCompact && 'gap-1'
    )} 
    {...props} 
  />
)
```

### Common Mistakes

```typescript
// ❌ WRONG: Hardcoding className in base variant
const badgeVariants = cva('rounded-md px-2.5 py-0.5 text-xs font-semibold', {
  variants: {
    variant: {
      default: 'bg-gray-100 text-gray-800',
    }
  }
})

// ✅ CORRECT: className override for border radius
<Badge variant="default" className="rounded-full">
  Custom border radius
</Badge>
```

### Preserving Accessibility

When allowing className override:

```typescript
// ❌ WRONG: className override breaks accessibility
const Input = ({ className, ...props }) => (
  <input 
    className={cn('border', className)} 
    aria-invalid={hasError ? 'true' : undefined}
    {...props} 
  />
)
// If user passes className="", aria-invalid is lost

// ✅ CORRECT: Always ensure accessibility attributes
const Input = ({ className, hasError, ...props }) => (
  <input 
    className={cn('border', hasError && 'border-error', className)} 
    aria-invalid={hasError ? 'true' : 'false'}
    {...props} 
  />
)
```

---

## 5. Examples from Codebase

### Example 1: StatusBadge with Status Mapping

```typescript
// components/ui/status-badge.tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const statusBadgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/10 text-primary',
        success: 'border-transparent bg-success/10 text-success',
        warning: 'border-transparent bg-warning/10 text-warning',
        error: 'border-transparent bg-destructive/10 text-destructive',
        processing: 'border-transparent bg-blue-100 text-blue-600',
        inactive: 'border-transparent bg-muted text-muted-foreground',
      },
      size: {
        default: '',
        sm: 'text-[10px] px-2 py-0',
        lg: 'text-sm px-3 py-1',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

// Status-to-variant mapping
const statusVariantMap: Record<string, string> = {
  Active: 'success',
  'On Leave': 'warning',
  Inactive: 'inactive',
  Pending: 'processing',
  Rejected: 'error',
}

interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  status?: string
  label?: string
  icon?: React.ReactNode
}

const StatusBadge = forwardRef<HTMLDivElement, StatusBadgeProps>(
  ({ variant, size, status, label, icon, className, children, ...props }, ref) => {
    const activeVariant = status && statusVariantMap[status] 
      ? (statusVariantMap[status] as VariantProps<typeof statusBadgeVariants>['variant'])
      : variant

    return (
      <div
        ref={ref}
        className={cn(statusBadgeVariants({ variant: activeVariant, size }), className)}
        {...props}
      >
        {icon && <span>{icon}</span>}
        {children || label || (status ? status.replace('-', ' ') : null)}
      </div>
    )
  }
)

export { statusBadgeVariants }
```

### Example 2: App-Level Component with Variants

```typescript
// components/business/kpi-card.tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const kpiCardVariants = cva(
  'relative overflow-hidden',
  {
    variants: {
      variant: {
        default: 'bg-card',
        primary: 'bg-primary/5',
        success: 'bg-success/5',
        warning: 'bg-warning/5',
        danger: 'bg-danger/5',  // Note: uses danger, not destructive
      },
      size: {
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

interface KPICardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof kpiCardVariants> {
  label: string
  value: string | number
  unit?: string
  trend?: { value: number; direction: 'up' | 'down'; label?: string }
  icon?: React.ReactNode
}

const KPICard = forwardRef<HTMLDivElement, KPICardProps>(
  ({ label, value, variant, size, className, ...props }, ref) => (
    <Card 
      ref={ref} 
      className={cn(kpiCardVariants({ variant, size }), className)} 
      {...props}
    >
      <CardContent className="space-y-2">
        {/* content */}
      </CardContent>
    </Card>
  )
)

export { KPICard, kpiCardVariants }
```

### Example 3: Domain-Level Status Mapping

```typescript
// In domain component (e.g., recruitment-center.tsx)
type CandidateStage = 'Applied' | 'Screened' | 'Assessment' | 'Interview' | 'Offer' | 'Hired' | 'Rejected'

// Helper function at domain level
function getStageVariant(stage: CandidateStage): 'default' | 'active' | 'inactive' | 'pending' | 'error' | 'processing' {
  const map: Record<CandidateStage, ...> = {
    Applied: 'default',
    Screened: 'processing',
    Assessment: 'pending',
    Interview: 'processing',
    Offer: 'active',
    Hired: 'active',
    Rejected: 'error',
  }
  return map[stage]
}

// Usage
<StatusBadge variant={getStageVariant(candidate.stage)}>
  {candidate.stage}
</StatusBadge>
```

---

## 6. Anti-Patterns

### Anti-Pattern 1: Modifying Base Components for Business Logic

```typescript
// ❌ WRONG: Editing components/ui/badge.tsx
const badgeVariants = cva('...', {
  variants: {
    variant: {
      // Adding recruitment-specific variant
      interview: 'bg-purple-100 text-purple-800',
      onboarding: 'bg-blue-100 text-blue-800',
    }
  }
})

// ✅ CORRECT: Create StatusBadge or domain wrapper
// components/ui/status-badge.tsx or
// components/talent/recruitment/stage-badge.tsx
```

### Anti-Pattern 2: Non-CVA Conditional Classes

```typescript
// ❌ WRONG: Hardcoded conditional classes
<button
  className={cn(
    'inline-flex items-center justify-center gap-2',
    type === 'primary' && 'bg-primary text-primary-foreground',
    type === 'secondary' && 'bg-secondary text-secondary-foreground',
    className
  )}
/>

// ✅ CORRECT: Use CVA
const buttonVariants = cva('...', {
  variants: {
    variant: {
      primary: 'bg-primary text-primary-foreground',
      secondary: 'bg-secondary text-secondary-foreground',
    }
  }
})
```

### Anti-Pattern 3: Size as Enum Without CVA

```typescript
// ❌ WRONG: Size mapping without CVA
const sizeClass = {
  sm: 'h-7 px-2.5 text-xs',
  default: 'h-8 px-3 text-sm',
  lg: 'h-9 px-3.5 text-base',
}[size]

// ✅ CORRECT: Use CVA
const inputVariants = cva('...', {
  variants: {
    size: {
      sm: 'h-7 px-2.5 text-xs',
      default: 'h-8 px-3 text-sm',
      lg: 'h-9 px-3.5 text-base',
    }
  }
})
```

### Anti-Pattern 4: Variant Explosion

```typescript
// ❌ WRONG: Too many variant dimensions
const cardVariants = cva('...', {
  variants: {
    variant: { /* 10 variants */ },
    size: { /* 5 sizes */ },
    color: { /* 8 colors */ },
    layout: { /* 4 layouts */ },
    rounded: { /* 3 options */ },
  }
})
// Results in 10 × 5 × 8 × 4 × 3 = 4,800 possible combinations

// ✅ CORRECT: Limit variant dimensions to 2 max
// Use className override for edge cases
const cardVariants = cva('...', {
  variants: {
    variant: { default: '...', bordered: '...' },
    size: { sm: '...', default: '...', lg: '...' },
  }
})
```

### Anti-Pattern 5: Binding Variants to Data

```typescript
// ❌ WRONG: Variant value derived from data shape
<Badge variant={candidate.isActive ? 'success' : 'muted'}>
  {candidate.isActive ? 'Active' : 'Inactive'}
</Badge>

// ✅ CORRECT: Use status prop if available, or helper function
<StatusBadge status={candidate.status}>
  {candidate.status}
</StatusBadge>

// OR
<Badge variant={candidate.status === 'active' ? 'success' : 'muted'}>
  {candidate.status}
</Badge>
```

### Anti-Pattern 6: Missing Default Variants

```typescript
// ❌ WRONG: No default variant
const badgeVariants = cva('...', {
  variants: {
    variant: {
      primary: '...',
      secondary: '...',
    },
    // Missing: defaultVariants
  }
})

// ✅ CORRECT: Always define defaults
const badgeVariants = cva('...', {
  variants: {
    variant: {
      default: '...',
      primary: '...',
      secondary: '...',
    },
  },
  defaultVariants: {
    variant: 'default',
  }
})
```

---

## 7. Migration Guidance

### Migrating from Hardcoded Conditionals to CVA

**Before:**
```typescript
function Button({ variant = 'default', size = 'md', className, children }) {
  const variantClass = {
    default: 'bg-primary text-primary-foreground',
    outline: 'border border-input bg-background',
    ghost: 'hover:bg-accent',
  }[variant]

  const sizeClass = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-base',
    lg: 'h-12 px-6 text-lg',
  }[size]

  return <button className={cn(variantClass, sizeClass, className)}>{children}</button>
}
```

**After:**
```typescript
const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent',
      },
      size: {
        sm: 'h-8 px-3 text-sm rounded-md',
        md: 'h-10 px-4 text-base rounded-lg',
        lg: 'h-12 px-6 text-lg rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

function Button({ variant, size, className, children }) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)}>
      {children}
    </button>
  )
}
```

### Migrating to New Component Layer

When a component outgrows its current layer:

1. **Identify the right layer** (see Section 1)
2. **Create new component** in target layer
3. **Add variant mapping** for existing usages
4. **Update imports** gradually
5. **Remove old component** if it's a direct replacement

### Variant Naming Refactor

When renaming variant values for consistency:

1. Add new variant name with same styles
2. Keep old variant name as alias (deprecation warning)
3. Update usages in a separate PR
4. Remove alias in next release

---

## Related Documentation

- [Design System Strategy](./design-system-strategy.md) — Layer model and architecture
- [Design Tokens](./design-tokens.md) — CSS custom properties
- Source: `components/ui/*.tsx` — Component implementations

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-11 | Initial document |
