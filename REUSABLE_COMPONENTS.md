# Reusable Components Library

A comprehensive collection of production-ready, enterprise-grade reusable components built on top of the GTG Design System primitive components.

## Organization

### Business Components (`/components/business`)
Enterprise-focused widgets for dashboards and analytics:

- **KPICard** - Key performance indicator display with trends
  - Variants: default, primary, success, warning, danger
  - Sizes: sm, md, lg
  - Shows value, unit, trend direction, and custom icon

- **MetricCard** - Primary and secondary metrics display
  - Layouts: vertical, horizontal
  - Primary metric + optional secondary metrics grid
  - Custom action support

- **ActivityWidget** - Activity feed display
  - Status badges: completed, pending, failed
  - Clickable items with icons and timestamps
  - Configurable max items display

- **InsightWidget** - Insights and alerts display
  - Priority levels: high, medium, low
  - Category and action support
  - Hover states and visual hierarchy

- **ChartWidget** - Chart container with loading states
  - Loading skeleton support
  - Optional footer content
  - Compact variant for space efficiency

### Workflow Components (`/components/workflow`)
Process and workflow visualization:

- **WorkflowStepper** - Multi-step workflow visualization
  - Orientations: horizontal, vertical
  - Sizes: sm, md, lg
  - Statuses: completed, current, upcoming
  - Status colors and icons
  - Gradient connectors between steps
  - Clickable steps with descriptions

### Data Components (`/components/data`)
Advanced data display and interaction:

- **EnterpriseDataTable** - Full-featured data table
  - Densities: compact, normal, comfortable
  - Striped rows option
  - Row selection with checkboxes
  - Column sorting support
  - Pagination controls
  - Custom cell rendering
  - Empty and loading states

- **FilterBar** - Advanced filtering interface
  - Filter types: search, select, date, multiselect
  - Active filter badges
  - Apply and reset actions
  - Disabled state support

- **DataList** - Key-value data display grid
  - Columns: 1-4
  - Compact mode for dense layouts
  - Responsive grid layout

## Component Standards

### All Components Include:
- ✓ Full TypeScript support with strict typing
- ✓ CVA-based variant architecture
- ✓ React.forwardRef for DOM ref access
- ✓ Tailwind v4 with design token colors only
- ✓ Accessibility (ARIA, semantic HTML)
- ✓ Dark mode support via CSS custom properties
- ✓ Responsive design (mobile-first)
- ✓ Production-ready code

### Design Tokens Used:
- Colors: background, foreground, card, primary, secondary, success, warning, danger, muted, border
- Spacing: Tailwind spacing scale (px, 0.5, 1, 2, 3, 4, 6, 8, etc.)
- Shadows: shadow-xs, shadow-sm, shadow-md, shadow-lg, shadow-xl
- Radius: rounded (default), rounded-sm, rounded-md, rounded-lg
- Typography: text-xs, text-sm, text-base, font-medium, font-semibold, font-bold

## Usage Examples

### KPICard
```tsx
<KPICard
  label="Total Revenue"
  value="$42,500"
  unit="USD"
  trend={{ value: 12, direction: 'up', label: 'vs last month' }}
  icon={<TrendingUpIcon />}
  description="Strong growth trend"
/>
```

### WorkflowStepper
```tsx
<WorkflowStepper
  orientation="horizontal"
  size="md"
  steps={[
    { id: '1', label: 'Information', status: 'completed' },
    { id: '2', label: 'Verification', status: 'current' },
    { id: '3', label: 'Confirmation', status: 'upcoming' },
  ]}
/>
```

### EnterpriseDataTable
```tsx
<EnterpriseDataTable
  columns={[
    { id: 'name', header: 'Name' },
    { id: 'email', header: 'Email' },
    { id: 'status', header: 'Status', render: (val) => <StatusBadge status={val} /> },
  ]}
  data={users}
  selectable
  striped
  density="normal"
/>
```

## Folder Structure

```
components/
├── ui/                           (Primitives - existing)
├── business/                      (Business components)
│   ├── kpi-card.tsx
│   ├── metric-card.tsx
│   ├── activity-widget.tsx
│   ├── insight-widget.tsx
│   ├── chart-widget.tsx
│   └── index.ts
├── workflow/                      (Workflow components)
│   ├── workflow-stepper.tsx
│   └── index.ts
└── data/                          (Data components)
    ├── enterprise-data-table.tsx
    ├── filter-bar.tsx
    ├── data-list.tsx
    └── index.ts
```

## Import Pattern

```tsx
// Business components
import { KPICard, MetricCard } from '@/components/business'

// Workflow components
import { WorkflowStepper } from '@/components/workflow'

// Data components
import { EnterpriseDataTable, FilterBar } from '@/components/data'
```

## Accessibility

All components follow WAI-ARIA guidelines:
- Semantic HTML elements
- Proper ARIA roles and attributes
- Keyboard navigation support
- Focus management
- Color contrast compliance

## Theming

All components use CSS custom properties from `globals.css`:
- Light mode: Automatically applied
- Dark mode: Enabled via `.dark` class on parent
- No hardcoded colors - only design tokens
- Supports any color scheme swap

## Performance

- Zero external chart/table libraries (UI-agnostic)
- Memoized components where appropriate
- Efficient re-render patterns
- Lazy loading support for tables
- Minimal bundle impact

---

**Version**: 1.0.0  
**Last Updated**: 2025-06-13  
**Status**: Production Ready
