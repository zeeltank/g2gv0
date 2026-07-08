# Frontend Design System Strategy - Action Plan

## 1. OBJECTIVE

Create `docs/frontend/design-system-strategy.md` that establishes clear rules for the GTG frontend design system.

**Scope**: Documentation only. No implementation changes to source files.

**Output**: `docs/frontend/design-system-strategy.md`

---

## 2. CONTEXT SUMMARY

### Current Architecture
| Layer | Location | Purpose |
|-------|----------|---------|
| Tokens | `app/globals.css` | CSS custom properties for colors, spacing, shadows |
| UI Primitives | `components/ui/` | ~35 shadcn/ui base components |
| App UI | `components/{shell,business,workflow,data}/` | GTG-specific compositions |
| Domain | `components/{attendance,task,talent,org,...}/` | Feature-specific components |

### Technology Stack
- shadcn/ui (base-nova style variant)
- Tailwind CSS v4 with CSS custom properties
- Radix UI primitives
- class-variance-authority (CVA) for variant management
- `cn()` utility for className merging

### Existing Documentation (to reference, not duplicate)
- `gtg-design-system.md` - Comprehensive design system
- `STYLING_GUIDE.md` - Token standards
- `COMPONENT_LIBRARY.md` - UI primitive docs
- `REUSABLE_COMPONENTS.md` - Business component docs

---

## 3. ACTION PLAN

### ACTION 1: Create Documentation Directory and File

**Command**:
```bash
mkdir -p docs/frontend
touch docs/frontend/design-system-strategy.md
```

---

### ACTION 2: Write Design System Goals Section

**File**: `docs/frontend/design-system-strategy.md`

**Content**:
```markdown
## Design System Goals

1. **shadcn/ui First**: Keep base components pristine, never modify source
2. **Extension Over Forking**: Build custom variants on top, not replacements
3. **Layered Architecture**: Clear boundaries between tokens → primitives → app UI → domain
4. **Minimal Abstractions**: No new component libraries unless truly reusable across domains
5. **Token-Driven Theming**: All visual decisions via CSS custom properties
```

---

### ACTION 3: Write Layer Model Section

**Content**:
```markdown
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
```

---

### ACTION 4: Write shadcn/ui Base Layer Rules

**Content**:
```markdown
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
```

---

### ACTION 5: Write App UI Layer Rules

**Content**:
```markdown
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
```

---

### ACTION 6: Write Domain Layer Rules

**Content**:
```markdown
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
✗ @/components/attendance from @/components/task  (cross-domain)
✗ @/lib/* (business logic) from components/
✗ Mock data in components/* (use lib/mock-data instead)
```

### Naming Conventions
- Domain name as prefix: `AttendanceCalendar`, `TaskBoard`, `TalentProfile`
- File names match component: `attendance-calendar.tsx` → `AttendanceCalendar`
- Index files for clean exports: `components/attendance/components/index.ts`
```

---

### ACTION 7: Write Token Strategy

**Content**:
```markdown
## Token Strategy

### Existing Tokens (Reference)
Located in `app/globals.css`:

```css
:root {
  /* Primary Colors */
  --color-primary-50: #...;
  --color-primary-100: #...;
  /* ... through 900 */

  /* Semantic Colors */
  --color-success: #...;
  --color-warning: #...;
  --color-danger: #...;
  --color-info: #...;

  /* Spacing Scale */
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  /* ... through 16 */

  /* Border Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
}
```

### Token Usage Rules

**✅ DO:**
```tsx
// Use tokens via Tailwind
<div className="bg-primary-500 text-white" />
<div className="p-4" />  // spacing-4 maps to --spacing-4

// Use semantic tokens for meaning
<div className="bg-success text-white" />
<div className="bg-danger text-white" />
```

**❌ DON'T:**
```tsx
// Never hardcode colors
<div className="bg-[#3b82f6]" />           // BAD
<div className="bg-blue-500" />            // ONLY if mapping to token

// Never inline styles
<div style={{ color: '#fff' }} />           // BAD
```

### Adding New Tokens

1. Add to `app/globals.css` in appropriate section
2. Follow naming convention: `--{category}-{name}-{weight}`
3. Update `STYLING_GUIDE.md` with new token
4. For brand colors, coordinate with design team

### Migration Command
```bash
# Find hardcoded colors to migrate
grep -rn "#[0-9a-fA-F]\{6\}" components/ --include="*.tsx" | grep -v "node_modules"
```
```

---

### ACTION 8: Write Theme Strategy

**Content**:
```markdown
## Theme Strategy

### Current State
- Light mode only (no dark mode implementation)
- Single theme via CSS custom properties
- Theme defined in `app/globals.css`

### Future Dark Mode (When Implemented)
```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-primary-50: #...;  /* Dark mode values */
    /* ... */
  }
}
```

### Theme Toggle Pattern (Future)
```tsx
// hooks/use-theme.ts
export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  // Implementation
  return { theme, setTheme, toggleTheme }
}
```

### Theming Rules
- All colors via CSS custom properties (tokens)
- No inline styles for colors
- Components must accept `className` prop for customization
- Use `cn()` utility to merge classes without conflicts
```

---

### ACTION 9: Write Variant Strategy

**Content**:
```markdown
## Variant Strategy

### CVA Usage Pattern
All variants use class-variance-authority (CVA):

```typescript
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium',
  {
    variants: {
      variant: {
        default: 'bg-primary-600 text-white hover:bg-primary-700',
        destructive: 'bg-danger text-white hover:bg-danger/90',
        outline: 'border border-input bg-white hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'underline-offset-4 hover:underline text-primary',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
```

### Variant Naming Conventions

| Pattern | Use |
|---------|-----|
| `variant: 'default' \| 'outline' \| 'ghost'` | Visual style differences |
| `size: 'sm' \| 'md' \| 'lg'` | Size variations |
| `status: 'pending' \| 'approved' \| 'rejected'` | State indicators |
| `intent: 'success' \| 'warning' \| 'error'` | Action feedback |

### Extending Variants
Never modify shadcn variants. Instead, create wrapper:

```typescript
// components/business/my-button.tsx
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const gtgButtonVariants = cva(buttonVariants(), {
  variants: {
    intent: {
      primary: 'bg-primary-600 hover:bg-primary-700',
      secondary: 'bg-secondary-600 hover:bg-secondary-700',
    },
  },
})

export function GtgButton({ intent, className, ...props }) {
  return <Button className={cn(gtgButtonVariants({ intent }), className)} {...props} />
}
```
```

---

### ACTION 10: Write Naming Conventions

**Content**:
```markdown
## Naming Conventions

### File Names
| Type | Convention | Example |
|------|------------|---------|
| Component | kebab-case | `status-badge.tsx` |
| Hook | use-{name}.ts | `use-attendance.ts` |
| Type | kebab-case | `attendance-types.ts` |
| Utility | kebab-case | `date-utils.ts` |
| Constant | SCREAMING_SNAKE | `ATTENDANCE_STATUS.ts` |
| Test | Same as target | `status-badge.test.tsx` |
| Story | Same as target | `status-badge.stories.tsx` |

### Component Names
- PascalCase: `StatusBadge`, `KPICard`, `AttendanceCalendar`
- Prefix with domain for domain components: `AttendanceCalendar` (not `Calendar`)
- No suffix for base: `Button`, `Dialog` (shadcn)
- Business prefix for custom: `GtgButton`, `BusinessCard`

### Import Aliases
Configured in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

**Standard imports**:
```typescript
// ✅ Correct
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/business'
import { useAttendance } from '@/hooks'

// ❌ Incorrect
import { Button } from '../../ui/button'
import { StatusBadge } from '@/components/business/status-badge'  // prefer barrel
```

### Barrel Exports (index.ts)
Every layer should have an `index.ts`:

```typescript
// components/business/index.ts
export { KPICard } from './kpi-card'
export { StatusBadge } from './status-badge'
export { DataTable } from './data-table'
```

### CSS Class Naming
Use Tailwind utility classes. For custom classes:
- Use semantic names: `className="card-header"`, not `ch`
- Follow BEM for layout: `card__header--featured`
```

---

### ACTION 11: Write Anti-Patterns

**Content**:
```markdown
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
```

---

### ACTION 12: Write Migration Notes

**Content**:
```markdown
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
```

---

### ACTION 13: Finalize Document with Frontmatter

**Add to top of file**:
```markdown
---
title: GTG Frontend Design System Strategy
description: Design system rules and conventions for GTG frontend
lastUpdated: 2026-07-08
---

# GTG Frontend Design System Strategy
```

---

## 4. VALIDATION CHECKLIST

After execution, verify:

| Check | Command/Action |
|-------|-----------------|
| File created | `ls -la docs/frontend/design-system-strategy.md` |
| Sections present | Grep for all required section headers |
| Links work | Check cross-references to existing docs |
| No implementation | Confirm only docs/ directory changed |
| Valid markdown | `npx markdownlint docs/frontend/design-system-strategy.md` |

---

## 5. EXECUTION SUMMARY

| Action | Effort | Blocking |
|--------|--------|----------|
| 1. Create directory | Low | No |
| 2-12. Write sections | Medium | Sequential |
| 13. Add frontmatter | Low | After 2-12 |

**Total**: ~2 hours for documentation creation
**Risk**: None (documentation only)
**Rollback**: `git checkout docs/frontend/` if needed

---

*Plan created: 2026-07-08*
*Ready for execution*
