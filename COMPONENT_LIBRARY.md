# UI Primitive Component Library Documentation

## Overview
Complete production-ready primitive component library built with React, TypeScript, Tailwind CSS v4, and class-variance-authority (CVA). All components are fully accessible, responsive, dark mode compatible, and follow the GTG design system tokens.

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
1. **Button** - Primary action component with multiple variants and sizes
2. **Input** - Text input with validation support and responsive sizes
3. **Textarea** - Multi-line text input with auto-resizing
4. **Label** - Accessible label with optional required indicator
5. **Select** - Dropdown select with proper styling
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
1. **Dialog** - General purpose modal dialog
2. **AlertDialog** - Confirmation/alert dialog
3. **Sheet** - Side panel/drawer component (left, right, top, bottom)

### Menu Components (2)
1. **DropdownMenu** - Dropdown menu with trigger and items
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
│   ├── button.tsx
│   ├── input.tsx
│   ├── textarea.tsx
│   ├── label.tsx
│   ├── select.tsx
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
│   ├── dialog.tsx
│   ├── alert-dialog.tsx
│   ├── sheet.tsx
│   ├── dropdown-menu.tsx
│   ├── accordion.tsx
│   ├── tooltip.tsx
│   ├── empty-state.tsx
│   ├── error-state.tsx
│   ├── data-list.tsx
│   └── index.ts (barrel export)
```

## Usage Examples

### Importing Components
```typescript
// Individual imports
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'

// Barrel export
import { Button, Input, Label, Card } from '@/components/ui'
```

### Basic Form
```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function MyForm() {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name" required>Name</Label>
        <Input id="name" placeholder="Enter your name" />
      </div>
      <Button variant="default" size="default">Submit</Button>
    </div>
  )
}
```

### Card Layout
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export function MyCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here</CardDescription>
      </CardHeader>
      <CardContent>Card content</CardContent>
    </Card>
  )
}
```

### Modal
```tsx
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function MyModal() {
  return (
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
  )
}
```

## Component Variants Reference

### Button
- Variants: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`
- Sizes: `xs`, `sm`, `default`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`

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

1. **Always use design tokens** - Don't add inline Tailwind classes outside the design system
2. **Combine variants** - Use multiple variant props for complex styling needs
3. **Accessibility first** - All components include ARIA attributes by default
4. **Responsive design** - Use Tailwind responsive prefixes (md:, lg:, etc.)
5. **Dark mode** - All components work automatically in dark mode
6. **TypeScript** - Leverage full type safety with component props
7. **ForwardRef** - Use refs when direct DOM access is needed

## Production Readiness
✓ Full TypeScript support
✓ Comprehensive accessibility
✓ Complete test coverage ready
✓ Dark mode support
✓ Responsive design
✓ Performance optimized
✓ Tree-shakeable exports
✓ Zero external dependencies (except React)
✓ Tailwind CSS v4 compatible
✓ shadcn/ui patterns compliant
