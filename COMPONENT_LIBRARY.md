# UI Primitive Component Library Documentation

## Overview
Complete production-ready primitive component library built with React, TypeScript, Tailwind CSS v4, Radix UI primitives, and class-variance-authority (CVA). All components are fully accessible, responsive, dark mode compatible, and follow the GTG design system tokens.

## Architecture

### Radix UI Integration
All interactive components are built on top of Radix UI primitives for:
- **Full WCAG 2.1 AA accessibility compliance**
- **Proper keyboard navigation** (arrow keys, typeahead, escape handling)
- **Focus management** (focus trap in modals, focus restoration)
- **Screen reader support** (ARIA attributes, live regions)

Components using Radix UI:
- `Dialog`, `AlertDialog` → `@radix-ui/react-dialog`
- `Sheet` → `@radix-ui/react-dialog` (variants)
- `DropdownMenu` → `@radix-ui/react-dropdown-menu`
- `Select` → Custom with Radix-like keyboard patterns
- `Button` → `@radix-ui/react-slot`

### Import Conventions

```typescript
// ✅ Correct - Import from @/components/ui
import { Button } from '@/components/ui'
import { Dialog, DialogContent } from '@/components/ui'

// ✅ Also correct - Direct import
import { Button } from '@/components/ui/button'

// ❌ Wrong - Do not import from legacy paths
import { Button } from '@/components/org/gtg-ui'  // Removed!
```

## Design System Integration
- Uses existing `globals.css` design tokens exclusively
- No new colors, spacing, shadows, or typography scales created
- All components leverage:
  - Colors: `bg-background`, `bg-card`, `bg-primary`, `bg-secondary`, `bg-brand`, `text-foreground`, `text-muted-foreground`, `border-border`, `ring-ring`
  - Spacing: Tailwind scale (px, 0.5rem, 1rem, 1.5rem, 2rem, etc.)
  - Shadows: `shadow-xs`, `shadow-sm`, `shadow-md`, `shadow-lg`
  - Border Radius: `rounded-xs`, `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`

## Component Categories

### Form Components (10)
1. **Button** - Primary action component with multiple variants and sizes (Radix Slot)
2. **Input** - Text input with validation support and responsive sizes
3. **Textarea** - Multi-line text input with auto-resizing
4. **Label** - Accessible label with optional required indicator
5. **Select** - Dropdown select with keyboard navigation (arrow keys, typeahead, Escape)
6. **Checkbox** - Accessible checkbox with multiple sizes
7. **RadioGroup & Radio** - Radio button group with grouping logic
8. **Switch** - Toggle switch component with smooth animations
9. **FileUpload** - File upload with drag-drop and size validation
10. **SearchInput** - Search input with optional icon support

### Layout Components (3)
1. **Card** - Flexible card container with header, footer, title, description
2. **Separator** - Horizontal or vertical divider
3. **Breadcrumb** - Navigation breadcrumb with separators

### Display Components (6)
1. **Badge** - Multi-variant badge component (default, secondary, destructive, outline, success, warning, muted)
2. **StatusBadge** - Status indicator badge (active, inactive, pending, error, processing)
3. **Alert** - Alert container with variants (default, destructive, warning, success, info)
4. **Skeleton** - Loading skeleton placeholder
5. **Spinner** - Animated loading spinner with color variants
6. **Progress** - Progress bar with variant support

### Button Variants
1. **IconButton** - Icon-only button component with size variants

### Modal Components (3)
1. **Dialog** - General purpose modal dialog (Radix UI)
2. **AlertDialog** - Confirmation/alert dialog (Radix UI)
3. **Sheet** - Side panel/drawer component (Radix UI)

### Menu Components (2)
1. **DropdownMenu** - Dropdown menu with trigger and items (Radix UI)
2. **Accordion** - Collapsible accordion with single/multiple expansion

### Overlay Components (1)
1. **Tooltip** - Hoverable tooltip with delay and positioning

### State Components (3)
1. **EmptyState** - Empty state display with icon, title, description, and action
2. **ErrorState** - Error state display with retry functionality
3. **DataList** - Key-value data display grid

## Component Features

### Accessibility
- Full ARIA support (roles, attributes, keyboard navigation)
- Screen reader optimized
- Focus management
- Color contrast compliant
- Semantic HTML

### Responsive Design
- Mobile-first approach
- Responsive spacing and sizing
- Touch-friendly default sizes
- Grid/flexbox layouts

### Dark Mode
- Full dark mode support via CSS custom properties
- Automatic color adaptation
- No additional setup required

### TypeScript Support
- Full type definitions
- Exported component props interfaces
- Strict typing throughout

### Variant Architecture
- CVA-based variant system
- Composable size and variant combinations
- Type-safe variant usage
- Easy to extend

### ForwardRef Support
- All components support `ref` forwarding
- Direct DOM access when needed
- Proper TypeScript types

## File Structure
```
components/
├── ui/
│   ├── button.tsx           # Radix Slot-based
│   ├── input.tsx
│   ├── textarea.tsx
│   ├── label.tsx
│   ├── select.tsx           # Full keyboard accessibility
│   ├── checkbox.tsx
│   ├── radio-group.tsx
│   ├── switch.tsx
│   ├── file-upload.tsx
│   ├── search-input.tsx
│   ├── card.tsx
│   ├── separator.tsx
│   ├── breadcrumb.tsx
│   ├── badge.tsx
│   ├── status-badge.tsx
│   ├── alert.tsx
│   ├── skeleton.tsx
│   ├── spinner.tsx
│   ├── progress.tsx
│   ├── icon-button.tsx
│   ├── dialog.tsx           # Radix UI
│   ├── alert-dialog.tsx     # Radix UI
│   ├── sheet.tsx            # Radix UI
│   ├── dropdown-menu.tsx    # Radix UI
│   ├── accordion.tsx
│   ├── tooltip.tsx
│   ├── empty-state.tsx
│   ├── error-state.tsx
│   ├── data-list.tsx
│   └── index.ts (barrel export)
├── org/
│   └── components.tsx       # Organization-specific components
└── data/
    └── index.ts             # Re-exports from @/components/ui
```

## Usage Examples

### Importing Components
```typescript
// Individual imports
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'

// Barrel export (recommended)
import { Button, Input, Label, Card } from '@/components/ui'
```

### Button Usage
```tsx
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Variants
<Button variant="default">Default</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>

// Sizes
<Button size="xs">Extra Small</Button>
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon">Icon</Button>

// asChild for wrapping
<Button asChild>
  <Link href="/dashboard">Go to Dashboard</Link>
</Button>
```

### Dialog Usage
```tsx
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
    </DialogHeader>
    Dialog content here
  </DialogContent>
</Dialog>
```

### DropdownMenu Usage
```tsx
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Open Menu</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Edit</DropdownMenuItem>
    <DropdownMenuItem>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Select with Keyboard Support
```tsx
import { Select } from '@/components/ui/select'

<Select
  options={[
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
  ]}
  value={value}
  onChange={setValue}
  placeholder="Select an option"
/>

// Keyboard shortcuts:
// - Arrow Up/Down: Navigate options
// - Enter/Space: Select option
// - Escape: Close dropdown
// - Home/End: Jump to first/last option
// - Typeahead: Jump to matching option
```

## Component Variants Reference

### Button
- Variants: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`
- Sizes: `xs`, `sm`, `default`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`
- Props: `asChild`, `disabled`, `type`

### Badge
- Variants: `default`, `secondary`, `destructive`, `outline`, `success`, `warning`, `muted`

### StatusBadge
- Variants: `default`, `active`, `inactive`, `pending`, `error`, `processing`
- Sizes: `sm`, `default`, `lg`

### Alert
- Variants: `default`, `destructive`, `warning`, `success`, `info`

### Spinner
- Sizes: `sm`, `default`, `lg`, `xl`
- Variants: `default`, `primary`, `secondary`, `destructive`, `success`, `warning`

### Progress
- Variants: `default`, `success`, `warning`, `destructive`

### IconButton
- Variants: `default`, `outline`, `ghost`, `secondary`, `destructive`
- Sizes: `xs`, `sm`, `default`, `lg`, `xl`

## Best Practices

### ✅ Do
1. **Use design tokens** - Don't add inline Tailwind classes outside the design system
2. **Use Button component** - Always prefer `<Button>` over raw `<button>` elements
3. **Use Dialog/Sheet from @/components/ui** - These are built on Radix UI for accessibility
4. **Use cn() utility** - Always use `cn()` from `@/lib/utils` for className merging
5. **Combine variants** - Use multiple variant props for complex styling needs
6. **Use asChild** - Use `asChild` prop to compose with other elements (links, etc.)
7. **Leverage keyboard support** - Select and DropdownMenu support full keyboard navigation

### ❌ Don't
1. **Raw button elements** - Avoid `<button className="...rounded...">`. Use `<Button>` instead
2. **Custom dialogs** - Don't create custom modal implementations. Use `Dialog` or `Sheet`
3. **Duplicate components** - Don't create duplicate versions of existing components
4. **Legacy imports** - Don't import from `@/components/org/gtg-ui` (removed)

## Production Readiness
✓ Full TypeScript support
✓ Comprehensive accessibility (WCAG 2.1 AA)
✓ Complete test coverage ready
✓ Dark mode support
✓ Responsive design
✓ Performance optimized
✓ Tree-shakeable exports
✓ Radix UI primitives
✓ Tailwind CSS v4 compatible
✓ shadcn/ui patterns compliant
