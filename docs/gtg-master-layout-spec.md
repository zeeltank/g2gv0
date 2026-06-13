# GTG Master Application Layout Specification

> Scope: the **master application layout (AppShell)** only. No module screens,
> dashboards, forms, workflows, or pages.
> Source of truth: `globals.css`, GTG Component Library, Architecture Reference,
> Permission Flowchart, Cross-Role Flow, GTG Design System Documentation.
> All values reference existing GTG tokens — **no new colors, typography,
> spacing, radius, shadows, components, or layouts**.

Viewport target: **Desktop 1440px width**.
Brand context selector: `[data-brand="gaps-to-growth"]`.

---

## 1. Layout Structure

```
AppShell  (role="application", html/body fixed, overflow:hidden)
├── Sidebar            (fixed, left, full height)
├── Header             (fixed, top, banner landmark)
│   └── Breadcrumb     (row below header bar, derived from navigation)
└── Main Content Container
    ├── PageHeader     (title + subtitle + primary action area)
    └── Page Scroll Region  (.g2g-page-scroll — the only scrolling surface)
```

Composition order (per Layout Rules §7): `AppShell → Sidebar + Header → ContentContainer → PageHeader → page content`.

---

## 2. Shell Geometry (1440px)

| Region | Property | Value (GTG token) |
|---|---|---|
| Sidebar (expanded) | width | `260px` |
| Sidebar (collapsed) | width | `72px` |
| Header | height | `64px` (fixed) |
| Breadcrumb bar | height | `44px` |
| Content offset (left) | = sidebar width | `260px` / `72px` |
| Content offset (top) | = header + breadcrumb | `108px` |
| ContentContainer | max-width | `1200px`, centered, fluid fallback |
| Page padding | inline / block | `--space-6` (24px) / `--space-8` (32px) |

**Fixed-shell rule:** `html, body { height:100%; overflow:hidden }`. Only
`.g2g-page-scroll` scrolls; Sidebar and Header never scroll with content.

**Z-index:** Sidebar/Header `sticky 40`; dropdowns/overlays `50`; toast `100`.

---

## 3. Sidebar

Component: **Sidebar** (Component Library §Navigation). Renders the exact
hierarchy from the Architecture Reference: **5 Modules → 16 Menus → 30 Submenus → 52 Pages.**

### 3.1 Behaviour
- **Fixed position**, left, full viewport height.
- **Expanded state** (260px): icon + label + chevron for expandable groups.
- **Collapsed state** (72px): icon only; labels surface in tooltip on hover.
- **Nested navigation:** Module (L1) → Menu (L2) → Submenu (L3); only one
  branch expanded at a time (accordion behaviour).
- **Active state:** active item uses the **navy → orange gradient**
  (`--brand` `232 56% 34%` → `--brand-accent`/`--primary` `23 100% 50%`),
  `--brand-foreground` text, `aria-current="page"`.
- **Hover:** `--secondary` surface, `--secondary-foreground` (navy) text.
- No-access items are **hidden**, not disabled (Permission Flowchart).

### 3.2 Navigation source (Architecture Reference)
```
M1 Organizational Management
  Organization Setup        → Organization Profile · Department Management
  User Management           → Employee Directory · Role & Responsibility
  Task Management           → Task Assignment · Task Tracking
  Compliance & Discipline   → Compliance Management · Disciplinary Management
M2 Competency Management
  Competency Library        → Taxonomy & Library
  Job Role Library          → Job Role Catalogue
  Competency Rating         → Employee Rating
M3 Talent Management
  Talent Acquisition        → Recruitment Dashboard · Job Postings · Interview Management · Manager Hub
  Performance Management    → Performance Reviews · Appraisals & Succession
  HR Template Engine        → Document Templates
M4 LMS
  Content Library           → Learning Dashboard · Course Catalogue
  Assessment Library        → Assessment Centre
M5 HRIT Solutions
  Attendance Management     → Attendance Tracking · Attendance Reports
  Leave Management          → Leave Operations
  Payroll Management        → Payroll Processing
```

### 3.3 Tokens
- Item padding `--space-3` (12px); group gap `--space-2` (8px).
- Item radius `--radius-md` (8px).
- Brand mark (top) uses navy→orange gradient.
- Active/hover transitions: `normal 240ms`, ease `cubic-bezier(0.22,1,0.36,1)`.

### 3.4 Accessibility
- `nav` landmark, `aria-label="Primary"`.
- Keyboard arrow navigation between items; `Enter`/`Space` toggles groups.
- `aria-expanded` on expandable Menu rows; `aria-current="page"` on active.

---

## 4. Header

Component: **Header** (Component Library §Layout). **Fixed position**, top,
`banner` landmark, height `64px`.

### 4.1 Regions (left → right)
1. **Sidebar collapse toggle** — IconButton; toggles expanded/collapsed.
2. **Global Search** — SearchInput; input type 15px; `--input` border;
   focus `--ring` (orange). Placeholder "Search…".
3. **Notifications** — IconButton with Badge (`--primary` count dot);
   opens DropdownMenu (`dropdown 50`).
4. **User Profile Menu** — Avatar + DropdownMenu (profile, settings, sign-out).
   Sign-out uses navy→orange gradient treatment.

### 4.2 Tokens
- Horizontal padding `--space-6` (24px).
- Surface `--surface` / `--card`; bottom divider `--border`.
- Shadow `--shadow-sm` when content scrolls beneath.

### 4.3 Accessibility
- `banner` landmark.
- Search labelled (`aria-label="Global search"`).
- Notifications + User menu buttons expose `aria-expanded` / `aria-haspopup`.

---

## 5. Breadcrumb

Component: **Breadcrumb** (Component Library §Navigation). Located **below the
header bar**, height `44px`, derived from the active navigation path.

- Pattern: `Module / Menu / Submenu / Page`.
- Type: breadcrumb 14px, weight 500; separators `--muted-foreground`.
- Current page is non-interactive, `aria-current="page"`.
- Accessibility: `nav` with `aria-label="Breadcrumb"`; ordered list markup.

---

## 6. Page Header

Component: **PageHeader** (Component Library §Layout). Top of the content scroll
region, bottom margin `--space-6` (24px).

| Slot | Content | Token |
|---|---|---|
| Page Title | `h1`, page title 36px / weight 700, `text-balance` | `--foreground` |
| Subtitle Area | description 16px / weight 400 | `--muted-foreground` |
| Primary Action Area | right-aligned Button(s); primary = orange `--primary` | `--primary` / `--primary-foreground` |

- Layout: flex row, `justify-between`, `items-start`; wraps to column under `md`.
- Optional WorkflowStepper variant supported (no workflow content rendered here).
- Accessibility: single `h1` per page; actions keyboard-reachable.

---

## 7. Main Content Container

Component: **ContentContainer** (Component Library §Layout).

- **Scrollable content area:** `.g2g-page-scroll` styled with `.g2g-scrollbar`;
  the only scrolling surface in the shell.
- **Max-width:** `1200px`, centered; fluid variant available.
- **Responsive grid** (Grid Rules §8): `grid-cols-1` → `md:grid-cols-2` →
  `lg:grid-cols-4` for KPI/metric rows; `gap-*` only (never margins between cells).
- **Spacing:** vertical rhythm `--space-6` / `--space-8`; inline padding `--space-6`.
- **Landmark:** wraps `main`; preserves focus order; skip-to-content target.

---

## 8. Responsive Behaviour (from GTG Design System §9)

- Mobile-first; enhance upward. Breakpoints `xs 30rem`, default Tailwind, `3xl 120rem`.
- **< lg:** Sidebar collapses to icon rail (72px) or off-canvas; Header stays sticky.
- **md → lg:** content grid steps from 1 → 2 → 4 columns.
- Titles use `text-balance` / `text-pretty`.
- Transitions use motion tokens (`fast 150ms`, `normal 240ms`, `slow 350ms`).

---

## 9. Token Compliance

| Requirement | Token used |
|---|---|
| GTG Navy | `--brand` `232 56% 34%` (sidebar active, breadcrumb, brand mark) |
| GTG Orange | `--primary` / `--brand-accent` `23 100% 50%` (primary action, focus ring, active gradient) |
| Surfaces | `--background`, `--surface`, `--card` |
| Text | `--foreground`, `--muted-foreground` |
| Lines | `--border`, `--input` |
| Focus | `--ring` (orange) |
| Radius | `--radius-md` default |
| Shadow | `--shadow-sm` (header), navy-tinted |
| Spacing | `--space-2 / -3 / -6 / -8` |
| Typography | `--font-sans` (Inter); page-title 36/700, breadcrumb 14/500 |

No non-GTG colors, type, spacing, radius, shadows, components, or layouts are introduced.

---

## 10. Validation Checklist

| Check | Result |
|---|---|
| Sidebar present | PASS |
| Header present | PASS |
| Breadcrumb present | PASS |
| Page Header present | PASS |
| Main Content Container present | PASS |
| GTG Navy token used | PASS (`--brand`) |
| GTG Orange token used | PASS (`--primary` / `--brand-accent`) |
| Only GTG colors used | PASS |
| Fixed Header | PASS |
| Fixed Sidebar | PASS |
| Scrollable Content Area | PASS (`.g2g-page-scroll`) |
| No module screens / dashboards / forms / workflows / pages | PASS |
