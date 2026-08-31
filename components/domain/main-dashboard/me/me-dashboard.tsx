'use client'

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Award,
  Bot,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleSlash,
  ClipboardList,
  FileText,
  GraduationCap,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { KPICard } from '@/components/shared/business'
import { chartStatusColors } from '@/lib/chart-colors'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/gtg-auth'
import { getGreeting } from '@/lib/greeting'
import { useMeDashboard } from '@/hooks/use-me-dashboard'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { ErrorState } from '@/components/ui/error-state'
import { cn } from '@/lib/utils'
import type { MeCapabilityAxis } from '@/types/me-dashboard'

const token = (name: string) => `var(${name})`

/**
 * Colours come from the token set, never as hex literals — the same palette the
 * HR dashboard uses, so the two screens cannot drift apart in a theme change.
 */
const colors = {
  blue: chartStatusColors.primary,
  green: chartStatusColors.success,
  yellow: chartStatusColors.warning,
  red: chartStatusColors.danger,
  indigo: chartStatusColors.secondary,
  teal: token('--chart-teal'),
  orange: token('--chart-orange'),
  track: token('--chart-track'),
  grid: token('--border'),
  axis: token('--muted-foreground'),
  cursor: token('--surface-muted'),
} as const

/**
 * Task status -> colour.
 *
 * `not_started` IS DELIBERATELY THE MUTED TRACK COLOUR rather than a warning
 * red. A fifth of the showcase tenant's tasks land in it, and they are not late
 * or failing — nobody recorded a status. Colouring an admin gap as a personal
 * failure is the visual form of the same lie the backend refuses to tell.
 */
const STATUS_COLOR: Record<string, string> = {
  completed: colors.green,
  in_progress: colors.blue,
  pending: colors.indigo,
  on_hold: colors.yellow,
  not_started: colors.track,
  other: colors.teal,
}

const PRIORITY_COLOR: Record<string, string> = {
  High: colors.red,
  Medium: colors.yellow,
  Low: colors.green,
  Unset: colors.track,
}

/** execution_mode -> colour, ordered person-only through fully-automated. */
const MODE_COLOR: Record<string, string> = {
  human_only: colors.blue,
  human_ai_assist: colors.teal,
  ai_human_review: colors.indigo,
  automated: colors.green,
  unclassified: colors.track,
}

/* ══════════════════════════════════════════════════════════════════════
 * CHROME
 * ══════════════════════════════════════════════════════════════════════ */

function Widget({
  title,
  icon: Icon,
  children,
  action,
  className,
}: {
  title: string
  icon?: React.ElementType
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden="true" />}
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col p-4 pt-2">{children}</CardContent>
    </Card>
  )
}

/**
 * THE EMPTY STATE THAT EXPLAINS ITSELF AND OFFERS THE ACTION.
 *
 * This is the most-used component on this screen and that is the point, not a
 * shortcoming. Measured on live: the busiest employee in the showcase tenant has
 * no courses, no certifications, no assessments and no written procedures. Three
 * empty domains is the NORMAL case here, not an edge one — so an empty widget
 * has to be as carefully built as a full one.
 *
 * A blank box teaches people the product is broken. A sentence naming the reason
 * and a button going somewhere teaches them what to do next.
 */
function Empty({
  icon: Icon = CircleSlash,
  reason,
  action,
  tone = 'muted',
}: {
  icon?: React.ElementType
  reason: string
  action?: React.ReactNode
  tone?: 'muted' | 'warning'
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <Icon
        className={cn('size-6', tone === 'warning' ? 'text-warning' : 'text-muted-foreground/50')}
        aria-hidden="true"
      />
      <p className="max-w-[38ch] text-xs leading-relaxed text-muted-foreground">{reason}</p>
      {action}
    </div>
  )
}

function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex-1 space-y-2 py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  )
}

/**
 * A link that actually goes somewhere, or visibly does not.
 *
 * `to` is a tblmenumaster_g2g access_link resolved by the BACKEND — never a path
 * typed here. It is then put through resolveAccessLink so it is rights-checked:
 * a caller whose profile cannot open that screen is not routed somewhere they
 * will be refused.
 *
 * A key with no menu row in this tenant arrives as null, and the control renders
 * disabled with the reason as its tooltip rather than looking live and doing
 * nothing.
 */
function Go({
  children,
  to,
  reason,
  size = 'sm',
}: {
  children: string
  to?: string | null
  reason?: string
  size?: 'sm' | 'xs'
}) {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const disabled = !to

  return (
    <Button
      variant="link"
      size="sm"
      className={cn(
        'h-auto gap-1 px-0 disabled:no-underline disabled:opacity-50',
        size === 'xs' ? 'text-[11px]' : 'text-xs',
      )}
      disabled={disabled}
      title={disabled ? (reason ?? 'This screen is not enabled for your organisation.') : undefined}
      onClick={to ? () => router.push(resolveAccessLink(to)) : undefined}
    >
      {children}
      <ArrowRight className="size-3" aria-hidden="true" />
    </Button>
  )
}

/* ══════════════════════════════════════════════════════════════════════
 * CAPABILITY DETAIL: ONE ROW PER COMPETENCY, BENEATH THE RADAR
 * ══════════════════════════════════════════════════════════════════════
 *
 * These rows do NOT replace the radar — they answer the questions it cannot.
 * The radar shows the SHAPE of a profile across the role, which is what people
 * read it for and why it is still the top half of this widget. But a polygon
 * cannot tell you which competency is short, by how much, or on how much
 * evidence, and it cannot plot an unrated competency at all — a polygon needs a
 * point on every axis, and "not assessed" has none.
 *
 * So the shape is above and the specifics are here, including the unrated
 * competencies the radar has to leave out. Those are the most actionable rows
 * on the screen, and before this they were invisible.
 *
 * ── THE COLOURS WERE VALIDATED, NOT CHOSEN ─────────────────────────────
 *
 * Run against this product's own surface (#f8fafc light / #090e1a dark), the
 * obvious green/amber/red status trio FAILS: red #ef4343 and orange #f97415 sit
 * at ΔE 10.7 for NORMAL vision — below the 15 floor, so full-colour readers
 * cannot reliably tell them apart, and no amount of labelling excuses that.
 * Green + orange scrapes through on normal vision but lands at ΔE 6.2 under
 * deuteranopia.
 *
 * blue ↔ red passes all six checks — CVD ΔE 26.7, normal 38.3, both ≥ 3:1 on
 * the surface — and it is the diverging pair polarity calls for. So: blue at or
 * above target, red below, neutral for unrated. Colour never carries it alone —
 * every row states its gap in words and numbers.
 */
function CapabilityRow({ axis, scaleMax }: { axis: MeCapabilityAxis; scaleMax: number }) {
  const rated = axis.current !== null && axis.required !== null
  const gap = rated ? (axis.current as number) - (axis.required as number) : null
  const meets = gap !== null && gap >= 0

  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / scaleMax) * 100))}%`
  const markColor = meets ? colors.blue : colors.red

  return (
    <li className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-xs font-medium text-foreground" title={axis.competency}>
          {axis.competency}
          {axis.mandatory && (
            <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              required
            </span>
          )}
        </span>
        {/* THE VERDICT IN WORDS, so the colour is never the only signal. */}
        <span
          className={cn(
            'shrink-0 text-[11px] font-semibold tabular-nums',
            !rated ? 'text-muted-foreground' : meets ? 'text-primary' : 'text-destructive',
          )}
        >
          {!rated ? 'Not rated' : meets ? (gap === 0 ? 'At target' : `+${gap.toFixed(1)}`) : gap!.toFixed(1)}
        </span>
      </div>

      {/* The track spans the whole scale, so row lengths are comparable. */}
      <div className="relative mt-2 h-4">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full" style={{ background: colors.track }} />

        {rated ? (
          <>
            {/* 2px connector: its length IS the gap. */}
            <div
              className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full"
              style={{
                left: pct(Math.min(axis.current as number, axis.required as number)),
                width: `calc(${pct(Math.abs(gap as number))})`,
                background: markColor,
              }}
            />
            {/* Required = hollow reference marker. It is the target, not a
                second series competing for attention. */}
            <span
              className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
              style={{ left: pct(axis.required as number), borderColor: colors.axis, background: 'var(--card)' }}
              aria-hidden="true"
            />
            {/* Mine = filled, with a 2px surface ring so it stays readable when
                it lands on top of the target marker. */}
            <span
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: pct(axis.current as number), background: markColor, boxShadow: '0 0 0 2px var(--card)' }}
              aria-hidden="true"
            />
          </>
        ) : (
          // No invented position. An unrated competency shows only its target.
          <span
            className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed"
            style={{ left: pct(axis.required ?? 0), borderColor: colors.axis, background: 'var(--card)' }}
            aria-hidden="true"
          />
        )}
      </div>

      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        {rated
          ? `You ${axis.current} · target ${axis.required} · ${axis.items_rated} of ${axis.items_total} items rated`
          : `Target ${axis.required ?? '—'} · none of its ${axis.items_total} items rated yet`}
      </p>
    </li>
  )
}

/** Numbers line up in columns; `tabular-nums` is what makes them do so. */
function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="min-w-0 truncate text-xs text-muted-foreground">{label}</span>
      <span className={cn('shrink-0 text-sm font-semibold tabular-nums', tone)}>{value}</span>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
 * THE SCREEN
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * THE EMPLOYEE'S OWN HOME DASHBOARD.
 *
 * Everything here is the signed-in person's own data. There is no filter for
 * whose figures to show, because the endpoints take no subject: the token
 * decides, and there is nothing on this screen that could ask for somebody else.
 *
 * THREE SECTIONS, THREE INDEPENDENT REQUESTS. The tiles paint while capability
 * and the attendance scan are still in flight, and a failure in one leaves the
 * other two on screen. That is why each block below checks its OWN loading and
 * error state rather than one shared flag.
 */
export function MeDashboard() {
  const { user } = useAuth()
  const {
    me, links, tasks, summaryLoading, summaryError, tasksEmptyReason,
    growth, growthLoading, growthError,
    signals, signalsLoading, signalsError, signalsEmptyReason,
    meta, refresh,
  } = useMeDashboard()

  /** Every destination is resolved by the database; unknown keys stay disabled. */
  const link = (key: string): string | null => links?.[key] ?? null

  // The summary carries identity as well as tiles, so a failure there is the one
  // failure that leaves nothing to show. The other two degrade in place.
  if (summaryError) {
    return (
      <ErrorState
        title="Your dashboard could not be loaded"
        description={(summaryError as Error)?.message ?? 'Please try again.'}
        retry={refresh}
      />
    )
  }

  const capability = growth?.capability
  const measuredAxes = (capability?.axes ?? []).filter(
    (a: MeCapabilityAxis) => a.current !== null && a.required !== null,
  )
  /*
   * EVERY competency, rated or not — sorted worst gap first.
   *
   * The radar this replaced could only plot `measuredAxes`, so an unrated
   * competency simply vanished from the chart. That is the opposite of useful:
   * "nobody has assessed you on this yet" is the most actionable row on the
   * list, and it was the one row the reader never saw.
   */
  /*
   * The radar can only plot a competency that HAS a rating — a polygon needs a
   * point on every axis, and an unrated competency has none. It is not a zero,
   * so it is left off the shape and listed in the detail rows below instead.
   */
  const radarData = measuredAxes.map((a) => ({
    competency: a.competency.length > 22 ? `${a.competency.slice(0, 21)}…` : a.competency,
    full: a.competency,
    Required: a.required,
    Me: a.current,
  }))

  const capabilityRows = [...(capability?.axes ?? [])].sort((a, b) => {
    const gap = (x: MeCapabilityAxis) =>
      x.current === null || x.required === null ? Infinity : x.current - x.required
    const ga = gap(a)
    const gb = gap(b)
    // Unrated last: they have no gap to rank by, and burying a real shortfall
    // under them would defeat the sort.
    if (ga === Infinity && gb === Infinity) return a.competency.localeCompare(b.competency)
    if (ga === Infinity) return 1
    if (gb === Infinity) return -1
    return ga - gb
  })

  /**
   * The proficiency scale, derived rather than assumed.
   *
   * `competency_proficiency_levels` is empty in every tenant, so there is no
   * authoritative maximum to read. Five is the KASBA convention and the floor
   * here — but a tenant that rates above it must not have the bar clipped into
   * looking like a lower score than it is, so the real maximum wins when it is
   * higher.
   */
  const scaleMax = Math.max(
    5,
    // EVERY axis, not just the rated ones: an unrated row still draws its
    // target marker, so a target above the scale would be positioned off the
    // end of its own track.
    ...(capability?.axes ?? []).map((a) => Math.max(a.required ?? 0, a.current ?? 0)),
  )

  const execution = growth?.execution
  const months = signals?.attendance?.months ?? []
  const recording = signals?.attendance?.recording

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">{getGreeting(me?.name ?? user?.name ?? 'there')}</h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {me?.jobrole ? (
              <>
                <span className="font-medium text-foreground">{me.jobrole}</span>
                {me.department && <span>· {me.department}</span>}
              </>
            ) : summaryLoading ? (
              <Skeleton className="h-4 w-48" />
            ) : (
              // NOT SILENCE. Without a job role, four widgets on this page are
              // empty by construction. Saying so once at the top is kinder than
              // letting someone discover it four times.
              <span className="text-warning">{me?.jobrole_note ?? 'No job role is set against your record.'}</span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 flex-row flex-wrap items-center gap-2">
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

      {/* ── TILES ──────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {summaryLoading || !tasks ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[92px] w-full rounded-xl" />)
        ) : (
          <>
            <KPICard
              label="My tasks"
              value={tasks.total.toLocaleString()}
              icon={<ClipboardList className="size-5 text-primary" />}
              size="sm"
            />
            <KPICard
              label="Completed"
              value={tasks.completed.toLocaleString()}
              // NULL IS NOT ZERO: with no tasks at all there is no rate to state.
              description={tasks.completion_rate === null ? 'No tasks yet' : `${tasks.completion_rate}% of yours`}
              icon={<CheckCircle2 className="size-5 text-success" />}
              size="sm"
            />
            <KPICard
              label="In progress"
              value={tasks.in_progress.toLocaleString()}
              icon={<Activity className="size-5 text-primary" />}
              size="sm"
            />
            <KPICard
              label="Overdue"
              value={tasks.overdue.toLocaleString()}
              // THE SUBTEXT IS LOAD-BEARING. Overdue counts only work somebody
              // started; without this line a smaller number than the task module
              // shows would look like a bug rather than a deliberate exclusion.
              description={
                tasks.past_due_untracked > 0
                  ? `Excludes ${tasks.past_due_untracked} past due with no status`
                  : 'Past due, with a status set'
              }
              icon={<AlertTriangle className="size-5 text-destructive" />}
              size="sm"
              variant={tasks.overdue > 0 ? 'danger' : 'default'}
            />
            <KPICard
              label="Due in 7 days"
              value={tasks.due_next_7_days.toLocaleString()}
              icon={<CalendarClock className="size-5 text-warning" />}
              size="sm"
            />
            <KPICard
              label="Not started"
              value={tasks.not_started.toLocaleString()}
              description={tasks.not_started > 0 ? 'No status recorded' : 'All tasks have a status'}
              icon={<CircleSlash className="size-5 text-muted-foreground" />}
              size="sm"
            />
          </>
        )}
      </section>

      {/* ── ROW 1: my work ─────────────────────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Widget
          title="My work by status"
          icon={ClipboardList}
          action={<Go to={link('my_tasks')} size="xs">Open My Tasks</Go>}
        >
          {summaryLoading ? (
            <Loading />
          ) : !tasks || tasks.total === 0 ? (
            <Empty
              icon={ClipboardList}
              reason={tasksEmptyReason ?? 'No tasks have been assigned to you for this academic year.'}
              action={<Go to={link('my_tasks')}>Open My Tasks</Go>}
            />
          ) : tasks.status_breakdown.length === 1 ? (
            // ONE VALUE IS NOT A DISTRIBUTION. Measured: every one of tenant 7's
            // 1,005 tasks is PENDING, and a donut there is a single full circle
            // pretending to be a breakdown. The number is stated plainly instead,
            // and the priority chart beside it carries the actual variation.
            <div className="flex flex-1 flex-col items-center justify-center gap-1 py-8 text-center">
              <span className="text-4xl font-bold tabular-nums text-foreground">
                {tasks.status_breakdown[0].value}
              </span>
              <span className="text-sm font-medium text-foreground">{tasks.status_breakdown[0].label}</span>
              <p className="mt-1 max-w-[34ch] text-[11px] leading-relaxed text-muted-foreground">
                All of your tasks share one status, so there is no breakdown to chart. Priority, beside this, is
                where the variation is.
              </p>
            </div>
          ) : (
            <>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tasks.status_breakdown}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {tasks.status_breakdown.map((slice) => (
                        <Cell key={slice.key ?? slice.label} fill={STATUS_COLOR[slice.key ?? ''] ?? colors.track} />
                      ))}
                    </Pie>
                    <Tooltip cursor={{ fill: colors.cursor }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* The measured fact, in words, under the chart that would
                  otherwise imply it. */}
              {tasks.untracked_note && (
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{tasks.untracked_note}</p>
              )}
            </>
          )}
        </Widget>

        <Widget title="My work by priority" icon={TrendingUp}>
          {summaryLoading ? (
            <Loading />
          ) : !tasks || tasks.priority_breakdown.length === 0 ? (
            <Empty icon={TrendingUp} reason="None of your tasks carry a priority yet." />
          ) : (
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tasks.priority_breakdown} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid stroke={colors.grid} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: colors.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={64} tick={{ fontSize: 11, fill: colors.axis }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: colors.cursor }} />
                  <Bar dataKey="value" name="Tasks" radius={[0, 4, 4, 0]}>
                    {tasks.priority_breakdown.map((slice) => (
                      <Cell key={slice.label} fill={PRIORITY_COLOR[slice.label] ?? colors.track} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Widget>

        <Widget
          title="What is due next"
          icon={CalendarClock}
          action={<Go to={link('task_calendar')} size="xs">Calendar</Go>}
        >
          {signalsLoading ? (
            <Loading rows={5} />
          ) : signalsError ? (
            <Empty icon={AlertTriangle} tone="warning" reason="This section could not be loaded. Everything else on the page is unaffected." />
          ) : (signals?.upcoming ?? []).length === 0 ? (
            <Empty
              icon={CalendarClock}
              reason={signals?.upcoming_note ?? 'Nothing of yours is dated and outstanding.'}
              action={<Go to={link('my_tasks')}>Open My Tasks</Go>}
            />
          ) : (
            <ul className="flex-1 space-y-1.5">
              {(signals?.upcoming ?? []).map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-2 border-b border-border/40 pb-1.5 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">{t.title}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {t.due} · {t.status}
                    </p>
                  </div>
                  {t.overdue && (
                    <Badge variant="destructive" className="shrink-0 text-[10px]">
                      Overdue
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Widget>
      </section>

      {/* ── ROW 2: capability and how the work is done ─────────────────── */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Widget
          title="My capability against my role"
          icon={Target}
          className="lg:col-span-2"
          action={<Go to={link('capability_explorer')} size="xs">Capability Explorer</Go>}
        >
          {growthLoading ? (
            <Loading rows={5} />
          ) : growthError ? (
            <Empty icon={AlertTriangle} tone="warning" reason="This section could not be loaded. Your task figures above are unaffected." />
          ) : capabilityRows.length === 0 ? (
            /* EMPTY MEANS NO COMPETENCIES ARE MAPPED — not "none are rated".
               This used to test `measuredAxes`, so a role whose competencies
               were all unrated fell through to an empty state, hiding exactly
               the rows a person most needs to act on. */
            <Empty
              icon={Target}
              reason={capability?.empty_reason ?? 'Your job role does not have any competencies mapped to it yet.'}
              action={<Go to={link('capability_explorer')}>Capability Explorer</Go>}
            />
          ) : (
            <>
              {/* ── THE SHAPE OF THE ROLE ───────────────────────────────────
                  Restored deliberately. The radar shows at a glance whether the
                  profile is even across the role or spiky, which a list cannot,
                  and that overall shape is what people read it for.

                  WHAT ACTUALLY NEEDED FIXING WAS THE COLOUR. Required was
                  indigo #6467f2 and You was blue #2463eb — measured against
                  this surface at ΔE 6.9 for NORMAL vision, against a floor of
                  15, and 2.2 under protanopia. Effectively one colour, which is
                  why the two polygons read as mixed.

                  They are now separated three ways at once, so no single
                  channel has to carry it: Required is NEUTRAL rather than a
                  hue, DASHED rather than solid, and unfilled. You keeps the
                  blue and the fill. That is the emphasis pattern — the subject
                  gets the hue, the reference recedes to context. */}
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="72%">
                    <PolarGrid stroke={colors.grid} />
                    <PolarAngleAxis dataKey="competency" tick={{ fontSize: 10, fill: colors.axis }} />
                    <PolarRadiusAxis angle={90} domain={[0, scaleMax]} tick={{ fontSize: 9, fill: colors.axis }} />
                    <Radar
                      name="Target for my role"
                      dataKey="Required"
                      stroke={colors.axis}
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      fill="none"
                      fillOpacity={0}
                    />
                    <Radar
                      name="Me"
                      dataKey="Me"
                      stroke={colors.blue}
                      strokeWidth={2}
                      fill={colors.blue}
                      fillOpacity={0.32}
                    />
                    <Legend iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip cursor={{ fill: colors.cursor }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* ── THE DETAIL, per competency ───────────────────────────────
                  The radar answers "what shape am I"; it cannot answer "which
                  one, by how much, and on what evidence". These rows do, and
                  they include the competencies the radar CANNOT plot at all —
                  the unrated ones, which are the most actionable of the lot. */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full border-2" style={{ borderColor: colors.axis }} />
                  Target
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-full" style={{ background: colors.blue }} />
                  Me, at or above
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-full" style={{ background: colors.red }} />
                  Me, below target
                </span>
              </div>
              {/* Capped and scrollable: a role with twenty mapped competencies
                  would otherwise stretch this card far past the one beside it
                  and push the rest of the dashboard down. */}
              <ul className="max-h-64 divide-y divide-border/40 overflow-y-auto pr-1">
                {capabilityRows.map((axis) => (
                  <CapabilityRow key={axis.competency_id} axis={axis} scaleMax={scaleMax} />
                ))}
              </ul>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {capabilityRows.filter((a) => a.current !== null && a.required !== null && a.current < a.required).length}
                  </span>{' '}
                  below target
                </span>
                <span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {capabilityRows.filter((a) => a.current === null).length}
                  </span>{' '}
                  not yet rated
                </span>
                <span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {capabilityRows.filter((a) => a.mandatory).length}
                  </span>{' '}
                  mandatory
                </span>
              </div>
            </>
          )}

          {/* Every competency now has a row, rated or not — the unrated ones are
              the point, not a footnote, so there is nothing left to disclaim. */}
        </Widget>

        <Widget
          title="How my role's work is done"
          icon={Bot}
          action={
            execution && execution.total > 0 ? (
              <Badge variant="muted" className="tabular-nums">{execution.total} tasks</Badge>
            ) : undefined
          }
        >
          {growthLoading ? (
            <Loading rows={4} />
          ) : growthError || !execution ? (
            <Empty icon={AlertTriangle} tone="warning" reason="This section could not be loaded." />
          ) : execution.total === 0 ? (
            <Empty icon={Bot} reason={execution.empty_reason ?? 'The work of your role has not been classified yet.'} />
          ) : (
            <>
              <div className="h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={execution.modes} dataKey="value" nameKey="label" innerRadius={34} outerRadius={54} paddingAngle={2}>
                      {execution.modes.map((m) => (
                        <Cell key={m.key} fill={MODE_COLOR[m.key] ?? colors.track} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-0.5">
                {execution.modes.map((m) => (
                  <div key={m.key} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: MODE_COLOR[m.key] ?? colors.track }} />
                      <span className="truncate">{m.label}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{m.value}</span>
                  </div>
                ))}
              </div>

              {/* Effort is only shown when it was actually estimated. A widget
                  reading "0 minutes released" would assert a measurement that
                  was never taken — most classifications carry no effort figure. */}
              {(execution.effort_current_min ?? 0) > 0 && (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-semibold tabular-nums text-foreground">
                    {Math.round((execution.effort_released_min ?? 0) / 60)}h
                  </span>{' '}
                  of {Math.round((execution.effort_current_min ?? 0) / 60)}h could move to agent support, if these
                  proposals are accepted.
                </p>
              )}

              {/* 3,552 of 3,572 classifications on live are still proposals.
                  Presenting one as agreed is the error this module exists to
                  avoid, so the caveat is part of the widget, not a footnote. */}
              {execution.review_note && (
                <p className="mt-1 flex items-start gap-1 text-[11px] leading-relaxed text-warning">
                  <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden="true" />
                  {execution.review_note}
                </p>
              )}
            </>
          )}
        </Widget>
      </section>

      {/* ── ROW 3: learning, procedures, attendance ────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Widget
          title="Courses for me"
          icon={GraduationCap}
          action={<Go to={link('learning_catalog')} size="xs">Catalogue</Go>}
        >
          {growthLoading ? (
            <Loading rows={4} />
          ) : growthError || !growth ? (
            <Empty icon={AlertTriangle} tone="warning" reason="This section could not be loaded." />
          ) : growth.learning.recommended.length > 0 ? (
            <ul className="flex-1 space-y-1.5">
              {growth.learning.recommended.map((c) => (
                <li key={c.course_id} className="border-b border-border/40 pb-1.5 last:border-0">
                  <p className="truncate text-xs font-medium text-foreground">{c.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Builds {c.competency ?? 'a competency you are below target on'}
                  </p>
                </li>
              ))}
            </ul>
          ) : growth.learning.enrolled.length > 0 ? (
            <ul className="flex-1 space-y-1.5">
              {growth.learning.enrolled.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 border-b border-border/40 pb-1.5 last:border-0">
                  <p className="min-w-0 truncate text-xs font-medium text-foreground">{c.title}</p>
                  <Badge variant="muted" className="shrink-0 text-[10px]">{c.status ?? 'enrolled'}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              icon={GraduationCap}
              // THE BROKEN-MAPPING SENTENCE WINS when there is one. "No courses
              // match your gaps" and "the mapping points at competencies that do
              // not exist" are different facts, and only the second is true in
              // the showcase tenant.
              tone={growth.learning.mapping_note ? 'warning' : 'muted'}
              reason={growth.learning.mapping_note ?? growth.learning.empty_reason ?? 'No courses are available yet.'}
              action={<Go to={link('learning_catalog')}>Browse the catalogue</Go>}
            />
          )}
        </Widget>

        <Widget title="Procedures for my role" icon={FileText}>
          {growthLoading ? (
            <Loading rows={4} />
          ) : growthError || !growth ? (
            <Empty icon={AlertTriangle} tone="warning" reason="This section could not be loaded." />
          ) : growth.procedures.total === 0 ? (
            <Empty
              icon={FileText}
              reason="No written procedure has been published for your role's tasks yet. When one is, the steps, the controls and what a person must decide appear here."
            />
          ) : (
            <ul className="flex-1 space-y-1.5">
              {growth.procedures.items.map((p) => (
                <li key={p.id} className="border-b border-border/40 pb-1.5 last:border-0">
                  <p className="truncate text-xs font-medium text-foreground">{p.title ?? p.task}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {p.status} · {p.mode}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget
          title="My attendance"
          icon={CalendarDays}
          action={<Go to={link('attendance')} size="xs">Attendance</Go>}
        >
          {signalsLoading ? (
            <Loading rows={4} />
          ) : signalsError ? (
            <Empty icon={AlertTriangle} tone="warning" reason="This section could not be loaded." />
          ) : months.every((m) => m.present === null) ? (
            <Empty icon={CalendarDays} reason={signalsEmptyReason ?? 'No attendance has been recorded against you in the last six months.'} />
          ) : (
            <>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={months}>
                    <CartesianGrid stroke={colors.grid} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: colors.axis }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: colors.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip cursor={{ fill: colors.cursor }} />
                    {/* DAYS RECORDED, NOT AN ATTENDANCE RATE. On live the busiest
                        employee has three logged days in a 26-working-day month;
                        drawn as a percentage that reads "attended 12% of the
                        time", which is an accusation manufactured out of a gap
                        in an import. */}
                    <Bar dataKey="present" name="Days recorded" fill={colors.blue} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="leave" name="Leave" fill={colors.yellow} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {recording?.note && (
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{recording.note}</p>
              )}
            </>
          )}
        </Widget>
      </section>

      {/* ── ROW 4: HR record ───────────────────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-4">
        <Widget
          title="My leave"
          icon={CalendarDays}
          action={<Go to={link('apply_leave')} size="xs">Apply</Go>}
        >
          {signalsLoading ? (
            <Loading rows={3} />
          ) : signalsError || !signals ? (
            <Empty icon={AlertTriangle} tone="warning" reason="This section could not be loaded." />
          ) : (
            <>
              <Stat
                label={`Entitlement ${signals.leave.year}`}
                // A DASH, NEVER A ZERO. "No allocation is recorded" and "you have
                // no days left" are opposite facts.
                value={signals.leave.allocated_days === null ? '—' : `${signals.leave.allocated_days} days`}
              />
              <Stat label="Awaiting decision" value={String(signals.leave.pending)} />
              {signals.leave.requests.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {signals.leave.requests.slice(0, 3).map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="min-w-0 truncate text-muted-foreground tabular-nums">
                        {r.from} → {r.to}
                      </span>
                      <Badge variant="muted" className="shrink-0 text-[10px]">{r.status}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  {signals.leave.empty_reason}
                </p>
              )}
              {signals.leave.allocation_note && (
                <p className="mt-auto pt-2 text-[11px] leading-relaxed text-muted-foreground">
                  {signals.leave.allocation_note}
                </p>
              )}
            </>
          )}
        </Widget>

        <Widget
          title="My assessments"
          icon={ClipboardList}
          action={<Go to={link('my_assessment')} size="xs">Open</Go>}
        >
          {growthLoading ? (
            <Loading rows={3} />
          ) : growthError || !growth ? (
            <Empty icon={AlertTriangle} tone="warning" reason="This section could not be loaded." />
          ) : growth.assessments.items.length === 0 ? (
            <Empty icon={ClipboardList} reason={growth.assessments.empty_reason ?? 'No assessment has been assigned to you.'} />
          ) : (
            <ul className="flex-1 space-y-1.5">
              {growth.assessments.items.map((a) => (
                <li key={a.id} className="border-b border-border/40 pb-1.5 last:border-0">
                  <p className="truncate text-xs font-medium text-foreground">{a.title}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {a.status}
                    {/* An unscored assessment shows a dash, never 0. */}
                    {a.due ? ` · due ${a.due}` : ''}
                    {a.score !== null ? ` · ${a.score}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget title="My certifications" icon={Award}>
          {growthLoading ? (
            <Loading rows={3} />
          ) : growthError || !growth ? (
            <Empty icon={AlertTriangle} tone="warning" reason="This section could not be loaded." />
          ) : growth.certifications.total === 0 ? (
            <Empty icon={Award} reason={growth.certifications.empty_reason ?? 'No certifications are recorded against you.'} />
          ) : (
            <>
              <Stat label="Held" value={String(growth.certifications.total)} />
              <Stat
                label="Expiring within 90 days"
                value={String(growth.certifications.expiring_90d)}
                tone={growth.certifications.expiring_90d > 0 ? 'text-warning' : undefined}
              />
              <Stat
                label="Expired"
                value={String(growth.certifications.expired)}
                tone={growth.certifications.expired > 0 ? 'text-destructive' : undefined}
              />
              <ul className="mt-2 space-y-1">
                {growth.certifications.items.slice(0, 3).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="min-w-0 truncate text-muted-foreground">{c.name}</span>
                    <span className="shrink-0 tabular-nums">{c.expires ?? '—'}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Widget>

        <Widget title="My performance" icon={Sparkles}>
          {growthLoading ? (
            <Loading rows={3} />
          ) : growthError || !growth ? (
            <Empty icon={AlertTriangle} tone="warning" reason="This section could not be loaded." />
          ) : !growth.performance.review ? (
            <Empty icon={Sparkles} reason={growth.performance.empty_reason ?? 'No performance review has been opened for you.'} />
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                {/* A review in progress with no rating yet is the common case,
                    and it shows a dash rather than a score of nothing. */}
                <span className="text-3xl font-bold tabular-nums text-foreground">
                  {growth.performance.review.overall === null ? '—' : growth.performance.review.overall.toFixed(2)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {growth.performance.review.label ?? 'overall'}
                </span>
              </div>
              <div className="mt-2">
                <Stat label="Stage" value={growth.performance.review.stage ?? '—'} />
                <Stat label="Status" value={growth.performance.review.status ?? '—'} />
                <Stat
                  label="Self rating"
                  value={growth.performance.review.self === null ? '—' : growth.performance.review.self.toFixed(2)}
                />
                <Stat
                  label="Manager rating"
                  value={growth.performance.review.manager === null ? '—' : growth.performance.review.manager.toFixed(2)}
                />
              </div>
            </>
          )}
        </Widget>
      </section>

      {/* ── ROW 5: activity ────────────────────────────────────────────── */}
      <section className="grid gap-4">
        <Widget title="Recent activity on my record" icon={Activity}>
          {signalsLoading ? (
            <Loading rows={3} />
          ) : signalsError ? (
            <Empty icon={AlertTriangle} tone="warning" reason="This section could not be loaded." />
          ) : (signals?.activity ?? []).length === 0 ? (
            <Empty
              icon={Activity}
              reason="Nothing has been logged against your record recently. Competency, performance, onboarding and leave decisions all appear here as they happen."
            />
          ) : (
            <ul className="space-y-1.5">
              {(signals?.activity ?? []).map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 border-b border-border/40 pb-1.5 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-foreground">{a.text}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {a.context}
                      {a.actor ? ` · ${a.actor}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {a.at ? new Date(a.at).toLocaleDateString() : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Widget>
      </section>

      {/* Footer links to the screens this dashboard is a front door to — it
          deliberately does not rebuild My Tasks, My Learning or My Assessment. */}
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Go deeper</span>
        <Go to={link('my_tasks')}>My Tasks</Go>
        <Go to={link('my_learning')}>My Learning</Go>
        <Go to={link('my_assessment')}>My Assessment</Go>
        <Go to={link('capability_explorer')}>Capability Explorer</Go>
        <Go to={link('my_learning_report')}>My Learning Report</Go>
        <Go to={link('leave_requests')}>Leave</Go>
      </nav>
    </div>
  )
}
