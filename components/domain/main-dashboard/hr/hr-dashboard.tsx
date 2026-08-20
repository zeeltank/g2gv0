'use client'

import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  FileText,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Funnel,
  FunnelChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { KPICard } from '@/components/shared/business'
import { chartStatusColors } from '@/lib/chart-colors'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/gtg-auth'
import { getGreeting } from '@/lib/greeting'
import { useHrDashboard } from '@/hooks/use-hr-dashboard'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { cn } from '@/lib/utils'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'

const token = (name: string) => `var(${name})`

const dashboardChartColors = {
  blue: chartStatusColors.primary,
  red: chartStatusColors.danger,
  yellow: chartStatusColors.warning,
  green: chartStatusColors.success,
  teal: token('--chart-teal'),
  orange: token('--chart-orange'),
  indigo: token('--chart-indigo'),
  track: token('--chart-track'),
  grid: token('--border'),
  tooltipCursor: token('--surface-muted'),
  axis: token('--muted-foreground'),
} as const

// Icons stay client-side; the API carries no presentation. Keyed by the
// backend's `key` so a tile that moves or is renamed keeps its icon.

/** The `menu` key the API returns -> where that number lives. */

/**
 * Module card -> which resolved link key opens it. The PATHS come from
 * tblmenumaster_g2g via /filters; only this key mapping lives in the component,
 * because it is about which card means which screen, not about where that
 * screen is.
 */
const MODULE_LINK_KEY: Record<string, string> = {
  organization: 'employee_directory',
  competency: 'competency_dashboard',
  talent: 'talent_dashboard',
  lms: 'learning_dashboard',
  hrit: 'attendance',
  tasks: 'task_dashboard',
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  organization: <Building2 className="size-5 text-primary" />,
  competency: <Target className="size-5 text-success" />,
  talent: <Users className="size-5 text-primary" />,
  lms: <GraduationCap className="size-5 text-warning" />,
  hrit: <CalendarDays className="size-5 text-success" />,
  tasks: <CheckSquare className="size-5 text-destructive" />,
}


const KPI_ICONS: Record<string, React.ReactNode> = {
  total_employees: <Users className="size-5 text-primary" />,
  attendance_today: <CalendarDays className="size-5 text-success" />,
  pending_approvals: <ClipboardCheck className="size-5 text-warning" />,
  open_positions: <BriefcaseBusiness className="size-5 text-primary" />,
  compliance_rate: <ShieldCheck className="size-5 text-success" />,
  overdue_tasks: <CheckSquare className="size-5 text-destructive" />,
  blocked_tasks: <CheckSquare className="size-5 text-destructive" />,
}

/** tone from the API -> Badge variant in this design system. */
const TONE_VARIANT: Record<string, 'destructive' | 'warning' | 'muted'> = {
  danger: 'destructive',
  warning: 'warning',
  neutral: 'muted',
}







const departmentColors = [
  dashboardChartColors.blue,
  dashboardChartColors.green,
  dashboardChartColors.yellow,
  dashboardChartColors.orange,
  dashboardChartColors.indigo,
  dashboardChartColors.teal,
]

/**
 * A section link, which now actually goes somewhere.
 *
 * `to` is a tblmenumaster_g2g access_link, resolved through
 * useSidebarNavigation so it is rights-checked: if the caller's profile cannot
 * see that screen, resolveAccessLink returns '/dashboard' rather than routing
 * them somewhere they will be refused.
 *
 * `reason` marks a link with NO destination in this product at all — there is
 * no organisation-chart screen, no aggregate approvals screen, and the audit
 * screen has no menu row. Those render disabled with the reason as their
 * tooltip instead of looking live and doing nothing.
 */
function SectionLink({
  children,
  to,
  reason,
}: {
  children: string
  to?: string
  reason?: string
}) {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const disabled = !to

  return (
    <Button
      variant="link"
      size="sm"
      className="h-auto px-0 text-xs disabled:no-underline disabled:opacity-50"
      disabled={disabled}
      title={disabled ? reason : undefined}
      onClick={to ? () => router.push(resolveAccessLink(to)) : undefined}
    >
      {children}
      <ArrowRight className="size-3" aria-hidden="true" />
    </Button>
  )
}

function Widget({
  title,
  children,
  action,
  className,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 p-4 pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="p-4 pt-2">{children}</CardContent>
    </Card>
  )
}

function RingMetric({
  label,
  value,
  caption,
  variant,
}: {
  label: string
  /** NULL = not measurable (a zero denominator), which is not the same as 0%. */
  value: number | null
  caption: string
  variant: 'primary' | 'success' | 'indigo'
}) {
  const ringColor = {
    primary: dashboardChartColors.blue,
    success: dashboardChartColors.green,
    indigo: dashboardChartColors.indigo,
  }[variant]

  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-2">
      <div className="relative size-24 shrink-0 xl:size-28" aria-label={`${label} ${value}%`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={[
                // A null percent draws an empty ring; the centre shows a dash
                // and the caption explains why, rather than drawing 0%.
                { name: label, value: value ?? 0 },
                { name: 'Remaining', value: 100 - (value ?? 0) },
              ]}
              dataKey="value"
              innerRadius={39}
              outerRadius={50}
              startAngle={90}
              endAngle={-270}
            >
              <Cell fill={ringColor} />
              <Cell fill={dashboardChartColors.track} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 grid place-items-center text-center">
          <span className="text-2xl font-bold text-foreground">{value === null ? '—' : `${value}%`}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{caption}</p>
      </div>
    </div>
  )
}

export function HrDashboard() {
  const { user } = useAuth()
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const [departmentId, setDepartmentId] = useState<string>('')
  const {
    filters, summary, summaryLoading, summaryError,
    summaryEmptyIsExpected, summaryEmptyReason, meta, refresh,
    workforce, workforceLoading, workforceNote,
    events, eventsLoading, eventsEmptyReason,
  } = useHrDashboard(departmentId || undefined)

  // segments + unassigned = the Total Employees tile. The static design had no
  // slice for people with no department; without one the pie would silently
  // total less than the headcount above it, and neither number could be trusted.
  // Colours stay client-side; the API carries data only.
  const funnelSlices = (workforce?.funnel ?? []).map((f, i) => ({
    name: f.name,
    value: f.value,
    fill: [dashboardChartColors.blue, dashboardChartColors.teal, dashboardChartColors.green, dashboardChartColors.yellow, dashboardChartColors.red][i % 5],
  }))

  // Every destination is resolved by the database. A key with no menu in this
  // organisation returns undefined, and the control disables itself.
  const link = (key: string): string | undefined => filters?.links?.[key] ?? undefined

  /** A tile's `menu` value -> its resolved path, both from the backend. */
  const menuLink = (menu: string | null): string | undefined => {
    if (!menu) return undefined
    const key = filters?.menu_map?.[menu]
    return key ? link(key) : undefined
  }

  const departmentSlices = [
    ...(summary?.departments.segments ?? []).map((d) => ({ name: d.name, value: d.value })),
    ...((summary?.departments.unassigned ?? 0) > 0
      ? [{ name: 'No department', value: summary!.departments.unassigned }]
      : []),
  ]

  // A 403 means the signed-in profile is not admin/hr. Say so, rather than
  // rendering an empty dashboard that reads as "your organisation has no data".
  if (summaryError) {
    const denied = (summaryError as { status?: number })?.status === 403
    return (
      <ErrorState
        title={denied ? 'This dashboard is for HR and administrators' : 'The dashboard could not be loaded'}
        description={denied
          ? 'Your profile does not have permission to view organisation-wide figures. Your own capability and tasks are on your profile page.'
          : (summaryError as Error)?.message ?? 'Please try again.'}
        retry={refresh}
      />
    )
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{getGreeting(user?.name ?? 'there')}</h1>
          <p className="text-sm text-muted-foreground">
            Here is what is happening across your organization today.
          </p>
        </div>
        {/* HORIZONTAL. Select renders its own wrapper as `inline-block w-full`
            and does not merge a className onto it, so three of them in a flex
            row each claimed the full width and stacked. Each one is given an
            explicit width here; flex-wrap then only wraps when the row genuinely
            cannot fit, instead of always. */}
        <div className="flex flex-row flex-wrap items-center gap-2">
          <div className="w-36 shrink-0">
            <Select
              value="all-units"
              onChange={() => undefined}
              disabled
              aria-label={filters?.business_units_reason ?? 'Business unit unavailable'}
              options={[{ label: 'All Units — n/a', value: 'all-units' }]}
            />
          </div>

          <div className="w-44 shrink-0">
            <Select
              value={departmentId}
              onChange={setDepartmentId}
              aria-label="Department"
              options={[
                { label: 'All Departments', value: '' },
                ...(filters?.departments ?? []).map((d) => ({ label: d.label, value: d.value })),
              ]}
            />
          </div>

          <div className="w-36 shrink-0">
            <Select
              value="all-locations"
              onChange={() => undefined}
              disabled
              aria-label={filters?.locations_reason ?? 'Location unavailable'}
              options={[{ label: 'All Locations — n/a', value: 'all-locations' }]}
            />
          </div>

          <Button variant="outline" size="default" disabled className="shrink-0">
            <CalendarDays className="size-4" aria-hidden="true" />
            {meta?.as_of ? new Date(meta.as_of).toLocaleDateString() : new Date().toLocaleDateString()}
          </Button>

          <Button size="default" onClick={refresh} className="shrink-0">
            <RefreshCw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {summaryLoading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[92px] w-full rounded-xl" />)
          : (summary?.kpis ?? []).map((item) => (
              <KPICard
                key={item.key}
                label={item.label}
                // NULL IS NOT ZERO. A tile that could not be measured shows a
                // dash and explains itself in `description`; printing 0 would
                // assert a measurement that was never taken.
                value={item.value === null ? '—' : item.value.toLocaleString()}
                unit={item.value === null ? undefined : item.unit ?? undefined}
                description={item.value === null ? item.empty_reason ?? undefined : undefined}
                // `trend` stays null until dashboard_metric_snapshot has run
                // twice; KPICard hides the line when it is absent, so no arrow
                // is ever invented.
                trend={item.trend ?? undefined}
                icon={KPI_ICONS[item.key]}
                size="sm"
                // The API already says where each number lives; a tile with no
                // reachable screen simply stays unclickable.
                onClick={menuLink(item.menu) ? () => router.push(resolveAccessLink(menuLink(item.menu)!)) : undefined}
                className={menuLink(item.menu) ? 'cursor-pointer transition hover:border-primary/40' : undefined}
              />
            ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.6fr)_minmax(0,1.2fr)]">
        <Widget title="Action Center">
          <div className="space-y-2">
            {summaryLoading
              ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
              : (summary?.action_center ?? []).map((item) => (
                  <div
                    key={item.key}
                    role={menuLink(item.menu) ? 'button' : undefined}
                    tabIndex={menuLink(item.menu) ? 0 : undefined}
                    onClick={menuLink(item.menu) ? () => router.push(resolveAccessLink(menuLink(item.menu)!)) : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-1 py-1',
                      menuLink(item.menu) && 'cursor-pointer hover:bg-muted/60',
                    )}
                  >
                    <Badge variant={TONE_VARIANT[item.tone] ?? 'muted'} className="min-w-9 justify-center">
                      {/* A dash, never a zero — see HrActionRow.count. */}
                      {item.count === null ? '—' : item.count}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{item.state}</span>
                    <ArrowRight className="size-3 text-muted-foreground" aria-hidden="true" />
                  </div>
                ))}
          </div>
          <div className="mt-3 text-center">
            <SectionLink reason="There is no combined approvals screen yet — each row above opens its own module.">View All Actions</SectionLink>
          </div>
        </Widget>

        <Widget
          title="Workforce & Attendance Overview"
          action={<Badge variant="muted">Last 6 Months</Badge>}
        >
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={workforce?.workforce.months ?? []}>
                <CartesianGrid stroke={dashboardChartColors.grid} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: dashboardChartColors.axis }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="count" tick={{ fontSize: 11, fill: dashboardChartColors.axis }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="rate" orientation="right" domain={[80, 100]} tick={{ fontSize: 11, fill: dashboardChartColors.axis }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} />
                <Tooltip cursor={{ fill: dashboardChartColors.tooltipCursor }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="count" dataKey="present" name="Present" fill={dashboardChartColors.blue} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="count" dataKey="absent" name="Absent" fill={dashboardChartColors.red} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="count" dataKey="leave" name="Leave" fill={dashboardChartColors.yellow} radius={[4, 4, 0, 0]} />
                <Line yAxisId="rate" type="monotone" dataKey="attendance" name="Attendance %" stroke={dashboardChartColors.green} strokeWidth={2.5} dot={{ r: 3, fill: dashboardChartColors.green, strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center">
            <SectionLink to={link('attendance')}>View Attendance Dashboard</SectionLink>
          </div>
        </Widget>

        <Widget title="AI Insights" action={<Badge variant="navy">New</Badge>}>
          <div className="space-y-2">
            {/* No insight generator exists anywhere in this product - the five
                sentences here were literals. The card keeps its place rather
                than being deleted, and says plainly that nothing feeds it. */}
            <div className="flex gap-3 rounded-md border border-border p-3">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                Automated insights are not available yet — no insight source is connected to this
                organisation. The numbers above are live; this panel will fill once an insight
                source exists.
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {/* No insight generator exists anywhere, so there is nothing to generate
                and nothing to open. Disabled beats a button that does nothing. */}
            <Button size="sm" disabled title="No insight source is connected yet.">Generate Report</Button>
            <Button size="sm" variant="outline" disabled title="No insight source is connected yet.">Open Analytics</Button>
          </div>
        </Widget>
      </section>

      <section className="grid gap-4 lg:grid-cols-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1fr)]">
        <Widget title="Talent Acquisition Funnel" action={<Badge variant="muted">This Quarter</Badge>}>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip />
                  <Funnel dataKey="value" data={funnelSlices} isAnimationActive>
                    {funnelSlices.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {funnelSlices.map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-4 text-xs">
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-semibold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-center">
            <SectionLink to={link('recruitment')}>View Recruitment Dashboard</SectionLink>
          </div>
        </Widget>

        <Widget title="Learning Progress Overview">
          <div className="grid gap-4 sm:grid-cols-3">
            {workforceLoading ? (
              <Skeleton className="h-28 w-full sm:col-span-3" />
            ) : (
              (workforce?.learning ?? []).map((ring) => (
                <RingMetric
                  key={ring.key}
                  // The original had two rings both labelled "On Track" and no
                  // statement of what either measured. The title is the fix.
                  label={ring.title}
                  value={ring.percent}
                  caption={ring.percent === null ? (ring.empty_reason ?? 'Not measurable') : `${ring.current} / ${ring.total}`}
                  variant={ring.variant as 'primary' | 'success' | 'indigo'}
                />
              ))
            )}
          </div>
          <div className="mt-3 text-center">
            <SectionLink to={link('learning_dashboard')}>Go to Learning Dashboard</SectionLink>
          </div>
        </Widget>

        <Widget title="Upcoming Events">
          <div className="space-y-2">
            {eventsLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : !(events ?? []).length ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {eventsEmptyReason ?? 'Nothing is scheduled.'}
              </p>
            ) : (
              (events ?? []).map((ev) => (
                <div key={ev.id} className="grid grid-cols-[minmax(3.25rem,auto)_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border p-2">
                  <Badge variant="outline" className="justify-center">
                    {new Date(ev.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                  </Badge>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{ev.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{ev.subtitle}</p>
                  </div>
                  {/* time_label and location are separate fields now; the
                      original tuple put a room where a time belonged. */}
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {ev.time_label ?? ev.location ?? ''}
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 text-center">
            <SectionLink to={link('sessions_calendar')}>View Calendar</SectionLink>
          </div>
        </Widget>
      </section>

      <Widget title="Module Summary">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {(workforce?.modules ?? []).map((module) => (
              <div key={module.key} className="rounded-lg border border-border p-3">
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted">
                    {MODULE_ICONS[module.key]}
                  </span>
                  <p className="min-w-0 truncate font-semibold text-foreground">{module.title}</p>
                </div>
                <div className="space-y-1 text-xs">
                  {module.figures.map((f) => (
                    <div key={f.label} className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-muted-foreground">{f.label}</span>
                      <span className="shrink-0 font-medium tabular-nums text-foreground">
                        {/* A figure with no source shows a dash, not a zero. */}
                        {f.value === null ? '—' : `${f.value.toLocaleString()}${f.unit ?? ''}`}
                      </span>
                    </div>
                  ))}
                </div>
                <Separator className="my-3" />
                <SectionLink to={link(MODULE_LINK_KEY[module.key])}>Open Module</SectionLink>
              </div>
            ))}
        </div>
      </Widget>

      <section className="grid gap-4 lg:grid-cols-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1.1fr)_minmax(0,1fr)]">
        <Widget title="Recent Activity">
          <div className="space-y-2">
            {summaryLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)
            ) : !(summary?.activity ?? []).length ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No activity has been recorded yet in Competency, Performance, Onboarding or Leave.
              </p>
            ) : (
              (summary?.activity ?? []).map((item) => (
                <div key={item.id} className="flex items-center gap-3 text-sm">
                  <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-foreground">{item.text}</span>
                  {/* The original printed the constant "Today" on every row.
                      This is the real timestamp the event carries. */}
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.at ? new Date(item.at).toLocaleDateString() : ''}
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 text-center">
            <SectionLink reason="The activity centre has no menu entry yet, so it cannot be opened from here.">View All Activity</SectionLink>
          </div>
        </Widget>

        <Widget title="Quick Actions">
          <div className="grid grid-cols-2 gap-2">
            {/* Two of these are real DEEP links, not just screen links:
                Apply Leave opens the apply drawer (?apply=1) and Post Job opens
                the job form (?tab=job-openings&action=job). The rest land on
                the screen that owns the button, because no other screen in this
                app accepts a create deep-link. "Request Approval" has no
                destination at all and is disabled rather than inert. */}
            {([
              [Users, 'Add Employee', link('employee_directory'), 'This organisation has no employee directory menu.'],
              [CalendarDays, 'Apply Leave', link('apply_leave'), 'This organisation has no leave menu.'],
              [CheckSquare, 'Create Task', link('task_dashboard'), 'This organisation has no task menu.'],
              [Target, 'Assign Course', link('assignments'), 'This organisation has no learning assignments menu.'],
              [BriefcaseBusiness, 'Post Job', link('post_job'), 'This organisation has no recruitment menu.'],
              [FileText, 'Run Payroll', link('payroll'), 'This organisation has no payroll menu.'],
              [BarChart3, 'Generate Report', link('task_reports'), 'This organisation has no reports menu.'],
              [ClipboardCheck, 'Request Approval', undefined, 'No approval-request screen exists yet — raise it from the module it belongs to.'],
            ] as [React.ElementType, string, string | undefined, string | undefined][]).map(
              ([Icon, label, to, reason]) => (
                <Button
                  key={label}
                  variant="outline"
                  className="h-16 flex-col gap-1 text-xs"
                  disabled={!to}
                  title={to ? undefined : reason}
                  onClick={to ? () => router.push(resolveAccessLink(to)) : undefined}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span className="min-w-0 truncate">{label}</span>
                </Button>
              ),
            )}
          </div>
        </Widget>

        <Widget title="Top Departments by Headcount">
          <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={departmentSlices} dataKey="value" innerRadius={38} outerRadius={64} paddingAngle={2}>
                    {departmentSlices.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={departmentColors[index % departmentColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1">
              {departmentSlices.map((dept, index) => (
                <div key={`${dept.name}-${index}`} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: departmentColors[index % departmentColors.length] }} />
                    <span className="truncate">{dept.name}</span>
                  </span>
                  <span className="font-medium text-foreground">{dept.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-center">
            {(summary?.departments.merged_duplicate_names ?? 0) > 0 && (
              <p className="mb-2 text-[11px] text-muted-foreground">
                {summary!.departments.merged_duplicate_names} department name(s) exist on more than
                one record and are shown here as one.
              </p>
            )}
            <SectionLink reason="No organisation chart screen exists in this product yet.">View Organization Chart</SectionLink>
          </div>
        </Widget>
      </section>
    </div>
  )
}
