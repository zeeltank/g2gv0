# Main Dashboard — Implementation Plan

A role-aware **Main Dashboard** that becomes the primary landing page after login and
gives users a complete, cross-module overview of the entire GapstoGrowth (GTG) platform
without drilling into individual modules.

---

## 1. Project Audit Summary

### 1.1 Stack
- **Next.js 16** (App Router) · **React 19** · **TypeScript 5.7**
- **Tailwind CSS v4** + shadcn-style UI primitives (`components/ui/*`)
- **recharts 3** for charts, **lucide-react** for icons, **date-fns** for dates
- Client-side mock auth (`components/auth/gtg-auth.tsx`) with 4 roles

### 1.2 Modules (from `lib/gtg-navigation.ts` — 6 modules / 16 menus / 30 submenus)
| ID | Module | Key areas |
|----|--------|-----------|
| M1 | Organizational Management | Org Profile, Departments, Employee Directory, Roles & Permissions, Compliance, Disciplinary |
| M2 | Competency Management | Command Center, Library, Framework Mapping, Assessments, Employee Profiles, Development/Career, Certifications, Audit |
| M3 | Talent Management | Talent Dashboard, Recruitment, Onboarding, Performance, Compensation, Mobility & Succession, Offboarding, Admin |
| M4 | LMS | Learning (Catalog / My Learning), Training & Records (Assignments, Sessions, Certifications), Administration |
| M5 | HRIT Solutions | Attendance (Tracking, Reports), Leave (Dashboard, Requests, Reports, Config), Payroll |
| M6 | Task Management | Dashboard, My Tasks, Projects, Dependencies, Calendar, Administration |

### 1.3 Roles & routing (`lib/gtg-dashboard-routing.ts`, `types/role.ts`)
- `admin` → `/dashboard/admin`
- `hr` → `/dashboard/hr-operations`
- `dept-head` → `/dashboard/team`
- `employee` → `/dashboard/personal`

**Gap found:** all four role dashboard pages currently render `<GtgAppShell />` with **no
children**, so `GtgAppShell` falls back to `DEFAULT_ACTIVE` (`m1/org-setup/org-profile`).
After login every user lands on **Organization Profile**, not a dashboard. This plan fills
that gap with a real landing dashboard.

### 1.4 Reusable building blocks already in the repo (will be reused, not rebuilt)
- `components/shared/business/`:
  - `KPICard` (label, value, unit, trend{value,direction,label}, icon, description, variant)
  - `MetricCard` (title, primary, secondary[], action)
  - `ChartWidget` (title, description, isLoading, footer, compact — wraps recharts)
  - `ActivityWidget` (activities[], status: completed/pending/failed)
  - `InsightWidget` (insights[] with priority high/medium/low + action)
  - `SectionCard`, `Tabs`
- `components/ui/*`: `Card`, `Button`, `Badge`, `Progress`, `StatusBadge`, `Select`, `Separator`, `Skeleton`, `EmptyState`, `Avatar`, `Tooltip`
- Chart tokens: `lib/chart-colors.ts` (`leaveChartColors`, `attendanceChartColors`, `taskChartColors`, `getChartColor`)
- Shells: `GtgAppShell` (full: sidebar + header + AI agent panel), `GtgPageShell` (lighter, accepts `breadcrumbItems`)
- Design tokens (`app/globals.css`): `--primary` (blue 221 83% 53%), `--success`, `--warning`,
  `--destructive`/`danger`, `--surface`, `--surface-muted`, `--muted-foreground`, `--border`,
  `--sidebar-active`. Charts read `var(--border)`, `var(--card)`, `var(--muted)`.

### 1.5 Existing per-module dashboards (mined for realistic metrics & visual language)
- `leave-management/leave-dashboard/*` (stats, recharts bar/pie, pending approvals, holidays, activity)
- `hrit/attendance-management/*`
- `talent/dashboard/talent-dashboard.tsx` (KPI row, hiring funnel, donut cycles, action items, activity, quick links)
- `lms/dashboard/lms-dashboard.tsx` (KPI row, my learning, deadlines, sessions, progress donut, certifications, calendar)
- `competency/cm-command-center.tsx` (summary metrics, progress rings, work queues, activity, quick actions)
- `task/task-workspace.tsx` + `lib/mock-data/task-management.ts`
- `lib/leave-management-data.ts` (rich typed mock data set)

### 1.6 Data reality
Services in `services/*` call a live `fetch` API client (no backend running). Existing
dashboards use **local typed mock data**. The Main Dashboard will follow the same
established convention: a dedicated, typed mock-data module. No network calls.

---

## 2. Goals & Non-Goals

**Goals**
1. Single landing dashboard summarizing all 6 modules at a glance.
2. Role-aware scope (admin/hr = org-wide, dept-head = team, employee = personal).
3. KPIs, charts, alerts/action-center, recent activity, quick actions, upcoming events.
4. Every card deep-links into the relevant module route (`/module/{m}/{menu}/{submenu}`).
5. Reuse existing widgets, tokens, and shell; match current visual language.
6. Fully responsive, accessible, dark-mode-safe, no hydration mismatches.

**Non-Goals**
- No new backend / API wiring (keep the mock-data convention).
- No changes to module internals or navigation hierarchy.
- No dashboard-customization/drag-drop persistence (can be a later phase).

---

## 3. Architecture & Integration

### 3.1 Rendering approach
Render the dashboard **inside the existing shell** so the sidebar, header, breadcrumb, and
AI agent panel are preserved. `GtgAppShell` already supports a `children` prop and renders
it in place of the module `ContentRenderer`.

Each role page becomes:
```tsx
<ProtectedLayout>
  <GtgAppShell initialActive={DASHBOARD_ACTIVE}>
    <GtgMainDashboard role={user.role} />
  </GtgAppShell>
</ProtectedLayout>
```

### 3.2 "Home" breadcrumb / active state
- Add a synthetic active nav constant `DASHBOARD_ACTIVE = { moduleId: 'home', menuId: 'dashboard', submenuId: 'overview' }`.
- `resolveBreadcrumb` returns `Home` only for unknown module ids (it already tolerates missing modules), so breadcrumb will read **Home › Dashboard** cleanly. Add a tiny guard so the label reads "Dashboard".
- Minor enhancement to `GtgAppShell`: accept an optional `breadcrumbItems` prop (mirroring `GtgPageShell`) so we can pass `[{label:'Home', href:'/'}, {label:'Dashboard'}]`. If we prefer zero shell edits, pass `initialActive={DASHBOARD_ACTIVE}` and let the tolerant `resolveBreadcrumb` render "Home".

### 3.3 File structure (new)
```
components/domain/dashboard/
  index.ts                         # export { GtgMainDashboard }
  gtg-main-dashboard.tsx           # role-aware orchestrator (client)
  components/
    dashboard-header.tsx           # greeting, date, role chip, scope filters, refresh
    executive-kpi-row.tsx          # top cross-module KPI cards
    action-center.tsx              # aggregated pending approvals / alerts (InsightWidget style)
    module-summary-grid.tsx        # one summary card per module (M1..M6)
    module-summary-card.tsx        # reusable per-module card (icon, stats, deep link)
    workforce-chart.tsx            # headcount / attendance composed chart (recharts)
    talent-funnel-chart.tsx        # hiring pipeline funnel
    learning-progress-card.tsx     # LMS + competency progress rings
    task-status-chart.tsx          # task status donut/bar
    recent-activity-feed.tsx       # cross-module activity (ActivityWidget)
    upcoming-events-card.tsx       # holidays, sessions, interviews, deadlines
    quick-actions-card.tsx         # role-based shortcuts
    dashboard-section.tsx          # small titled section wrapper (optional)
lib/mock-data/
  dashboard.ts                     # all aggregated + role-scoped mock data + selectors
types/
  dashboard.ts                     # shared dashboard types
```

### 3.4 Data-selector pattern
`lib/mock-data/dashboard.ts` exposes a single selector:
```ts
export function getDashboardData(role: Role): DashboardData
```
`DashboardData` contains every section's data already scoped for that role, so components
stay pure/presentational. Numbers are internally consistent with existing module dashboards
(e.g., leave pending = 18, talent open positions = 142) to feel coherent.

---

## 4. Role-Based Content Matrix

| Section | admin / hr (org-wide) | dept-head (team) | employee (personal) |
|--------|------------------------|------------------|---------------------|
| Header scope filters | BU / Dept / Location | Dept (fixed) + team | none |
| Executive KPIs | Headcount, Attendance %, Pending Approvals, Open Positions, Compliance %, Overdue Tasks | Team size, Team attendance %, Team pending approvals, Team performance due, Team tasks | Attendance streak, Leave balance, My tasks due, My learning %, My certifications |
| Action Center | All pending approvals (leave, mobility, requisitions, reviews), compliance alerts, expiring certs | Team leave approvals, team review approvals, team overdue tasks | My pending items, my overdue trainings, docs to sign |
| Module summary grid | All 6 modules | Team-relevant (M1 dept, M2, M3, M4, M5, M6) | Personal (M4, M5, M6, M2 profile) |
| Charts | Workforce trend, Attendance, Hiring funnel, Task status, Leave trend | Team attendance, team task status, team leave | My learning progress, my attendance, my task status |
| Recent activity | Org-wide | Team | Personal |
| Upcoming events | Holidays, org sessions, interviews | Team leaves, team sessions | My sessions, my deadlines, holidays |
| Quick actions | Admin/HR shortcuts | Approve/assign/report | Apply leave, check-in, enroll, create task |

Scope is resolved via `getDashboardData(role)`; components never branch on role directly
except the header filters.

---

## 5. Section-by-Section Specification

### 5.1 Dashboard Header (`dashboard-header.tsx`)
- Greeting: "Good morning, {firstName} 👋" + formatted current date (client-only to avoid
  hydration mismatch — compute in `useEffect`/`useMemo` on mount, matching existing patterns).
- Role chip via `roleLabel(role)`; org name from `lib/gtg-org-data.ts`.
- admin/hr: `Select` filters (Business Unit, Department, Location) — presentational, mirror
  `talent-dashboard`/`cm-command-center`.
- Actions: "Refresh" and "Customize" (visual placeholder, matches LMS dashboard).

### 5.2 Executive KPI Row (`executive-kpi-row.tsx`)
Reuse `KPICard`. 6 cards on `grid-cols-2 md:grid-cols-3 xl:grid-cols-6`, each with icon,
value, trend, and click → module route. Example (admin/hr):
1. **Total Headcount** (M1) → employee-directory · trend vs last month
2. **Attendance Today %** (M5) → attendance-tracking
3. **Pending Approvals** (aggregate) → highlighted warning variant
4. **Open Positions** (M3) → recruitment
5. **Compliance Rate %** (M1) → compliance-management
6. **Overdue Tasks** (M6) → my-tasks · danger variant

### 5.3 Action Center / Alerts (`action-center.tsx`)
Aggregates the most urgent cross-module items into one prioritized list (built on
`InsightWidget` semantics or a custom list matching `talent-dashboard`'s "My Action Items").
Each row: icon, label, count badge, due chip, deep link. Sources:
- M5 Leave: pending leave approvals (18)
- M3: pending performance reviews (96), offer/requisition approvals, mobility requests
- M1: compliance items non-compliant / disciplinary open
- M2/M4: expiring certifications (30 days), overdue development plans, overdue mandatory training
- M6: overdue / blocked tasks
Sorted by priority (high→low). Empty state via `EmptyState`.

### 5.4 Module Summary Grid (`module-summary-grid.tsx` + `module-summary-card.tsx`)
One card per module, `grid md:grid-cols-2 xl:grid-cols-3`. Each card: module icon + name,
2–4 headline stats (mini stat rows), a small status/progress indicator, and a "Open module →"
deep link to the module's primary route. Headline stats per module:
- **M1 Organization:** Employees, Departments, Active roles, Compliance %
- **M2 Competency:** Competencies, Frameworks, Assessments in progress, Cert compliance %
- **M3 Talent:** Open positions, Candidates in pipeline, Onboarding in progress, Reviews pending
- **M4 LMS:** Courses assigned, Mandatory overdue, Completion %, Upcoming sessions
- **M5 HRIT:** Present today, On leave today, Pending leave, Payroll status
- **M6 Tasks:** Total tasks, In progress, Overdue, Completed this week

### 5.5 Charts Row (recharts, wrapped in `ChartWidget`)
- **Workforce & Attendance trend** (`workforce-chart.tsx`): ComposedChart — bars for
  present/absent/leave, line for attendance % over last 6–12 months. Colors from
  `attendanceChartColors`.
- **Hiring Funnel** (`talent-funnel-chart.tsx`): funnel bar (Requisition→Screening→
  Interview→Offer→Hired) reusing the talent-dashboard visualization.
- **Task Status** (`task-status-chart.tsx`): donut/pie by status using `taskChartColors`
  (draft, in_progress, review, blocked, completed) derived from `mockTasks` distribution.
- **Learning & Competency progress** (`learning-progress-card.tsx`): progress rings
  (overall completion, cert compliance) matching cm-command-center/LMS donuts.
All charts use `ResponsiveContainer`, `var(--border)`/`var(--card)` styling, and legends.
Employee/dept-head variants show personal/team-scoped versions.

### 5.6 Recent Activity Feed (`recent-activity-feed.tsx`)
Reuse `ActivityWidget`. Cross-module, timestamped, deduplicated feed (leave approved, offer
accepted, course completed, task moved, framework published, resignation submitted…), each
mapped to a status and icon. "View all" links to the relevant audit/activity views.

### 5.7 Upcoming Events (`upcoming-events-card.tsx`)
Merged, date-sorted list: upcoming holidays (`lib/leave-management-data.ts`), LMS sessions,
scheduled interviews, task/training deadlines. Date-chip visual from LMS dashboard. Legend
by type (holiday/session/interview/deadline).

### 5.8 Quick Actions (`quick-actions-card.tsx`)
Role-based shortcut grid (buttons deep-linking into module routes / opening flows):
- employee: Apply Leave, Check-in, Enroll in Course, Create Task, View Payslip
- dept-head: Approve Requests, Assign Task, Team Report, Start Review
- admin/hr: Add Employee, Post a Job, Launch Review Cycle, Run Payroll, Create Framework

---

## 6. Data Model (`types/dashboard.ts`)

```ts
export interface DashboardKpi {
  id: string
  label: string
  value: string | number
  unit?: string
  icon: string                 // lucide name mapped in a small icon registry
  trend?: { value: number; direction: 'up' | 'down'; label?: string }
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  href?: string                // deep link target
}

export interface ActionItem {
  id: string; label: string; count: number
  priority: 'high' | 'medium' | 'low'
  due?: string; icon: string; href: string; module: string
}

export interface ModuleSummary {
  id: 'm1'|'m2'|'m3'|'m4'|'m5'|'m6'
  name: string; icon: string; href: string
  stats: { label: string; value: string | number; tone?: 'default'|'success'|'warning'|'danger' }[]
  progress?: { label: string; percent: number }
}

export interface DashboardActivity { id: string; title: string; description?: string; timestamp: string; status?: 'completed'|'pending'|'failed'; icon?: string }
export interface DashboardEvent { id: string; title: string; date: string; type: 'holiday'|'session'|'interview'|'deadline'; meta?: string }
export interface QuickAction { id: string; label: string; icon: string; href?: string }

export interface ChartSeriesPoint { [key: string]: string | number }

export interface DashboardData {
  kpis: DashboardKpi[]
  actionItems: ActionItem[]
  modules: ModuleSummary[]
  activity: DashboardActivity[]
  events: DashboardEvent[]
  quickActions: QuickAction[]
  charts: {
    workforceTrend: ChartSeriesPoint[]
    hiringFunnel: { stage: string; value: number }[]
    taskStatus: { name: string; value: number; color: string }[]
    learning: { label: string; percent: number; color: string }[]
  }
}
```

A lucide icon registry (`const ICONS: Record<string, LucideIcon>`) maps string keys to
components so data stays serializable and presentational components resolve icons.

---

## 7. Styling, Responsiveness, Accessibility

- **Layout:** top-to-bottom sections inside `max-w-[1600px] mx-auto flex flex-col gap-6`
  (matches leave dashboard). Grids collapse: KPIs `2→3→6`, module grid `1→2→3`,
  charts `1→2`, bottom row `1→3`.
- **Tokens only** — no hard-coded hex except via `lib/chart-colors.ts`. Verify dark mode.
- **Icons** via lucide; consistent `size-4/size-5`.
- **A11y:** section `<h2>` headings, `aria-label`s on interactive cards, buttons are real
  `<button>`/`<a>`, focus-visible rings (already in UI primitives), color never sole signal
  (pair with text/badge).
- **Hydration safety:** compute `new Date()`/greeting after mount (existing `gtg-auth`
  pattern); no `localStorage` in initial render.
- **Perf:** lazy-load heavy chart components with `Suspense` + skeleton fallbacks
  (`ChartWidget isLoading`), mirroring leave-dashboard lazy imports.

---

## 8. Implementation Steps

1. **Types** — add `types/dashboard.ts`.
2. **Mock data** — add `lib/mock-data/dashboard.ts` with `getDashboardData(role)` returning
   consistent org-wide, team, and personal datasets; reuse values from existing module data.
3. **Icon registry + helpers** — small map + `formatDate` reuse from `leave-management-data`.
4. **Leaf components** — build each `components/domain/dashboard/components/*` using existing
   `KPICard`/`ChartWidget`/`ActivityWidget`/`InsightWidget`/`Card` primitives.
5. **Orchestrator** — `gtg-main-dashboard.tsx` composes sections, wires deep-links via
   `useRouter().push('/module/...')`, and passes role-scoped data.
6. **Shell wiring** — update the 4 role pages (`admin`, `hr-operations`, `team`, `personal`)
   to render `<GtgAppShell initialActive={DASHBOARD_ACTIVE}><GtgMainDashboard role=.../></GtgAppShell>`.
   Add `DASHBOARD_ACTIVE` + optional `breadcrumbItems` support (small `GtgAppShell` tweak or
   rely on tolerant `resolveBreadcrumb`).
7. **Breadcrumb label** — ensure "Home › Dashboard" renders correctly.
8. **Index exports** — `components/domain/dashboard/index.ts`.
9. **Polish** — responsive checks, dark mode, empty states, loading skeletons.

---

## 9. Verification

- `npm run lint` clean; `npm run build` compiles (no TS errors).
- Manual: log in as each of the 4 demo users
  (`admin@gtg.local`, `hr@gtg.local`, `depthead@gtg.local`, `employee@gtg.local`, any
  password) → land on the Main Dashboard with correct role scope.
- Confirm: KPIs render, charts draw, action center lists items, every deep link navigates to
  the right `/module/...` route, sidebar/header/agent panel intact.
- Resize to mobile/tablet/desktop; toggle dark mode; hard refresh (no hydration warning,
  no blank page).

---

## 10. Risks & Mitigations
- **Breadcrumb/active-state for a non-module "home":** mitigate with tolerant
  `resolveBreadcrumb` + explicit `breadcrumbItems`.
- **Metric inconsistency vs module pages:** centralize numbers in `getDashboardData` and
  cross-reference existing module mock data.
- **Chart bundle size:** lazy-load chart components with skeleton fallbacks.
- **Scope creep (customization/persistence):** explicitly deferred to a later phase.
