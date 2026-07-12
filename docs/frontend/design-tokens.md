# GTG Design Tokens — Complete Reference

> **Purpose:** This document is the authoritative source for GTG frontend design tokens, optimized for both human developers and AI agents.
> **Preservation:** This document preserves existing GTG design language. No redesign, no new colors, no new typography.

---

## Table of Contents

- [Section A: Token Reference (Human-focused)](#section-a-token-reference-human-focused)
- [Section B: Code Patterns (AI-focused)](#section-b-code-patterns-ai-focused)
- [Section C: Decision Trees (AI-focused)](#section-c-decision-trees-ai-focused)
- [Section D: Naming Conventions](#section-d-naming-conventions)
- [Section E: File Location Guide](#section-e-file-location-guide)
- [Section F: Validation Checklist](#section-f-validation-checklist)
- [Section G: shadcn/ui Compatibility](#section-g-shadcnui-compatibility)
- [Section H: Anti-Patterns & Fixes](#section-h-anti-patterns--fixes)
- [Section I: Quick Reference](#section-i-quick-reference)

---

# Section A: Token Reference (Human-focused)

## A.1 Token Architecture Overview

The GTG design system uses a three-layer model:

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 2: Semantic Tokens (CSS variables)                          │
│ Examples: --primary, --background, --sidebar-hover               │
│ → Defined in app/globals.css                                     │
│ → Use for: Brand colors, status colors, interactive states       │
├─────────────────────────────────────────────────────────────────┤
│ Layer 1: Tailwind Utilities                                      │
│ Examples: p-4, shadow-sm, text-lg                                │
│ → Use for: Spacing, shadows, primitive colors (blue-500)         │
├─────────────────────────────────────────────────────────────────┤
│ Layer 0: shadcn Base (read-only)                                 │
│ → Never modify                                                   │
│ → Consumed via Tailwind classes: bg-primary, text-foreground     │
└─────────────────────────────────────────────────────────────────┘
```

## A.2 Token Locations

| Token Type | Location | When to Use |
|------------|----------|-------------|
| Semantic color tokens | `app/globals.css` | Brand colors, status indicators, interactive states |
| Radius tokens | `app/globals.css` @theme inline | Border radius values |
| Typography tokens | `app/globals.css` @theme inline | Font families |
| Spacing | Tailwind utilities | All spacing (padding, margin, gaps) |
| Shadows | Tailwind utilities | All shadow values |
| shadcn base tokens | `shadcn/tailwind.css` | Component variants (read-only) |

## A.3 Complete Color Token Reference

All colors use HSL channel triplets. Values are defined as `hsl(H S% L%)`.

### Core Surfaces & Text

| Token | Light Mode Value | Dark Mode Value | Purpose |
|-------|------------------|-----------------|---------|
| `--background` | `210 40% 98%` | `222 47% 4%` | App canvas background |
| `--foreground` | `222 47% 11%` | `210 40% 98%` | Primary text color |
| `--card` | `0 0% 100%` | `224 32% 14%` | Card surfaces |
| `--card-foreground` | `222 47% 11%` | `210 40% 98%` | Card text |
| `--popover` | `0 0% 100%` | `224 32% 14%` | Overlay/popover backgrounds |
| `--popover-foreground` | `222 47% 11%` | `210 40% 98%` | Overlay text |
| `--surface` | `0 0% 100%` | `224 32% 14%` | General surface/panel |
| `--surface-muted` | `210 20% 96%` | `217 33% 10%` | Muted/subtle surfaces |

### Action & Interactive

| Token | Light Mode Value | Dark Mode Value | Purpose |
|-------|------------------|-----------------|---------|
| `--primary` | `221 83% 53%` | `221 83% 62%` | Primary action buttons |
| `--primary-foreground` | `0 0% 100%` | `0 0% 100%` | Text on primary |
| `--secondary` | `210 20% 96%` | `217 33% 10%` | Secondary actions |
| `--secondary-foreground` | `222 47% 11%` | `210 40% 98%` | Text on secondary |
| `--accent` | `210 20% 96%` | `217 33% 10%` | Accent/highlight |
| `--accent-foreground` | `222 47% 11%` | `210 40% 98%` | Text on accent |
| `--muted` | `210 20% 96%` | `217 33% 10%` | Muted elements |
| `--muted-foreground` | `215 20% 45%` | `215 20% 70%` | Muted text |

### Status Indicators

| Token | Light Mode Value | Dark Mode Value | Purpose |
|-------|------------------|-----------------|---------|
| `--success` | `142 71% 45%` | `142 71% 50%` | Positive/success states |
| `--success-foreground` | `0 0% 100%` | `0 0% 100%` | Text on success |
| `--warning` | `38 92% 50%` | `38 92% 58%` | Warning/caution states |
| `--warning-foreground` | `0 0% 100%` | `0 0% 100%` | Text on warning |
| `--destructive` | `0 84% 60%` | `0 84% 66%` | Destructive/error states |
| `--destructive-foreground` | `0 0% 100%` | `0 0% 100%` | Text on destructive |

### Borders & Focus

| Token | Light Mode Value | Dark Mode Value | Purpose |
|-------|------------------|-----------------|---------|
| `--border` | `214 32% 91%` | `215 28% 17%` | Default borders |
| `--input` | `214 32% 91%` | `215 28% 17%` | Form input borders |
| `--ring` | `221 83% 53%` | `221 83% 62%` | Focus rings (same as primary) |

### Sidebar-Specific

| Token | Light Mode Value | Dark Mode Value | Purpose |
|-------|------------------|-----------------|---------|
| `--sidebar` | `0 0% 100%` | `222 47% 7%` | Sidebar background |
| `--sidebar-foreground` | `222 47% 11%` | `210 40% 98%` | Sidebar text |
| `--sidebar-hover` | `214 32% 94%` | `217 33% 14%` | Sidebar hover state |
| `--sidebar-active` | `221 83% 94%` | `221 83% 25%` | Active sidebar item bg |
| `--sidebar-active-foreground` | `221 83% 35%` | `221 83% 70%` | Active sidebar item text |
| `--sidebar-border` | `214 32% 91%` | `217 33% 17%` | Sidebar borders |

### Brand Colors

| Token | Light Mode Value | Dark Mode Value | Purpose |
|-------|------------------|-----------------|---------|
| `--brand-navy` | `#071943` (hex) | `#1e40af` (hex) | Brand navy (HEX, not HSL) |
| `--brand-navy-light` | `#2563eb` (hex) | `#3b82f6` (hex) | Brand navy light (HEX) |

## A.4 Typography Tokens

### Font Families

| Token | Value | Usage |
|-------|-------|-------|
| `--font-sans` | `'Inter', 'Inter Fallback', sans-serif` | Default body font |
| `--font-heading` | `var(--font-sans)` | Headings (currently same as sans) |
| `--font-mono` | `'Geist Mono', 'Geist Mono Fallback'` | Monospace/code |

### Type Scale

| Role | Size | Weight | Usage |
|------|------|--------|-------|
| Helper text | 12px / 0.75rem | 400 | Secondary/helper information |
| Label | 14px / 0.875rem | 500 | Form labels |
| Tab | 14px / 0.875rem | 500 | Tab labels |
| Button | 14px / 0.875rem | 500 | Button text |
| Breadcrumb | 14px / 0.875rem | 500 | Breadcrumb links |
| Input | 15px / 0.9375rem | 400 | Form input text |
| Description | 16px / 1rem | 400 | Secondary descriptions |
| Card title | 20px / 1.25rem | 600 | Card headings |
| Section title | 24px / 1.5rem | 600 | Section headings |
| Page title | 36px / 2.25rem | 700 | Page headings |

### Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| Regular | 400 | Body text |
| Medium | 500 | Labels, buttons, tabs |
| Semibold | 600 | Titles, headings |
| Bold | 700 | Page titles, emphasis |

## A.5 Radius Tokens (Scale & Formula)

The radius system uses a base value with multiplicative scales.

| Token | Formula | Value (px) | Usage |
|-------|---------|------------|-------|
| `--radius` | base | 8px | Default radius |
| `--radius-xs` | `radius * 0.2` | 2px | Tags, chips |
| `--radius-sm` | `radius * 0.4` | 4px | Inputs, small controls |
| `--radius-md` | `radius` | 8px | Buttons, cards (DEFAULT) |
| `--radius-lg` | `radius * 1.5` | 12px | Large cards |
| `--radius-xl` | `radius * 1.75` | 14px | Panels |
| `--radius-2xl` | `radius * 2` | 16px | Modals, dialogs |
| `--radius-3xl` | `radius * 2.5` | 20px | Hero surfaces |

### Radius Formula Reference

```css
/* In app/globals.css @theme inline */
--radius-xs: calc(var(--radius) * 0.2);   /* 2px */
--radius-sm: calc(var(--radius) * 0.4);   /* 4px */
--radius-md: var(--radius);                /* 8px (default) */
--radius-lg: calc(var(--radius) * 1.5);   /* 12px */
--radius-xl: calc(var(--radius) * 1.75);  /* 14px */
--radius-2xl: calc(var(--radius) * 2);    /* 16px */
--radius-3xl: calc(var(--radius) * 2.5);  /* 20px */
```

## A.6 Spacing Strategy

**Approach:** Tailwind-only (no CSS variables for spacing)

| Category | Tailwind Classes | Examples |
|----------|-----------------|----------|
| Padding | `p-{0-96}`, `px-{size}`, `py-{size}`, `pt-{size}`, `pb-{size}`, `pl-{size}`, `pr-{size}` | `p-4`, `px-6`, `py-2` |
| Margin | `m-{0-96}`, `mx-{size}`, `my-{size}`, etc. | `m-4`, `mx-auto` |
| Gaps | `gap-{0-96}`, `gap-x-{size}`, `gap-y-{size}` | `gap-4`, `gap-x-6` |
| Space between | `space-x-{size}`, `space-y-{size}` | `space-x-4`, `space-y-6` |

**Rationale:** Spacing is handled entirely through Tailwind utilities for consistency with the framework and simpler code.

## A.7 Shadow Strategy

**Approach:** Tailwind with custom extensions (via `@theme inline`)

| Category | Tailwind Classes | Examples |
|----------|-----------------|----------|
| Tailwind defaults | `shadow-{size}` | `shadow-sm`, `shadow-md`, `shadow-lg` |
| Custom shadows | `shadow-card`, `shadow-card-hover`, `shadow-card-lg` | GTG-specific card shadows |

**Custom shadows defined in `@theme inline`:**
```css
--shadow-card: 0 8px 30px rgba(0, 0, 0, 0.06);
--shadow-card-hover: 0 8px 30px rgba(0, 0, 0, 0.04);
--shadow-card-lg: 0 8px 30px rgba(0, 0, 0, 0.08);
```

**Rationale:** Custom shadows extend Tailwind via `@theme inline` for consistency while supporting GTG-specific designs. Never use inline `style={{ boxShadow: '...' }}`.

## A.8 Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `sticky` | 40 | Sticky positioned elements |
| `dropdown` | 50 | Dropdown menus |
| `overlay` | 50 | Overlays, modals backdrop |
| `toast` | 100 | Toast notifications |

## A.9 Dark Mode Implementation

Dark mode is implemented using the `.dark` class selector:

```css
/* In app/globals.css */
:root {
  /* Light mode values */
  --background: hsl(210 40% 98%);
  --foreground: hsl(222 47% 11%);
  /* ... */
}

.dark {
  /* Dark mode overrides */
  --background: hsl(222 47% 4%);
  --foreground: hsl(210 40% 98%);
  /* ... */
}
```

**Usage:** Apply `.dark` class to `<html>` element to enable dark mode.

---

# Section B: Code Patterns (AI-focused)

## B.1 Color Usage Patterns

### ✅ CORRECT — Using CSS variable in inline style with hsl()

```tsx
// For inline styles, wrap CSS variable in hsl()
style={{ backgroundColor: 'hsl(var(--primary))' }}
style={{ color: 'hsl(var(--foreground))' }}
style={{ backgroundColor: 'hsl(var(--card))' }}
```

### ✅ CORRECT — Using CSS variable in CSS class

```css
/* In globals.css */
.my-custom-class {
  background: var(--card);
  color: var(--card-foreground);
  border: 1px solid var(--border);
}
```

### ✅ CORRECT — Using Tailwind with semantic color classes

```tsx
// These map to CSS variables automatically
className="bg-primary text-primary-foreground"
className="bg-background text-foreground"
className="bg-card border-border"
```

### ✅ CORRECT — Using Tailwind with primitive colors

```tsx
// For generic/universal colors, use Tailwind primitives
className="bg-white text-black"
className="bg-gray-100"
className="text-gray-500"
```

### ❌ INCORRECT — Hardcoded hex colors

```tsx
// WRONG - Don't use hex in JSX
style={{ backgroundColor: '#fff' }}
style={{ color: '#071943' }}

// WRONG - Don't use hex in JSX
<div className="bg-[#071943]">...</div>

// WRONG - Don't use hex in inline styles
<div style={{ backgroundColor: '#2563eb' }}>...</div>
```

### ❌ INCORRECT — Hardcoded rgb/rgba

```tsx
// WRONG - Don't use rgb/rgba
style={{ backgroundColor: 'rgb(255, 255, 255)' }}
style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
```

### ❌ INCORRECT — Tailwind with hex values

```tsx
// WRONG - Avoid hex in Tailwind
className="bg-[#071943]"
className="text-[#2563eb]"
```

### ❌ INCORRECT — Using primitive Tailwind where semantic exists

```tsx
// WRONG - Don't use primitive when semantic exists
className="bg-white"           // Use bg-background instead
className="bg-gray-50"         // Use bg-muted instead
className="text-gray-900"      // Use text-foreground instead
```

## B.2 Spacing Patterns

### ✅ CORRECT — Tailwind utility

```tsx
// Use Tailwind utilities for all spacing
className="p-4 gap-2"
className="px-6 py-3"
className="m-4 mx-auto"
className="space-y-4"
```

### ❌ INCORRECT — CSS variable for spacing

```tsx
// WRONG - Don't use CSS vars for spacing
style={{ padding: 'var(--space-4)' }}
style={{ margin: 'var(--space-2)' }}

// WRONG - Don't use CSS vars for gaps
<div style={{ gap: '16px' }}>...</div>
```

## B.3 Shadow Patterns

### ✅ CORRECT — Tailwind utility (standard)

```tsx
// Use Tailwind shadow utilities for defaults
className="shadow-sm"
className="shadow-md"
className="shadow-lg"
```

### ✅ CORRECT — Custom shadow utilities (GTG extensions)

```tsx
// Use GTG custom shadows defined in @theme inline
className="shadow-card"        // Card default shadow
className="shadow-card-hover"  // Card hover shadow
className="shadow-card-lg"     // Large card shadow
```

### ❌ INCORRECT — Inline style for shadows

```tsx
// WRONG - Don't use inline styles for shadows
style={{ boxShadow: '0 8px 30px rgba(0, 0, 0, 0.06)' }}
style={{ boxShadow: 'var(--shadow-card)' }}

// WRONG - Don't use arbitrary values
className="shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
```

### ❌ INCORRECT — Hardcoded shadow values

```tsx
// WRONG - Don't hardcode shadow values
box-shadow: 0 8px 30px rgba(0, 0, 0, 0.06);  // in CSS
```

## B.4 Border Radius Patterns

### ✅ CORRECT — Tailwind utility

```tsx
// Use Tailwind radius utilities
className="rounded-md"     // 8px (default)
className="rounded-sm"     // 4px
className="rounded-lg"     // 12px
className="rounded-xl"     // 14px
className="rounded-2xl"    // 16px
className="rounded-full"   // 9999px (pill/circle)
```

### ✅ CORRECT — CSS variable for custom radius

```tsx
// When you need the exact radius value
style={{ borderRadius: 'var(--radius)' }}
style={{ borderRadius: 'calc(var(--radius) * 2)' }}
```

## B.5 Typography Patterns

### ✅ CORRECT — Tailwind typography

```tsx
// Font size
className="text-sm"      // 14px
className="text-base"    // 16px
className="text-lg"      // 18px
className="text-xl"      // 20px
className="text-2xl"     // 24px
className="text-3xl"     // 30px
className="text-4xl"     // 36px

// Font weight
className="font-normal"  // 400
className="font-medium"  // 500
className="font-semibold" // 600
className="font-bold"    // 700

// Text color
className="text-foreground"
className="text-muted-foreground"
className="text-primary"
```

### ❌ INCORRECT — Hardcoded font sizes

```tsx
// WRONG - Don't use inline styles for typography
style={{ fontSize: '14px' }}
style={{ fontWeight: 500 }}

// WRONG - Avoid arbitrary values when standard exists
className="text-[14px]"
className="font-[500]"
```

---

# Section C: Decision Trees (AI-focused)

## C.1 Decision Tree: "Where do I add styling?"

```
Q: Are you styling a component?
├── YES
│   ├── Is it a shadcn/ui primitive? (Button, Dialog, Card, etc.)
│   │   └── YES → Extend via CVA in a wrapper component, NOT modifying source
│   │           Example: components/business/status-badge.tsx wraps Badge
│   └── NO
│       ├── Is it used by 2+ features?
│       │   └── YES → Create in components/business/ or components/ui/
│       │       └── Export via barrel index.ts
│       │   └── NO → Create in components/{feature}/
│       └── What type of styling?
│           ├── Color (semantic meaning - brand, status, interactive)
│           │   └── Add to app/globals.css :root AND .dark
│           │   └── Also add to @theme inline if used in Tailwind classes
│           ├── Color (primitive/numeric - generic colors)
│           │   └── Use Tailwind utility (bg-blue-500, text-gray-900)
│           ├── Spacing
│           │   └── Use Tailwind utility (p-4, gap-2, mx-auto)
│           ├── Shadow
│           │   └── Use Tailwind utility (shadow-sm, shadow-md)
│           └── Border radius
│               └── Use Tailwind utility (rounded-md, rounded-lg)
└── NO (utility class or global style)
    └── Add to app/globals.css @layer components
        └── Prefix custom classes with g2g- (e.g., g2g-page-scroll)
```

## C.2 Decision Tree: "How do I theme this component?"

```
Q: Do you need to change an existing token value?
├── YES (modifying an existing token)
│   └── Modify :root AND .dark in app/globals.css
│   └── Example: Change --primary for branding update
│
├── NO (adding new semantic color)
│   ├── Define in :root with HSL triplet
│   ├── Define in .dark with adjusted value
│   ├── Add to @theme inline if used in Tailwind classes as bg-{name}
│   └── Document in this file (design-tokens.md)
│
└── NO (one-off custom color that won't be reused)
    └── Consider: is this a pattern or exception?
        ├── Pattern (will be reused) → Add as semantic token
        └── Exception (truly one-off) → Use inline style with hsl()
            └── Example: style={{ backgroundColor: 'hsl(200 50% 50%)' }}
```

## C.3 Decision Tree: "How do I add a component variant?"

```
Q: Is the base component a shadcn/ui primitive?
├── YES (Button, Badge, Dialog, etc.)
│   ├── Use CVA to create variant without modifying source
│   ├── Create wrapper in components/business/
│   └── Example: StatusBadge wraps Badge with status variants
│
└── NO (custom component)
    └── Q: Is it used by 2+ features?
        ├── YES → Add to components/business/
        └── NO → Add to components/{feature}/
```

## C.4 Decision Tree: "Dark mode implementation"

```
Q: Are you adding a new color token?
├── YES
│   ├── Add to :root with light mode value
│   ├── Add to .dark with dark mode value
│   ├── Both values should maintain similar perceived brightness
│   └── Test in both modes
│
└── NO (using existing token)
    └── Token will automatically adapt if properly defined
        └── Verify token exists in both :root and .dark
```

## C.5 Decision Tree: "When to use CSS vars vs Tailwind"

```
Q: What are you styling?
├── Semantic color (brand, status, interactive state)
│   └── CSS variable: var(--primary), var(--success), etc.
│
├── Primitive/generic color
│   └── Tailwind: bg-blue-500, text-gray-900, etc.
│
├── Spacing (padding, margin, gap)
│   └── Tailwind: p-4, gap-2, mx-auto
│
├── Shadow
│   └── Tailwind: shadow-sm, shadow-md
│
├── Border radius
│   └── Tailwind: rounded-md, rounded-lg
│   └── Exception: Use var(--radius) for custom calculations
│
└── Typography (size, weight, color)
    └── Tailwind: text-sm, font-medium, text-foreground
```

---

# Section D: Naming Conventions

## D.1 CSS Variables

**Pattern:** `--{category}-{variant}`

| Category | Examples |
|----------|----------|
| Color | `--primary`, `--background`, `--foreground`, `--card` |
| Semantic | `--sidebar-hover`, `--sidebar-active`, `--input` |
| Status | `--success`, `--warning`, `--destructive` |
| Brand | `--brand-navy`, `--brand-navy-light` |
| Layout | `--agent-panel-width` |

**Rules:**
- Use kebab-case (lowercase with hyphens)
- Semantic tokens describe meaning, not appearance
- Pair tokens: `--primary` should have `--primary-foreground`

## D.2 Tailwind Classes

**Pattern:** `{property}-{value}`

| Property | Values | Examples |
|----------|--------|----------|
| Background | color, gradient | `bg-primary`, `bg-gradient-to-r` |
| Text | color, size | `text-foreground`, `text-sm` |
| Border | color, radius | `border-primary`, `rounded-md` |
| Padding | 0-96, fraction | `p-4`, `px-6`, `py-2` |
| Margin | 0-96, auto | `m-4`, `mx-auto`, `my-2` |
| Gap | 0-96 | `gap-4`, `gap-x-6` |
| Shadow | size | `shadow-sm`, `shadow-md`, `shadow-lg` |

**Semantic vs Primitive:**
- Semantic: `bg-primary`, `text-foreground` (use CSS variables)
- Primitive: `bg-blue-500`, `text-gray-900` (use Tailwind defaults)

## D.3 Component Files

**Pattern:** `PascalCase.tsx`

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase.tsx | `Button.tsx`, `StatusBadge.tsx` |
| Variants | ParentName.{variant}.tsx | `Button.variants.tsx` |
| Tests | ComponentName.test.tsx | `Button.test.tsx` |
| Stories | ComponentName.stories.tsx | `Button.stories.tsx` |

## D.4 Custom Utility Classes

**Pattern:** `g2g-{purpose}`

| Purpose | Example |
|---------|---------|
| Page scroll | `g2g-page-scroll` |
| Scrollbar styling | `g2g-scrollbar` |
| Login gradient | `g2g-login-gradient` |

**Rules:**
- Prefix all custom classes with `g2g-`
- Document in `app/globals.css` @layer components
- Only for styles that cannot be achieved with Tailwind

---

# Section E: File Location Guide

## E.1 Token Locations

| Type | Location | When to Use |
|------|----------|-------------|
| Semantic color tokens | `app/globals.css` :root / .dark | Brand colors, status, interactive |
| Radius tokens | `app/globals.css` @theme inline | Border radius values |
| Typography tokens | `app/globals.css` @theme inline | Font families |
| Custom utility classes | `app/globals.css` @layer components | Custom classes with g2g- prefix |

## E.2 Component Locations

| Type | Location | When to Use |
|------|----------|-------------|
| shadcn primitives | `components/ui/*.tsx` | **NEVER modify** (read-only base) |
| Extended variants | `components/ui/index.ts` | CVA variants, re-exports |
| App components | `components/business/` | Used by 2+ features, no domain logic |
| Feature components | `components/{feature}/` | Single feature use |
| Shell/layout | `components/shell/` | App shell, navigation |
| Workflow | `components/workflow/` | Multi-step process compositions |

## E.3 Example File Structure

```
/app
├── globals.css                    # Design tokens, custom utilities
/components
├── ui/                            # Layer 1: shadcn primitives (NEVER edit)
│   ├── button.tsx
│   ├── dialog.tsx
│   ├── index.ts                   # Re-exports with CVA extensions
│   └── ...
├── business/                      # Layer 2: App-wide components
│   ├── kpi-card.tsx
│   ├── status-badge.tsx           # Wraps Badge with status variants
│   ├── empty-state.tsx
│   ├── index.ts
│   └── ...
├── shell/                         # App shell components
│   ├── dashboard-shell.tsx
│   ├── sidebar.tsx
│   └── header.tsx
├── attendance/                    # Layer 3: Domain components
│   ├── components/
│   │   ├── attendance-calendar.tsx
│   │   └── index.ts
│   └── ...
├── task/
│   └── ...
└── ...
/docs/frontend
├── design-tokens.md              # This file
├── design-system-strategy.md
├── component-structure.md
└── component-variants.md
```

## E.4 Import Rules

```
✅ ALLOWED IMPORTS:
- From Layer 1: @/components/ui (shadcn primitives)
- From Layer 2: @/components/business (app components)
- From Layer 3: @/components/{specific-domain}
- From @/lib/*, @/hooks/*, @/types/*

❌ FORBIDDEN IMPORTS:
- From Layer 3 to Layer 3 (cross-domain)
  - WRONG: @/components/attendance → @/components/task
  - RIGHT: Move to Layer 2 or use shared hooks
```

---

# Section F: Validation Checklist

## F.1 Pre-Commit Validation (AI Agent Checklist)

Run these checks before any commit:

### Token Compliance

```bash
# Check for hardcoded hex colors in TSX files
grep -rn "#[0-9a-fA-F]\{3,6\}" components/ --include="*.tsx"

# Check for hardcoded rgb/rgba
grep -rn "rgb(" components/ --include="*.tsx" | grep -v "hsl"

# Check for inline spacing styles
grep -rn "style={{.*padding" components/ --include="*.tsx"
grep -rn "style={{.*margin" components/ --include="*.tsx"

# Check for CSS var spacing (should use Tailwind)
grep -rn "var(--space" components/ --include="*.tsx"
```

### shadcn Compatibility

```bash
# Verify no direct modifications to shadcn primitives
git diff components/ui/ --name-only

# If files appear in diff, restore them:
git checkout -- components/ui/
```

### New Token Validation

```bash
# Verify new tokens added to both :root AND .dark
# Check app/globals.css for the token in both sections
grep -A5 "token-name" app/globals.css
```

### Custom Class Validation

```bash
# Check custom classes have g2g- prefix
grep "^\." app/globals.css | grep -v "g2g-"

# Should return nothing - all custom classes must have g2g- prefix
```

## F.2 Visual Regression Check

```bash
# Run the app and verify:
# 1. Light mode renders correctly
# 2. Dark mode (.dark class) renders correctly
# 3. No unexpected layout shifts
# 4. All interactive states work
```

## F.3 Checklist Summary

Before committing, verify:

- [ ] No hardcoded hex colors in TSX files
- [ ] No hardcoded rgb/rgba in TSX files
- [ ] No inline spacing styles
- [ ] No shadcn/ui modifications (components/ui/*)
- [ ] New tokens added to :root AND .dark
- [ ] CVA used for component variants (not modifying source)
- [ ] Custom classes use g2g- prefix
- [ ] Dark mode renders correctly

---

# Section G: shadcn/ui Compatibility

## G.1 How GTG Maps to shadcn

The GTG design system is built on top of shadcn/ui. Here's the mapping:

| shadcn Token | GTG Token | Usage |
|--------------|-----------|-------|
| `background` | `--background` | App background |
| `foreground` | `--foreground` | Primary text |
| `card` | `--card` | Card surfaces |
| `primary` | `--primary` | Primary actions |
| `secondary` | `--secondary` | Secondary actions |
| `muted` | `--muted` | Muted surfaces |
| `accent` | `--accent` | Accent surfaces |
| `destructive` | `--destructive` | Destructive actions |
| `border` | `--border` | Borders |
| `input` | `--input` | Input borders |
| `ring` | `--ring` | Focus rings |

## G.2 Extending shadcn Components

**Pattern:** Create a wrapper with CVA, don't modify source.

```typescript
// components/business/status-badge.tsx
import { Badge } from '@/components/ui/badge'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const statusVariants = cva('capitalize', {
  variants: {
    status: {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      approved: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300',
    },
  },
  defaultVariants: {
    status: 'pending',
  },
})

export type StatusBadgeProps = VariantProps<typeof statusVariants> & {
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge className={cn(statusVariants({ status }), className)}>
      {status}
    </Badge>
  )
}
```

## G.3 NEVER Edit These Files

These files are managed by shadcn and should never be edited directly:

- `components/ui/button.tsx`
- `components/ui/dialog.tsx`
- `components/ui/dropdown-menu.tsx`
- `components/ui/card.tsx`
- `components/ui/badge.tsx`
- All other files in `components/ui/`

**Exception:** Accessibility fixes only (ARIA attributes, keyboard navigation).

## G.4 When shadcn Updates

When shadcn releases updates:

1. Run the shadcn update command
2. Accept changes to `components/ui/*`
3. Do NOT accept changes to `app/globals.css` (GTG tokens take precedence)
4. Verify GTG tokens still work correctly
5. Run validation checklist

---

# Section H: Anti-Patterns & Fixes

## H.1 Color Anti-Patterns

| Anti-Pattern | Why Wrong | Correct Fix |
|--------------|----------|-------------|
| `style={{ color: '#fff' }}` | Hardcoded color | `className="text-foreground"` or `style={{ color: 'hsl(var(--foreground))' }}` |
| `className="bg-white"` | Primitive instead of semantic | `className="bg-background"` |
| `style={{ backgroundColor: '#071943' }}` | Hardcoded brand color | Use `--brand-navy` via CSS class or add to globals.css |
| `className="text-[#2563eb]"` | Arbitrary hex value | Use Tailwind semantic or add token |

## H.2 Spacing Anti-Patterns

| Anti-Pattern | Why Wrong | Correct Fix |
|--------------|----------|-------------|
| `style={{ padding: '16px' }}` | Inline style | `className="p-4"` (Tailwind 4px base) |
| `style={{ margin: '8px' }}` | Inline style | `className="m-2"` |
| `var(--space-4)` in style | CSS var for spacing | Tailwind utility |
| `style={{ gap: '12px' }}` | Inline style | `className="gap-3"` |

## H.3 Component Anti-Patterns

| Anti-Pattern | Why Wrong | Correct Fix |
|--------------|----------|-------------|
| Edit `components/ui/button.tsx` | Breaks shadcn upgrade path | Create wrapper in `components/business/` |
| Cross-domain import | Violates layer architecture | Move to shared location or use hook |
| Default export | Inconsistent, harder to refactor | Use named exports |
| Prop drilling > 2 levels | Maintenance burden | Use context or state management |

## H.4 Dark Mode Anti-Patterns

| Anti-Pattern | Why Wrong | Correct Fix |
|--------------|----------|-------------|
| Token only in `:root` | Breaks dark mode | Add to both `:root` and `.dark` |
| Different token names for dark | Inconsistent | Same token name, different value |
| Hardcoded dark color | No theming support | Use CSS variable |

## H.5 TypeScript Anti-Patterns

| Anti-Pattern | Why Wrong | Correct Fix |
|--------------|----------|-------------|
| `any` type | No type safety | Use specific types |
| Missing prop types | Runtime errors | Define interface |
| Non-existent imports | Build errors | Verify path exists |

---

# Section I: Quick Reference

## I.1 Common Token Usages

| Context | Token Source | Example |
|---------|-------------|---------|
| Semantic color in JSX | CSS var + hsl() | `style={{ color: 'hsl(var(--primary))' }}` |
| Semantic color in CSS | CSS var | `background: var(--card);` |
| Semantic color in Tailwind | Tailwind class | `className="bg-primary text-foreground"` |
| Primitive color | Tailwind | `className="bg-blue-500"` |
| Spacing | Tailwind | `className="p-4 gap-2"` |
| Shadow | Tailwind | `className="shadow-md"` |
| Border radius | Tailwind | `className="rounded-lg"` |

## I.2 Common Component Patterns

| Pattern | Example |
|---------|---------|
| Button with primary | `<Button className="bg-primary text-primary-foreground">Submit</Button>` |
| Card surface | `<div className="bg-card text-card-foreground rounded-lg border border-border p-6">` |
| Muted text | `<p className="text-muted-foreground">Helper text</p>` |
| Input field | `<Input className="border-input" />` |
| Status indicator | `<StatusBadge status="approved" />` |

## I.3 Token Pairs (Color + Foreground)

Always use these together:

| Background | Foreground |
|------------|------------|
| `--background` | `--foreground` |
| `--card` | `--card-foreground` |
| `--popover` | `--popover-foreground` |
| `--primary` | `--primary-foreground` |
| `--secondary` | `--secondary-foreground` |
| `--muted` | `--muted-foreground` |
| `--accent` | `--accent-foreground` |
| `--success` | `--success-foreground` |
| `--warning` | `--warning-foreground` |
| `--destructive` | `--destructive-foreground` |

## I.4 Animation & Transitions

| Token/Class | Value | Usage |
|-------------|-------|-------|
| Duration fast | 150ms | Hover states |
| Duration normal | 240ms | Standard transitions |
| Duration slow | 350ms | Page transitions |
| Easing | `cubic-bezier(0.22, 1, 0.36, 1)` | All transitions |

**Usage:**
```tsx
className="transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]"
```

## I.5 Breakpoints Reference

| Breakpoint | Value | Usage |
|------------|-------|-------|
| Default (base) | 0px+ | Mobile |
| sm | 640px+ | Large phones, small tablets |
| md | 768px+ | Tablets |
| lg | 1024px+ | Laptops |
| xl | 1280px+ | Desktops |
| 2xl | 1536px+ | Large screens |

**Usage:**
```tsx
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
```

---

## Document Version

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-07-08 | Initial comprehensive token documentation |

---

*End of GTG Design Tokens Reference*
