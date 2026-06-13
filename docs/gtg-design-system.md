# GapstoGrowth (GTG) — Design System Documentation

> Source of truth: extracted from `globals.css`, the GTG Component Library, the
> Architecture Reference, the Permission Flowchart, and the Cross-Role Flow.
> This document **preserves the existing GTG design language**. No redesign, no
> new colors, no new typography, no new spacing, no new components.

Brand context selector: `[data-brand="gaps-to-growth"]`
Brand signature: Navy (`#1f2a6d → #2e3a8c`) → Orange (`#ff6a00`) gradient.

---

## 1. Color Tokens

All colors are stored as HSL channel triplets in CSS variables and consumed via
`hsl(var(--token))`. Values below are Light / Dark.

### 1.1 Core surfaces & text
| Token | Light | Dark | Role |
|---|---|---|---|
| `--background` | `216 43% 97%` | `224 39% 10%` | App canvas |
| `--foreground` | `221 39% 11%` | `210 40% 98%` | Primary text |
| `--card` | `0 0% 100%` | `224 32% 14%` | Card surface |
| `--card-foreground` | `221 39% 11%` | `210 40% 98%` | Card text |
| `--popover` | `0 0% 100%` | `224 32% 14%` | Overlay surface |
| `--popover-foreground` | `221 39% 11%` | `210 40% 98%` | Overlay text |
| `--surface` | `0 0% 100%` | `224 32% 14%` | Panels |
| `--surface-muted` | `216 43% 98%` | `225 24% 18%` | Subtle panels |

### 1.2 Action & intent
| Token | Light | Dark | Role |
|---|---|---|---|
| `--primary` | `23 100% 50%` | `23 100% 57%` | Primary action (orange) |
| `--primary-foreground` | `0 0% 100%` | `0 0% 100%` | On primary |
| `--secondary` | `214 47% 97%` | `225 29% 20%` | Secondary surface |
| `--secondary-foreground` | `232 56% 34%` | `210 40% 98%` | On secondary (navy) |
| `--accent` | `26 100% 96%` | `24 45% 20%` | Soft highlight |
| `--accent-foreground` | `25 100% 50%` | `210 40% 98%` | On accent |
| `--muted` | `216 43% 98%` | `225 24% 18%` | De-emphasized surface |
| `--muted-foreground` | `215 16% 47%` | `215 20% 70%` | De-emphasized text |

### 1.3 Status
| Token | Light | Dark | Role |
|---|---|---|---|
| `--success` | `143 65% 30%` | `143 55% 42%` | Positive |
| `--success-foreground` | `146 71% 29%` | — | On success |
| `--warning` | `28 100% 38%` | `28 100% 58%` | Caution |
| `--warning-foreground` | `0 0% 100%` | — | On warning |
| `--danger` / `--destructive` | `0 72% 42%` | `0 72% 55%` | Negative (`destructive` aliases `danger`) |
| `--destructive-foreground` | `0 0% 100%` | — | On danger |

### 1.4 Lines & focus
| Token | Light | Dark | Role |
|---|---|---|---|
| `--border` | `219 39% 91%` | `225 22% 25%` | Dividers / outlines |
| `--input` | `222 33% 88%` | `225 22% 25%` | Field borders |
| `--ring` | `23 100% 50%` | `23 100% 57%` | Focus ring (orange) |

### 1.5 Brand
| Token | Value | Role |
|---|---|---|
| `--brand` | `232 56% 34%` | Brand navy |
| `--brand-foreground` | `0 0% 100%` | On brand |
| `--brand-accent` | `23 100% 50%` | Brand orange |

**Rules**
- Never use raw `text-white` / `bg-black`; always consume tokens.
- If a background token is overridden, its paired `*-foreground` must also be set.
- `destructive` and `danger` are the same value — do not introduce a third negative color.

---

## 2. Typography Tokens

Single family system.

- `--font-sans: 'Inter', sans-serif`

### 2.1 Type scale
| Token / role | Size | Typical weight |
|---|---|---|
| Helper text | 12px | 400 |
| Label / Tab / Button / Breadcrumb | 14px | 500 |
| Input | 15px | 400 |
| Description | 16px | 400 |
| Card title | 20px | 600 |
| Section title | 24px | 600 |
| Page title | 36px | 700 |

### 2.2 Weights
`400` regular · `500` medium · `600` semibold · `700` bold.

### 2.3 Rules
- Body line-height 1.4–1.6 (`leading-relaxed`).
- No font below 14px for body content (12px reserved for helper text only).
- One family only — no secondary typeface.

---

## 3. Spacing Scale

4px base; consume via Tailwind spacing utilities and `gap-*` (never `space-*`,
never mixed margin/padding + gap on one element).

| Token | rem | px |
|---|---|---|
| `--space-0` | 0 | 0 |
| `--space-1` | 0.25 | 4 |
| `--space-2` | 0.5 | 8 |
| `--space-3` | 0.75 | 12 |
| `--space-4` | 1 | 16 |
| `--space-5` | 1.25 | 20 |
| `--space-6` | 1.5 | 24 |
| `--space-7` | 1.75 | 28 |
| `--space-8` | 2 | 32 |
| `--space-9` | 2.25 | 36 |
| `--space-10` | 2.5 | 40 |
| `--space-11` | 2.75 | 44 |
| `--space-12` | 3 | 48 |

---

## 4. Radius Scale

| Token | px | Notes |
|---|---|---|
| `--radius-xs` | 2 | Tags / chips |
| `--radius-sm` | 4 | Inputs, small controls |
| `--radius-md` | 8 | **Default** (cards, buttons) |
| `--radius-lg` | 12 | Large cards |
| `--radius-xl` | 14 | Panels |
| `--radius-2xl` | 16 | Modals |
| `--radius-3xl` | 20 | Hero / feature surfaces |

Bespoke glass components may use 21–32px; treat as exceptions, not new tokens.

---

## 5. Shadow Scale

Tinted with navy `31 42 109`.

| Token | Value |
|---|---|
| `--shadow-xs` | `0 1px 2px rgba(31,42,109,.05)` |
| `--shadow-sm` | `0 4px 12px rgba(31,42,109,.06)` |
| `--shadow-md` | `0 10px 28px rgba(31,42,109,.1)` |
| `--shadow-lg` | `0 18px 48px rgba(31,42,109,.14)` |
| `--shadow-xl` | `0 24px 70px rgba(31,42,109,.18)` |

---

## 6. Border Rules

- Global default: `* { border-color: hsl(var(--border)) }`.
- Form fields use `--input` for their border.
- Focus uses `--ring` (orange) — visible on all interactive elements.
- Decorative glass surfaces use translucent white borders
  (`rgba(255,255,255,0.14–0.68)`); not for standard content surfaces.

---

## 7. Layout Rules

- Fixed app shell: `html, body { height:100%; overflow:hidden }`.
- Scrolling happens inside dedicated regions (`.g2g-page-scroll`,
  styled with `.g2g-scrollbar`) — never the document.
- Composition order: AppShell → Sidebar + Header → ContentContainer → PageHeader → page content.
- Flexbox is the default layout method; CSS Grid only for true 2D layouts.
- Z-index scale: `dropdown 50`, `sticky 40`, `overlay 50`, `toast 100`.
- Motion: `fast 150ms`, `normal 240ms`, `slow 350ms`; ease `cubic-bezier(0.22,1,0.36,1)`.

---

## 8. Grid Rules

- Use `ContentContainer` as the max-width wrapper for page content.
- KPI/metric rows: responsive grid (`grid-cols-1` → `md:grid-cols-2` → `lg:grid-cols-4`).
- Use `gap-*` utilities for grid/flex spacing — never margins between grid items.
- `EnterpriseDataTable` owns its own column layout; do not wrap it in a manual grid.

---

## 9. Responsive Rules

- Mobile-first: base styles target small screens, enhance upward.
- Breakpoints: `xs 30rem`, default Tailwind (`sm`–`2xl`), plus `3xl 120rem`.
- Sidebar collapses on small screens; Header remains sticky.
- Use responsive prefixes for columns and type (`md:grid-cols-2`, `lg:text-xl`).
- Titles use `text-balance` / `text-pretty` for line breaking.

---

## 10. Component Documentation

Each component lists **Usage · Variants · States · Spacing Rules · Accessibility**.
✅ marks reusable building blocks.

### 10.1 Layout

#### AppShell (`DashboardShell.tsx`) ✅
- **Usage:** Root wrapper for every authenticated page; hosts Sidebar + Header + content.
- **Variants:** Default; collapsed-sidebar (responsive).
- **States:** Sidebar expanded / collapsed; loading (renders GapsToGrowthLoader).
- **Spacing:** Content offset by sidebar width; inner padding via ContentContainer.
- **Accessibility:** `role="application"` shell; skip-to-content link; landmark `main`.

#### Sidebar ✅
- **Usage:** Hierarchical module → menu → submenu navigation.
- **Variants:** Expanded / collapsed; active item uses navy→orange gradient.
- **States:** Default, hover, active, focus, disabled (no-access items hidden).
- **Spacing:** Item padding `--space-3`; group gap `--space-2`.
- **Accessibility:** `nav` landmark, `aria-current="page"`, keyboard arrow navigation.

#### Header ✅
- **Usage:** Top bar with breadcrumbs, search, user menu.
- **Variants:** Default; with/without page actions.
- **States:** Sticky on scroll; dropdown open.
- **Spacing:** Horizontal padding `--space-6`; height fixed.
- **Accessibility:** `banner` landmark; menu buttons expose `aria-expanded`.

#### ContentContainer ✅
- **Usage:** Max-width centered wrapper for page content.
- **Variants:** Default; fluid.
- **States:** Scroll region (`.g2g-page-scroll`).
- **Spacing:** Vertical rhythm `--space-6`/`--space-8`.
- **Accessibility:** Wraps `main`; preserves focus order.

#### PageHeader ✅
- **Usage:** Page title + breadcrumbs + primary actions.
- **Variants:** Title only; title + actions; with WorkflowStepper.
- **States:** Static.
- **Spacing:** Bottom margin `--space-6`.
- **Accessibility:** `h1` for page title; breadcrumb `nav` with `aria-label="Breadcrumb"`.

### 10.2 Navigation

#### Tabs ✅
- **Usage:** Switch views within a page.
- **Variants:** Underline; pill.
- **States:** Default, active, hover, focus, disabled.
- **Spacing:** Tab label 14px; gap `--space-4`.
- **Accessibility:** `role="tablist"`/`tab`/`tabpanel`; arrow-key navigation.

#### WorkflowStepper ✅
- **Usage:** Multi-step processes (onboarding, recruitment, appraisal).
- **Variants:** Horizontal; vertical.
- **States:** Completed, current, upcoming, error.
- **Spacing:** Step gap `--space-4`.
- **Accessibility:** Ordered list; `aria-current="step"`.

#### Breadcrumb
- **Usage:** Show location in navigation tree.
- **Variants:** Default.
- **States:** Default, hover (links), current (non-link).
- **Spacing:** Separator margin `--space-2`; 14px text.
- **Accessibility:** `nav aria-label="Breadcrumb"`; last item `aria-current="page"`.

#### DropdownMenu
- **Usage:** Contextual actions / overflow menus.
- **Variants:** Default; with icons; destructive items.
- **States:** Open, closed, item hover/focus, disabled.
- **Spacing:** Item padding `--space-2`/`--space-3`.
- **Accessibility:** `menu`/`menuitem`; Esc closes; focus trap.

### 10.3 Cards

#### MetricCard ✅ / KPICard ✅
- **Usage:** Single metric / KPI with trend.
- **Variants:** Default; with delta (up/down); with sparkline.
- **States:** Default, loading (skeleton), empty.
- **Spacing:** Card padding `--space-6`; radius `md`/`lg`.
- **Accessibility:** Value as text; trend conveyed by label + icon, not color alone.

#### SectionCard ✅
- **Usage:** Group related content under a titled surface.
- **Variants:** Default; with header actions.
- **States:** Default, collapsed (if accordion-backed).
- **Spacing:** Header `--space-4`, body `--space-6`.
- **Accessibility:** Title as heading; region labelled by title.

#### WidgetContainer / KPIWidget / ChartWidget / ActivityWidget / InsightWidget ✅
- **Usage:** Dashboard tiles.
- **Variants:** KPI, Chart, Activity, Insight.
- **States:** Loading, loaded, empty, error.
- **Spacing:** Grid gap `--space-4`/`--space-6`; padding `--space-6`.
- **Accessibility:** Each widget titled; charts paired with accessible summaries.

### 10.4 Tables

#### EnterpriseDataTable
- **Usage:** Large datasets with search, sort, filter, pagination.
- **Variants:** Default; selectable rows; with row actions.
- **States:** Loading, empty, error, filtered, sorted, paginated.
- **Spacing:** Cell padding `--space-3`; row height consistent.
- **Accessibility:** Semantic `table`; `aria-sort` on headers; pagination announced.

#### Table primitives (header / body / footer)
- **Usage:** Compose bespoke tables.
- **Variants:** Default.
- **States:** Hover row, selected row.
- **Spacing:** Cell padding `--space-3`.
- **Accessibility:** `th scope`; caption when standalone.

### 10.5 Forms

#### Input / Textarea / Select / SearchInput
- **Usage:** Text, multiline, choice, and search entry.
- **Variants:** Default; with icon (SearchInput); sizes per scale.
- **States:** Default, focus, filled, disabled, error, read-only.
- **Spacing:** 15px text; padding `--space-3`; field gap `--space-4`.
- **Accessibility:** Associated `label`; `aria-invalid` + error text on error; focus ring `--ring`.

#### FileUpload
- **Usage:** Document/attachment upload (e.g., Document Upload page).
- **Variants:** Drop zone; button trigger.
- **States:** Idle, drag-over, uploading, success, error.
- **Spacing:** Drop zone padding `--space-6`.
- **Accessibility:** Keyboard-triggerable; status messages via live region.

#### FormField / FormSection / FormActions
- **Usage:** Field wrapper (label + control + help/error); grouping; action row.
- **Variants:** Required / optional; horizontal / stacked.
- **States:** Default, error.
- **Spacing:** Field gap `--space-4`; section gap `--space-6`; actions justified end.
- **Accessibility:** Label-for binding; `aria-describedby` for help/error.

#### Checkbox / RadioGroup / Switch / Label
- **Usage:** Boolean and single-choice controls.
- **Variants:** Default; inline / stacked groups.
- **States:** Unchecked, checked, indeterminate (checkbox), focus, disabled.
- **Spacing:** Control-to-label gap `--space-2`.
- **Accessibility:** Native semantics; RadioGroup `role="radiogroup"`; Switch `role="switch"` + `aria-checked`.

### 10.6 Dialogs / Modals

#### Dialog ✅
- **Usage:** Focused create/edit tasks in an overlay.
- **Variants:** Default; sizes.
- **States:** Open, closing, loading content.
- **Spacing:** Padding `--space-6`; radius `2xl`.
- **Accessibility:** `role="dialog"`, `aria-modal`, focus trap, Esc to close, labelled title.

#### AlertDialog ✅
- **Usage:** Destructive / irreversible confirmations.
- **Variants:** Default; destructive (uses `danger`).
- **States:** Open, pending.
- **Spacing:** Padding `--space-6`.
- **Accessibility:** `role="alertdialog"`; focus on safest action by default.

### 10.7 Drawers

#### Sheet ✅
- **Usage:** Slide-over panels (details, filters, secondary forms).
- **Variants:** Right / left / bottom.
- **States:** Open, closed.
- **Spacing:** Padding `--space-6`.
- **Accessibility:** Dialog semantics; focus trap; Esc to close; restores focus on close.

### 10.8 Filters / Search

#### FilterBar
- **Usage:** Combine filters above tables/lists.
- **Variants:** Inline; collapsible.
- **States:** Default, active filters, cleared.
- **Spacing:** Control gap `--space-3`.
- **Accessibility:** Each control labelled; active filters announced.

#### SearchInput
- **Usage:** Free-text search (see Forms for base states).
- **Variants:** With leading icon; with clear button.
- **States:** Default, focus, has-value, loading.
- **Spacing:** Icon inset `--space-3`.
- **Accessibility:** `type="search"`; results count in live region.

### 10.9 Feedback

#### Alert
- **Usage:** Inline contextual messages.
- **Variants:** Default, Success, Warning, Destructive.
- **States:** Static; dismissible.
- **Spacing:** Padding `--space-4`; icon gap `--space-3`.
- **Accessibility:** `role="status"` (info/success) or `role="alert"` (warning/error); not color-only.

#### Toast
- **Usage:** Transient notifications.
- **Variants:** Default, Success, Warning, Destructive.
- **States:** Enter, visible, exit, queued.
- **Spacing:** Padding `--space-4`; stack gap `--space-2`; z-index `toast 100`.
- **Accessibility:** Live region; auto-dismiss with pause-on-hover; dismiss control.

#### EmptyState / ErrorState
- **Usage:** No-data and failure placeholders.
- **Variants:** With/without action.
- **States:** Static.
- **Spacing:** Centered, padding `--space-8`.
- **Accessibility:** Heading + descriptive text; action is a real button/link.

#### Skeleton / Spinner / GapsToGrowthLoader
- **Usage:** Loading placeholders and indicators.
- **Variants:** Skeleton (block/line); Spinner; Loader (fullscreen / inline).
- **States:** Animating.
- **Spacing:** Match replaced content footprint.
- **Accessibility:** `aria-busy` on region; loader has `aria-label`; `prefers-reduced-motion` respected.

### 10.10 Charts

#### DepartmentChart (Bar) / RevenueChart (Area) / ChartWidget
- **Usage:** Analytics visualization on dashboards.
- **Variants:** Bar; Area; widget-wrapped.
- **States:** Loading, loaded, empty.
- **Spacing:** Container padding `--space-6`; consistent axis margins.
- **Accessibility:** Title + text/table summary alternative; series distinguishable beyond color.

### 10.11 Primitives

#### Button
- **Usage:** Trigger actions.
- **Variants:** Default (primary orange), Secondary (navy), Outline, Ghost, Link.
- **States:** Default, hover, active, focus, disabled, loading.
- **Spacing:** 14px label; padding `--space-3`/`--space-4`; radius `md`.
- **Accessibility:** Native `button`; focus ring `--ring`; loading sets `aria-busy`/disabled.

#### Badge / StatusBadge
- **Usage:** Labels and status indicators.
- **Variants:** Success, Warning, Navy, Outline; StatusBadge maps to status tokens.
- **States:** Static.
- **Spacing:** Padding `--space-1`/`--space-2`; radius `xs`/`sm`.
- **Accessibility:** Status conveyed by text, not color alone.

#### Progress
- **Usage:** Completion / determinate progress.
- **Variants:** Linear.
- **States:** Determinate, indeterminate.
- **Spacing:** Track height consistent; full-width by default.
- **Accessibility:** `role="progressbar"` with `aria-valuenow/min/max`.

#### Separator
- **Usage:** Divide content groups.
- **Variants:** Horizontal, vertical.
- **States:** Static.
- **Spacing:** Margin `--space-4` around.
- **Accessibility:** `role="separator"` (decorative `aria-hidden`).

#### Accordion
- **Usage:** Collapsible sections.
- **Variants:** Single; multiple.
- **States:** Expanded, collapsed, focus, disabled.
- **Spacing:** Header padding `--space-4`.
- **Accessibility:** Header `button` with `aria-expanded`; `aria-controls` to panel.

#### Tooltip
- **Usage:** Supplemental hints.
- **Variants:** Default.
- **States:** Hidden, visible (hover/focus).
- **Spacing:** Padding `--space-2`; offset `--space-2`.
- **Accessibility:** `role="tooltip"`; keyboard-focus triggerable; `aria-describedby`.

#### IconButton
- **Usage:** Compact icon-only actions.
- **Variants:** Ghost, Outline, Solid.
- **States:** Default, hover, focus, disabled.
- **Spacing:** Square hit area ≥ 40px.
- **Accessibility:** Required `aria-label`; visible focus ring.

#### DataList
- **Usage:** Key–value detail display.
- **Variants:** Stacked; inline.
- **States:** Static, loading.
- **Spacing:** Row gap `--space-2`; pair gap `--space-3`.
- **Accessibility:** `dl`/`dt`/`dd` semantics.

#### Avatar
- **Usage:** Represent users.
- **Variants:** Image; initials fallback; sizes.
- **States:** Loaded, fallback.
- **Spacing:** Circular; radius full.
- **Accessibility:** `alt` with user name; decorative grouping `aria-hidden` where redundant.

---

## 11. Usage Matrix (quick reference)

| Need | Component |
|---|---|
| Page layout | AppShell |
| KPI display | KPICard |
| Section grouping | SectionCard |
| Dashboard tile | WidgetContainer |
| Form field | FormField + Input |
| Multi-step process | WorkflowStepper |
| Data grid | EnterpriseDataTable |
| Confirmation | AlertDialog |
| Slide-over | Sheet |
| Notification | Toast |
| Status indicator | StatusBadge |
| Empty data | EmptyState |
| Analytics | ChartWidget |
| Loading | GapsToGrowthLoader |

---

*End of documentation. No screens generated.*
