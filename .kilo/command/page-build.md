# Page Build — Kilo Command

This command enforces the GTG design system when building any page or screen.

## Usage

```
/page-build <feature description>
```

Example:
```
/page-build build the leave management page where employees can apply for leave and managers can approve/reject
```

---

## Instructions

When this command is invoked, build the requested page following every rule below. Do not deviate.

### 1. Page Skeleton

Every page follows this exact pattern:

```tsx
'use client'

import { useAuth } from '@/lib/gtg-auth'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { AccessDeniedPage } from '@/components/auth/access-denied-page'
import { GtgAppShell } from '@/components/shell/gtg-app-shell'
import { FeatureComponent } from '@/components/[feature]/feature-component'

export default function PageName() {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  if (!user || !allowedRoles.includes(user.role)) {
    return <AccessDeniedPage reason="Access required to view this page." />
  }
  return (
    <ProtectedLayout>
      <GtgAppShell>
        <FeatureComponent />
      </GtgAppShell>
    </ProtectedLayout>
  )
}
```

Rules:
- Wrap with `ProtectedLayout` → `GtgAppShell`. Do not re-implement shell chrome.
- Perform role-guard via `useAuth()`. Render `AccessDeniedPage` for unauthorized roles.
- Page files under `app/` stay thin. Business logic lives in `components/[feature]/`.

### 2. Token-First Design (No Hardcoding)

All design is expressed as CSS custom properties mapped to Tailwind utilities. Never use raw values.

| Correct | Forbidden |
|---|---|
| `bg-background`, `text-foreground`, `border-border` | `bg-white`, `text-gray-500`, `border-gray-200` |
| `rounded-md`, `rounded-lg` | `rounded-[8px]`, `rounded-[12px]` |
| `shadow-sm`, `shadow-md`, `shadow-lg` | `shadow-[0_4px_12px_rgba(...)]` |
| `gap-4`, `p-6`, `mt-6` | `gap-[16px]`, `padding: 24px` |
| `text-sm` (14px), `text-base` (16px), `text-lg` (20px), `text-xl` (24px), `text-3xl` (36px) | `text-[16px]`, arbitrary font sizes |
| `font-sans`, `font-mono` | Inline font-family declarations |

Rules:
- `destructive` == `danger`. No third negative color.
- Override a background token → also set its `*-foreground`.
- All colors are HSL in `app/globals.css`; consume via `hsl(var(--token))` through Tailwind.
- See `docs/gtg-design-system.md` for the full token reference.

### 3. Component Library First

Check `components/ui/` before building any UI primitive. Do not build custom buttons, cards, or inputs.

| Need | Use |
|---|---|
| Action | `Button` (`default`, `secondary`, `outline`, `ghost`, `link`) |
| Input | `Input` |
| Multiline | `Textarea` |
| Choice | `Select` |
| Toggle | `Switch` |
| Checkbox | `Checkbox` |
| Radio | `RadioGroup` / `Radio` |
| Label | `Label` |
| Upload | `FileUpload` |
| Search | `SearchInput` |
| Surface | `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter` |
| Status | `Badge`, `StatusBadge` |
| Notice | `Alert` (`default`, `success`, `warning`, `destructive`) |
| Modal | `Dialog`, `AlertDialog` |
| Panel | `Sheet` |
| Menu | `DropdownMenu` |
| Collapse | `Accordion` |
| Hint | `Tooltip` |
| Icon action | `IconButton` (always `aria-label`) |
| Loading | `Skeleton`, `Spinner` |
| Progress | `Progress` |
| Empty | `EmptyState` |
| Error | `ErrorState` |
| Table | `DataTable`, `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell` |
| KV display | `DataList` |

- Compose feature components from primitives. Keep primitives dumb; logic lives in feature components.
- All primitives are barrel-exported from `components/ui/index.ts`.

### 4. Styling Utilities

- **`cn()`**: Import from `@/lib/utils` for all conditional class merging.
- **CVA**: Use `class-variance-authority` for any new component variants.

### 5. Layout Composition

Use this hierarchy:

```
GtgAppShell
  └── ContentContainer
       └── PageHeader (title + breadcrumbs + actions)
            └── Page content
```

Rules:
- Scrolling only inside `.g2g-page-scroll` / `.g2g-scrollbar`. No `overflow` on `body` or `html`.
- Z-index: `dropdown: 50`, `sticky: 40`, `overlay: 50`, `toast: 100`.
- Grids: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4`. Use `gap-*` only; never mix margins + gap.
- Motion: `150ms` fast, `240ms` normal, `350ms` slow; ease `cubic-bezier(0.22, 1, 0.36, 1)`.

### 6. Typography

| Role | Size | Weight | Class |
|---|---|---|---|
| Helper | 12px | 400 | `text-xs` |
| Label/Tab/Button | 14px | 500 | `text-sm` |
| Input/field | 15px | 400 | `text-[15px]` |
| Body/Description | 16px | 400 | `text-base` |
| Card title | 20px | 600 | `text-lg` |
| Section title | 24px | 600 | `text-xl` |
| Page title | 36px | 700 | `text-3xl` |

Rules:
- `leading-relaxed` or `leading-normal` for body.
- No text below 14px in body content.
- `font-sans` only (Inter). Use `text-balance` on titles, `text-pretty` on body.

### 7. Forms

- Every field has a `Label` with `htmlFor` / `id`.
- Field gap: `gap-4`. Section gap: `gap-6`.
- Form actions: `justify-end` or `FormActions` pattern.
- Validation: `aria-invalid` + `aria-describedby` for errors.
- All interactive elements: visible `--ring` (orange) focus indicator.

### 8. Data & State

#### Tables
- `DataTable` for paginated/selectable/sortable data.
- Custom tables: `Table` primitives, cell `p-3`, row `hover:bg-muted`.

#### Cards
- Card padding `p-6`, radius `rounded-lg`.
- Compose: `Card` → `CardHeader` → `CardContent`.

#### Loading / Empty / Error
- **Loading:** `Skeleton` or `Spinner` (match footprint), add `aria-busy` + `aria-label`.
- **Empty:** `EmptyState` with heading, description, action.
- **Error:** `ErrorState` with retry action.

### 9. Accessibility (Non-Negotiable)

- Landmarks: `main`, `nav`, `banner`.
- One `h1` per page (in `PageHeader`).
- `IconButton` always has `aria-label`.
- Dialogs/Drawers: `role="dialog"`, `aria-modal`, focus trap, `Esc` close, restore focus.
- Tabs: `role="tablist"` / `tab` / `tabpanel`, arrow-key nav.
- Tables: semantic `table`, `th scope`, `aria-sort`.
- Status: text + icon, never color alone.
- Animations: respect `prefers-reduced-motion`.

### 10. Dark Mode

- Class-based (`.dark` on root). No toggle exists.
- Semantic tokens auto-adapt. Design and test in both modes.

### 11. File Organization

```
app/[route]/page.tsx           # Route entry — thin, delegates to shell
components/
├── ui/                         # Primitives (shadcn) — do not edit
├── [feature]/                  # Feature components (colocated)
│   ├── feature.tsx
│   ├── feature-helper.tsx
│   └── use-feature.ts
└── shell/                      # App chrome
```

- Feature dirs get `index.ts` barrel export.
- `app/` page files: auth + shell only.
- Logic in feature components or custom hooks.

### 12. Code Quality

- `cn()` from `@/lib/utils` for conditional classes.
- `@/` path aliases everywhere.
- Strict TypeScript. Types in `types/` or colocated.
- `'use client'` on every component using hooks.
- No inline styles. No magic numbers — add tokens to `app/globals.css`.

---

## Pre-Commit Verification

Before completing, verify ALL of the following:

- [ ] `ProtectedLayout` + `GtgAppShell` used
- [ ] Role guard check present
- [ ] All colors are semantic tokens (no `bg-white`, `text-gray-*`)
- [ ] All spacing uses the 4px scale (`gap-4`, `p-6`, not `gap-[16px]`)
- [ ] All radius uses tokens (`rounded-md`, not `rounded-[8px]`)
- [ ] Primitives from `@/components/ui/` — no custom buttons/cards/inputs
- [ ] `cn()` for conditional classes
- [ ] Typography: 14/15/16/20/24/36px scale
- [ ] Loading, empty, error states for data regions
- [ ] Accessibility: semantic HTML, `aria-label`, focus order
- [ ] Responsive: mobile-first, `md`/`lg` breakpoints
- [ ] No `overflow` outside `.g2g-page-scroll`
- [ ] Dark mode tested

---

*Reference: `docs/gtg-design-system.md` for complete design tokens.*
