# Styling Guide

This guide establishes the design token standards for the GapstoGrowth (GTG) application.

## Enforcement

### ESLint Rule for Hardcoded Colors

Due to ESLint flat config compatibility issues with `eslint-config-next`, the automated ESLint rule to prevent hardcoded hex colors is currently unavailable. As a workaround:

1. **Code Review**: Reviewers should check for hardcoded hex colors in PRs
2. **Manual Check**: Run this command to find any hardcoded hex colors:
   ```bash
   grep -rE '\[#[0-9a-fA-F]{3,6}\]' --include="*.tsx" --include="*.ts" components/ app/
   ```
3. **Pre-commit Hook** (recommended): Add to your pre-commit workflow

## Design Tokens

### Color Tokens (Use These)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--primary` | Blue | Blue lighter | CTAs, links, active states |
| `--primary-foreground` | White | White | Text on primary |
| `--foreground` | Dark slate | White | Main text |
| `--background` | Off-white | Dark | Page backgrounds |
| `--card` | White | Dark gray | Card surfaces |
| `--surface` | White | Dark gray | Custom surface |
| `--surface-muted` | Light gray | Darker gray | Muted surfaces |
| `--border` | Light gray | Darker gray | Borders |
| `--muted` | Light gray | Darker gray | Muted backgrounds |
| `--muted-foreground` | Gray | Light gray | Secondary text |
| `--destructive` | Red | Red lighter | Errors, delete actions |
| `--destructive-foreground` | White | White | Text on destructive |
| `--success` | Green | Green lighter | Success states |
| `--success-foreground` | White | White | Text on success |
| `--warning` | Orange | Orange lighter | Warnings |
| `--warning-foreground` | White | White | Text on warning |
| `--brand-navy` | `#071943` | `#1e40af` | Brand navy color |
| `--brand-navy-light` | `#2563eb` | `#3b82f6` | Brand navy light |

### Tailwind Color Classes

The following CSS variables are mapped to Tailwind utility classes:

- `--color-primary` → `bg-primary`, `text-primary`, `border-primary`
- `--color-foreground` → `bg-foreground`, `text-foreground`
- `--color-background` → `bg-background`, `text-background`
- `--color-surface` → `bg-surface`, `text-surface`
- `--color-surface-muted` → `bg-surface-muted`, `text-surface-muted`
- `--color-border` → `bg-border`, `text-border`, `border-border`
- `--color-muted` → `bg-muted`, `text-muted`
- `--color-muted-foreground` → `text-muted-foreground`
- `--color-destructive` → `bg-destructive`, `text-destructive`
- `--color-success` → `bg-success`, `text-success`
- `--color-warning` → `bg-warning`, `text-warning`
- `--color-brand-navy` → `bg-brand-navy`, `text-brand-navy`
- `--color-sidebar` → `bg-sidebar`, `text-sidebar`
- `--color-sidebar-foreground` → `text-sidebar-foreground`
- `--color-sidebar-hover` → `bg-sidebar-hover`
- `--color-sidebar-active` → `bg-sidebar-active`
- `--color-sidebar-active-foreground` → `text-sidebar-active-foreground`

### Colors NOT to Use

- Any hardcoded hex colors for brand colors: `#071943`, `#173c95`, etc.
- Hardcoded hex for generic styling: `#f3c7a5`, `#3f220f`
- Tailwind `slate-*` colors in place of semantic tokens
- Tailwind `gray-*` colors for text
- Tailwind `blue-*` colors for primary actions (use `primary-*` instead)

### Always Use

- `text-foreground` not `text-slate-900` or `text-slate-800`
- `text-muted-foreground` not `text-slate-600` or `text-slate-500`
- `bg-muted` not `bg-slate-100`
- `bg-surface` not `bg-white` for component backgrounds
- `border-border` not `border-slate-200`
- `text-primary` not `text-blue-600` for links and actions
- `bg-primary` not `bg-blue-600` for primary buttons

### Icon Colors

Icon colors can use semantic color names when they convey meaning:

- `text-primary` - Primary actions or brand icons
- `text-muted-foreground` - Secondary icons
- `text-destructive` - Delete/error icons
- `text-success` - Success icons
- `text-warning` - Warning icons

Use specific color names (blue, green, amber, etc.) for decorative icons that provide visual variety, not semantic meaning.

## Shadow

- Use Tailwind scale: `shadow-sm`, `shadow`, `shadow-lg`
- Do NOT use custom shadow tokens (they are deprecated)

## Radius

- Use Tailwind scale: `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl`
- Custom radius tokens (`--radius-*`) are available but prefer Tailwind utilities

## Buttons

- Prefer `<Button>` component from `@/components/ui/button` over raw `<button>`
- Use semantic variants: `default`, `destructive`, `outline`, `ghost`
- Icon buttons: use `size="icon"` variant

### Button Variants

```tsx
// Primary action
<Button>Click me</Button>

// Destructive action
<Button variant="destructive">Delete</Button>

// Outline
<Button variant="outline">Cancel</Button>

// Ghost (no background)
<Button variant="ghost">Cancel</Button>

// Icon button
<Button variant="ghost" size="icon">
  <SettingsIcon className="size-4" />
</Button>
```

## Form Components

Use components from `@/components/ui/` for consistent styling:

- `<Input>` for text inputs
- `<Label>` for labels
- `<Checkbox>` for checkboxes
- `<Select>` or custom select components

### Input Styling

```tsx
<Input
  className="h-14 rounded-xl border-input bg-surface pl-14 pr-5 text-base shadow-sm placeholder:text-muted-foreground"
/>
```

## Cards and Surfaces

- Use `bg-card` or `bg-surface` for card backgrounds
- Use `border-border` for card borders
- Use `shadow-sm` for subtle elevation

## Component Patterns

### Avatar Fallback

Avatar fallbacks use `bg-muted text-muted-foreground` for initials:

```tsx
<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
  {initials}
</div>
```

### Semantic Text

```tsx
// Primary text
<p className="text-sm font-medium text-foreground">Title</p>

// Secondary text
<p className="text-xs text-muted-foreground">Description</p>
```

## CSS Utility Classes

Some custom CSS utilities are available in `app/globals.css`:

```css
/* Page scrollable container */
.g2g-page-scroll

/* Custom scrollbar styling */
.g2g-scrollbar

/* Sidebar transition easing */
.sidebar-transition

/* Login page gradients */
.g2g-login-gradient
.g2g-login-hero-gradient
.g2g-login-card-gradient
```

## Dark Mode

The application supports dark mode through the `.dark` class on `<html>`. All design tokens have dark theme variants defined in `app/globals.css`.

When adding new colors, ensure they have appropriate dark theme alternatives.

## Migration Notes

If you encounter legacy code with hardcoded colors:

1. Replace `#071943` and similar brand colors with `text-brand-navy` or `bg-brand-navy`
2. Replace `#f3c7a5` and similar avatar colors with `bg-muted text-muted-foreground`
3. Replace `text-slate-600` with `text-muted-foreground`
4. Replace `bg-white` for component backgrounds with `bg-surface`
5. Replace `border-slate-200` with `border-border`

---

*Last updated: 2026-07-08*
