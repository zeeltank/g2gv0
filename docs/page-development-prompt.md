# Page Development Prompt Template — GapstoGrowth HRMS

Use this template when asking a developer (human or AI) to build any page or screen in this project. Paste it before the feature description; the recipient must follow every rule below.

---

## Developer Prompt: Building a Page in GapstoGrowth HRMS

When building a new page or screen, follow this checklist **before writing a single line of component code**. Every item is enforced by the existing design system, component library, or app shell.

---

## 1. Page Skeleton & Routing

Follow the established page pattern exactly:

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

**Rules:**
- Every page under `app/` that displays the app shell must wrap content with `ProtectedLayout` → `GtgAppShell`.
- `GtgAppShell` provides the sidebar, header, breadcrumb, and scroll container. Do **not** re-implement shell chrome.
- Always perform role-guard checks using `useAuth()` and render `AccessDeniedPage` for unauthorized roles.
- Colocate new hooks and types with the feature folder (e.g., `components/attendance/use-attendance.ts`).

---

## 2. Token-First Design (Never Hardcode Values)

All design decisions are expressed as **CSS custom properties** mapped to Tailwind utilities. Never use raw CSS values or platform defaults.

| Token category | Correct usage | Forbidden usage |
|---|---|---|
| **Colors** | `bg-background`, `text-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`, `bg-success`, `text-danger` | `bg-white`, `text-black`, `text-gray-500`, `border-gray-200`, `bg-blue-500` |
| **Radius** | `rounded-md` (default 8px), `rounded-lg`, `rounded-2xl` | `rounded-[8px]`, `rounded-[12px]` (use tokens) |
| **Shadows** | `shadow-sm`, `shadow-md`, `shadow-lg` | `shadow-[0_4px_12px_rgba(0,0,0,0.1)]` |
| **Spacing** | `gap-4`, `p-6`, `px-4`, `mt-6` | `gap-[16px]`, `margin-top: 20px`, `padding: 24px` |
| **Typography** | `text-sm` (14px), `text-base` (16px), `text-lg` (20px), `text-xl` (24px), `text-3xl` (36px) | `text-[16px]`, arbitrary font sizes |
| **Fonts** | `font-sans`, `font-mono` | `font-family: 'Arial'`, inline font stacks |

**Rules:**
- If you override a background token, its paired `*-foreground` must also be set.
- `destructive` and `danger` are the same value — do not introduce a third negative color.
- All colors are HSL based (defined in `app/globals.css`); consume them via `hsl(var(--token))` through Tailwind utilities.
- Reference `docs/gtg-design-system.md` for the complete token list.

---

## 3. Component Library First

**Always** check `components/ui/` (and existing feature components) before building any UI primitives.

| Need | Component to use |
|---|---|
| Primary action | `Button` (variants: `default`, `secondary`, `outline`, `ghost`, `link`) |
| Text input | `Input` |
| Textarea | `Textarea` |
| Select / dropdown | `Select` |
| Checkbox | `Checkbox` |
| Radio group | `RadioGroup` / `Radio` |
| Toggle | `Switch` |
| Label | `Label` |
| File upload | `FileUpload` |
| Search field | `SearchInput` |
| Card surface | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` |
| Status indicator | `Badge`, `StatusBadge` |
| Alert / notice | `Alert` (variants: `default`, `success`, `warning`, `destructive`) |
| Modal / dialog | `Dialog`, `AlertDialog` |
| Slide-over panel | `Sheet` |
| Context menu | `DropdownMenu` |
| Collapsible section | `Accordion` |
| Tooltip | `Tooltip` |
| Icon button | `IconButton` |
| Skeleton loading | `Skeleton` |
| Spinner | `Spinner` |
| Progress bar | `Progress` |
| Empty state | `EmptyState` |
| Error state | `ErrorState` |
| Data table | `DataTable` |
| Key-value display | `DataList` |

**Rules:**
- Do **not** build custom buttons, cards, inputs, or badges from scratch.
- Compose feature components from these primitives. Keep primitives dumb; put logic/business rules in feature components inside `components/[feature]/`.
- All files under `components/ui/` are barrel-exported via `components/ui/index.ts`.

---

## 4. Styling Utilities

#### `cn()` — Conditional Class Merging
Always import `cn` from `@/lib/utils` for any conditional classes:
```tsx
import { cn } from '@/lib/utils'

<div className={cn(
  "base-classes",
  isActive && "active-classes",
  variant === "large" && "text-lg"
)} />
```

#### CVA for Component Variants
When creating new feature components with variants, use `class-variance-authority` (already used in `Button`, `Badge`, `Alert`, etc.).

---

## 5. Layout Composition Rules

Follow this hierarchy exactly:

```
GtgAppShell
  └── ContentContainer (max-width wrapper)
       └── PageHeader (title + breadcrumbs + actions)
            └── Page content
```

**Rules:**
- **Scrolling:** Only happens inside `.g2g-page-scroll` / `.g2g-scrollbar` regions. Never allow `overflow` on `body` or `html` in page components.
- **Z-index:** `dropdown: 50`, `sticky: 40`, `overlay: 50`, `toast: 100`.
- **Responsive grids:**
  - KPI / metric rows: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4`
  - Use `gap-*` for all spacing between grid/flex children. Never combine margins and `gap` on the same element.
- **Motion:** `150ms` fast, `240ms` normal, `350ms` slow; ease `cubic-bezier(0.22, 1, 0.36, 1)`. Use `animate-in` / `slide-in-from-bottom-3` for entrance animations.

---

## 6. Typography Scale

Use the exact scale from the design system:

| Role | Size | Weight | Tailwind class |
|---|---|---|---|
| Helper text | 12px | 400 | `text-xs` |
| Label / Tab / Button / Breadcrumb | 14px | 500 | `text-sm` |
| Input / field | 15px | 400 | `text-[15px]` (or use Input component) |
| Body / Description | 16px | 400 | `text-base` |
| Card title | 20px | 600 | `text-lg` |
| Section title | 24px | 600 | `text-xl` |
| Page title | 36px | 700 | `text-3xl` |

**Rules:**
- Body line-height: `leading-relaxed` (1.625) or `leading-normal` (1.5).
- No text below 14px for body content. 12px reserved for helper text only.
- One font family only: `font-sans` (Inter). No secondary typefaces.
- Use `text-balance` on titles and `text-pretty` on body paragraphs for clean line breaking.

---

## 7. Forms & Inputs

- Wrap every field with `Label` linked to its control via `htmlFor` / `id`.
- Use `FormField`, `FormSection`, `FormActions` from the design system when building forms.
- Field gap: `gap-4`. Section gap: `gap-6`.
- Buttons in forms align to the end (justify-end) or follow the `FormActions` pattern.
- Validation states: use `aria-invalid`, pair errors with descriptive text (`aria-describedby`).
- All interactive elements must show the `--ring` (orange) focus indicator.

---

## 8. Data Display Patterns

#### Tables
- Use `DataTable` for paginated, selectable, sortable tables.
- For custom tables, use the `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell` primitives.
- Cell padding: `p-3`. Row hover: `hover:bg-muted`.

#### Cards & Widgets
- Card padding: `p-6`. Radius: `rounded-lg` (12px) for large cards.
- Use `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter` composition.
- Dashboard tiles use the widget pattern: `Card` → `CardHeader` (title) → `CardContent`.

#### State Handling
- **Loading:** `Skeleton` or `Spinner` (match content footprint).
- **Empty:** `EmptyState` with heading, description, and action button.
- **Error:** `ErrorState` with retry action.
- **Loading regions:** add `aria-busy` region + `aria-label` on spinners.

---

## 9. Accessibility (Non-Negotiable)

- **Landmarks:** `main`, `nav`, `banner`, `complementary` in the right places.
- **Headings:** One `h1` per page (in `PageHeader`), structured `h2`/`h3` subsections.
- **Buttons:** Every `IconButton` requires an explicit `aria-label`.
- **Modals/Drawers:** `role="dialog"`, `aria-modal`, focus trap, `Esc` to close, labeled title, restore focus on close.
- **Tabs:** `role="tablist"` / `role="tab"` / `role="tabpanel"` with arrow-key navigation.
- **Tables:** Semantic `table`, `th` with `scope`, `aria-sort` on sortable headers.
- **Status:** Never convey status by color alone — always include text or icon.
- **Reduced motion:** Respect `@media (prefers-reduced-motion: reduce)` for animations.

---

## 10. Dark Mode

- The project uses a **class-based dark mode** (`.dark` on the root). No `ThemeProvider` or toggle exists.
- Because every color is a semantic token (`text-foreground`, `bg-background`, `border-border`), components automatically adapt.
- Design and test in both modes — do not assume light-only.

---

## 11. File Organization & Naming

```
app/[route]/page.tsx          # Route entry — thin, delegates to shell
components/
├── ui/                        # Primitives (shadcn) — do not edit unless necessary
├── [feature]/                 # Feature components (colocated)
│   ├── feature-name.tsx
│   ├── feature-name-helper.tsx
│   └── use-feature.ts         # Feature-specific hook
└── shell/                     # App chrome (sidebar, header, breadcrumb)
```

- Feature directories get their own `index.ts` barrel export.
- Page components under `app/` stay extremely thin — they handle auth and shell wiring only.
- Business logic lives in feature components or custom hooks, never in `app/` page files.

---

## 12. Code Quality Rules

- **`cn()` utility:** Use `clsx` + `tailwind-merge` via `cn()` for all conditional class logic.
- **Path aliases:** Always use `@/` for root imports (e.g., `@/components/ui/button`, `@/lib/utils`).
- **TypeScript:** Strict mode. Define interfaces/types in `types/` or colocated with the feature.
- **React:** `'use client'` on every component using hooks or event handlers.
- **No inline styles:** All styling through Tailwind utility classes built on design tokens.
- **No magic numbers:** If you need a spacing/color/radius value that is not a standard token, add it to `app/globals.css` rather than hardcoding.

---

## Quick Reference Diagram

```
app/route/page.tsx
  └── ProtectedLayout
       └── GtgAppShell
            └── ContentContainer
                 └── PageHeader (h1 + actions)
                      └── Feature Components
                           ├── Card / Badge / Button
                           ├── DataTable / DataList
                           ├── Dialog / Sheet
                           └── FormField + Input
                                └── components/ui primitives
```

---

## Pre-Commit Checklist

Before a pull request, verify:

- [ ] Page uses `ProtectedLayout` + `GtgAppShell`
- [ ] Role guard check exists (or is inherited)
- [ ] All colors use semantic tokens (`bg-primary`, `text-foreground`, NOT `bg-blue-500`)
- [ ] All spacing uses the 4px base scale (`gap-4`, `p-6`, NOT `gap-[16px]`)
- [ ] All radius uses tokens (`rounded-md`, `rounded-lg`, NOT `rounded-[12px]`)
- [ ] Primitives imported from `@/components/ui/` — no custom buttons/cards/inputs
- [ ] `cn()` used for conditional classes
- [ ] Typography follows the exact scale (14/15/16/20/24/36)
- [ ] Loading, empty, and error states implemented for data regions
- [ ] Accessibility: semantic HTML, `aria-label`, focus order, `role` where needed
- [ ] Responsive: mobile-first, grids break at `md` / `lg`
- [ ] No `overflow` or scrolling applied outside `.g2g-page-scroll`
- [ ] Dark mode visually tested

---

*End of template. Reference `docs/gtg-design-system.md` for the complete design token specification.*
