'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import {
  Briefcase,
  Users,
  UserPlus,
  TrendingUp,
  ArrowRightLeft,
  LogOut,
  MoreHorizontal,
  ChevronRight,
  Clock,
  Calendar,
  FileText,
  Filter,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  Link as LinkIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { DatePicker } from '@/components/ui/date-picker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTalentDashboard, toDateParam } from '@/hooks/use-talent-dashboard'
import type {
  TalentActionItem,
  TalentActivityEntry,
  TalentPipelineStage,
  TalentTone,
} from '@/types/talent-dashboard'
import { cn } from '@/lib/utils'

/* ── formatting ───────────────────────────────────────────────────────────── */

const numberFormat = new Intl.NumberFormat('en-IN')

/** Counts are always real; a null only ever reaches the "no data" branches. */
function formatCount(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : numberFormat.format(value)
}

/** "30m ago" / "2h ago" / "5d ago" - the activity feed's timestamp column. */
function relativeTime(value: string | null) {
  if (!value) return ''

  const then = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(then.getTime())) return ''

  const seconds = Math.floor((Date.now() - then.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`

  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(then)
}

function formatPeriod(start: string | null, end: string | null) {
  if (!start && !end) return null

  const format = (value: string | null) => {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
  }

  return `${format(start)} - ${format(end)}`
}

const TONE_TEXT: Record<TalentTone, string> = {
  danger: 'text-destructive',
  warning: 'text-warning',
  primary: 'text-primary',
  success: 'text-success',
  neutral: 'text-muted-foreground',
}

const TONE_BADGE: Record<TalentTone, string> = {
  danger: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
  warning: 'bg-warning/10 text-warning hover:bg-warning/20',
  primary: 'bg-primary/10 text-primary hover:bg-primary/20',
  success: 'bg-success/10 text-success hover:bg-success/20',
  neutral: 'bg-muted text-muted-foreground hover:bg-muted/80',
}

/* ── donut ────────────────────────────────────────────────────────────────── */

const DonutChart = ({
  percentage,
  colorClass,
  label,
}: {
  percentage: number
  colorClass: string
  label: string
}) => {
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (Math.max(0, Math.min(100, percentage)) / 100) * circumference

  return (
    <div className="relative flex items-center justify-center size-32 shrink-0">
      <svg className="size-full transform -rotate-90" role="img" aria-label={`${percentage}% ${label}`}>
        <circle cx="64" cy="64" r={radius} stroke="currentColor" strokeWidth="16" fill="transparent" className="text-muted" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          stroke="currentColor"
          strokeWidth="16"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn('transition-all duration-1000 ease-in-out', colorClass)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl font-bold text-foreground">{percentage}%</span>
        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{label}</span>
      </div>
    </div>
  )
}

/** One legend row under a donut, with its share of the total. */
function LegendRow({ swatch, label, value, total }: { swatch: string; label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <div className={cn('size-2.5 rounded-sm', swatch)} />
        <span className="text-xs font-bold text-muted-foreground">{label}</span>
      </div>
      <span className="text-xs font-bold text-foreground">{pct}% ({numberFormat.format(value)})</span>
    </div>
  )
}

/* ── KPI card ─────────────────────────────────────────────────────────────── */

interface KpiCardProps {
  icon: React.ReactNode
  title: string
  value: number
  footer: string
  footerTone: string
  onClick: () => void
}

function KpiCard({ icon, title, value, footer, footerTone, onClick }: KpiCardProps) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={onClick}
          className="flex w-full flex-col p-5 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl cursor-pointer"
        >
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            {icon}
            <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
          </div>
          <div className="text-3xl font-bold text-foreground mb-3">{formatCount(value)}</div>
          <div className={cn('flex items-center justify-between text-xs font-bold', footerTone)}>
            <span>{footer}</span>
            <ChevronRight className="size-3 text-muted-foreground" />
          </div>
        </button>
      </CardContent>
    </Card>
  )
}

/* ── skeleton ─────────────────────────────────────────────────────────────── */

function DashboardSkeleton() {
  return (
    <div className="flex flex-col w-full pb-12" aria-busy="true" aria-label="Loading talent dashboard">
      <Skeleton className="h-9 w-64 mb-2" />
      <Skeleton className="h-4 w-96 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-[132px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-[280px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-[340px]" />
        ))}
      </div>
    </div>
  )
}

/* ── page ─────────────────────────────────────────────────────────────────── */

/** Menus without submenus route to themselves - see getRoutePath in the shell. */
function moduleHref(menuId: string, query?: string) {
  return `/module/talent-management/${menuId}/${menuId}${query ? `?${query}` : ''}`
}

export function TalentDashboard() {
  const router = useRouter()
  const {
    data,
    options,
    filters,
    setFilter,
    setRange,
    resetFilters,
    rangeLabel,
    loading,
    fetching,
    optionsLoading,
    error,
    unauthenticated,
    refresh,
  } = useTalentDashboard()

  const go = React.useCallback(
    (menuId: string, query?: string) => router.push(moduleHref(menuId, query)),
    [router],
  )

  const departmentOptions = React.useMemo(
    () => [
      { label: 'All', value: 'all' },
      ...(options?.departments ?? []).map((department) => ({
        label: department.department,
        value: String(department.id),
      })),
    ],
    [options],
  )

  const locationOptions = React.useMemo(
    () => [
      { label: 'All', value: 'all' },
      ...(options?.locations ?? []).map((location) => ({ label: location, value: location })),
    ],
    [options],
  )

  const quickLinks: { label: string; icon: React.ReactNode; run: () => void }[] = React.useMemo(
    () => [
      // Requisitions and job openings are the same entity in this backend
      // (/talent-acquisition/requisitions reads talent_job_postings), so both
      // links open the job posting form - they differ only in landing tab.
      { label: 'Create Requisition', icon: <Briefcase className="size-3.5" />, run: () => go('recruitment', 'tab=requisitions&action=job') },
      { label: 'Post a Job', icon: <FileText className="size-3.5" />, run: () => go('recruitment', 'tab=job-openings&action=job') },
      { label: 'Add Candidate', icon: <UserPlus className="size-3.5" />, run: () => go('recruitment', 'tab=candidates&action=candidate') },
      { label: 'Schedule Interview', icon: <Calendar className="size-3.5" />, run: () => go('recruitment', 'tab=interviews&action=interview') },
      { label: 'Launch Review Cycle', icon: <TrendingUp className="size-3.5" />, run: () => go('performance') },
      { label: 'Internal Job Posting', icon: <ArrowRightLeft className="size-3.5" />, run: () => go('mobility-succession') },
      { label: 'Onboarding Checklist', icon: <CheckCircle2 className="size-3.5" />, run: () => go('onboarding') },
      { label: 'Initiate Exit', icon: <LogOut className="size-3.5" />, run: () => go('offboarding') },
    ],
    [go],
  )

  if (unauthenticated) {
    return (
      <ErrorState
        title="Session unavailable"
        description="Your Laravel session has expired. Sign in again to load the talent dashboard."
      />
    )
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Could not load the talent dashboard"
        description={error ?? 'The dashboard returned no data.'}
        retry={() => void refresh()}
      />
    )
  }

  const { kpis, pipeline, performance_cycle: cycle, onboarding_progress: onboarding, action_items: actionItems, activity } = data

  const pipelineTotal = pipeline.stages.reduce((sum, stage) => sum + stage.value, 0)
  const cyclePeriod = formatPeriod(cycle.period_start, cycle.period_end)

  const trendLabel =
    kpis.candidate_trend_pct === null
      ? 'No prior period to compare'
      : `${kpis.candidate_trend_pct >= 0 ? '▲' : '▼'} ${Math.abs(kpis.candidate_trend_pct)}% vs previous period`

  const trendTone =
    kpis.candidate_trend_pct === null
      ? 'text-muted-foreground'
      : kpis.candidate_trend_pct >= 0
        ? 'text-success'
        : 'text-destructive'

  /** Funnel bar widths, proportional to real stage values. */
  const stageWidth = (stage: TalentPipelineStage) =>
    pipelineTotal > 0 ? `${(stage.value / pipelineTotal) * 100}%` : '20%'

  return (
    <div className="flex flex-col w-full bg-background pb-12">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Talent Dashboard
            {fetching && <RefreshCw className="size-4 animate-spin text-muted-foreground" aria-label="Refreshing" />}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            Real-time overview of your talent lifecycle and key workforce activities.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Business Unit</span>
            {/*
              Disabled on purpose: no business unit master exists in this
              schema, and the API says so explicitly rather than the UI
              guessing. Populating it from departments would be a lie.
            */}
            <Select
              options={[{ label: 'Not configured', value: 'all' }]}
              value="all"
              onChange={() => {}}
              disabled
              aria-label="Business Unit (not available in this workspace)"
              className="w-32 h-9"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Department</span>
            <Select
              options={departmentOptions}
              value={filters.departmentId}
              onChange={(value) => setFilter('departmentId', value)}
              disabled={optionsLoading}
              aria-label="Filter by department"
              className="w-32 h-9"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Location</span>
            <Select
              options={locationOptions}
              value={filters.location}
              onChange={(value) => setFilter('location', value)}
              disabled={optionsLoading}
              aria-label="Filter by location"
              className="w-32 h-9"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground invisible">Date</span>
            <div className="flex items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 font-medium shadow-sm bg-card justify-between w-[200px]">
                    {rangeLabel} <Calendar className="size-4 text-muted-foreground ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="end">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">From</span>
                      <DatePicker
                        value={filters.from}
                        onChange={(date) => {
                          if (date instanceof Date) setRange(toDateParam(date), filters.to)
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">To</span>
                      <DatePicker
                        value={filters.to}
                        onChange={(date) => {
                          if (date instanceof Date) setRange(filters.from, toDateParam(date))
                        }}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9 ml-2 shrink-0" aria-label="Dashboard actions">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => void refresh()}>
                    <RefreshCw className="size-4" /> Refresh data
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={resetFilters}>
                    <RotateCcw className="size-4" /> Reset filters
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Top KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <KpiCard
          icon={<Briefcase className="size-4" />}
          title="Open Positions"
          value={kpis.open_positions}
          footer={`${formatCount(kpis.critical_positions)} Critical`}
          footerTone="text-destructive"
          onClick={() => go('recruitment', 'tab=job-openings')}
        />
        <KpiCard
          icon={<Users className="size-4" />}
          title="Candidate Pipeline"
          value={kpis.candidates}
          footer={trendLabel}
          footerTone={trendTone}
          onClick={() => go('recruitment', 'tab=candidates')}
        />
        <KpiCard
          icon={<UserPlus className="size-4" />}
          title="Onboarding"
          value={kpis.onboarding}
          footer={`${formatCount(kpis.preboarding)} Preboarding`}
          footerTone="text-primary"
          onClick={() => go('onboarding')}
        />
        <KpiCard
          icon={<TrendingUp className="size-4" />}
          title="Performance"
          value={kpis.performance}
          footer={`${formatCount(kpis.pending_reviews)} Pending Reviews`}
          footerTone="text-warning"
          onClick={() => go('performance')}
        />
        <KpiCard
          icon={<ArrowRightLeft className="size-4" />}
          title="Mobility"
          value={kpis.mobility}
          footer={`${formatCount(kpis.mobility_applications)} Applications`}
          footerTone="text-primary"
          onClick={() => go('mobility-succession')}
        />
        <KpiCard
          icon={<LogOut className="size-4" />}
          title="Offboarding"
          value={kpis.offboarding}
          footer={`${formatCount(kpis.clearances_pending)} Clearances Pending`}
          footerTone="text-destructive"
          onClick={() => go('offboarding')}
        />
      </div>

      {/* Middle Dashboard Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Hiring Pipeline */}
        <Card className="shadow-sm col-span-1 flex flex-col">
          <CardHeader className="pb-2 pt-5 px-5 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-bold text-foreground">Hiring Pipeline Overview</CardTitle>
            </div>
            <button
              type="button"
              onClick={() => go('recruitment', 'tab=requisitions')}
              className="text-xs font-bold text-primary cursor-pointer hover:underline"
            >
              View Details
            </button>
          </CardHeader>
          <CardContent className="p-5 pt-4 flex-1 flex flex-col">
            <div className="flex-1">
              <div className="flex items-end justify-between px-2 mb-3">
                {pipeline.stages.map((stage) => (
                  <div key={stage.key} className="flex flex-col items-center gap-2">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{stage.label}</span>
                    <span className="text-xl font-bold text-foreground">{numberFormat.format(stage.value)}</span>
                  </div>
                ))}
              </div>
              {/* Funnel bar - widths are the real stage shares, not fixed. */}
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex mb-8 mt-4">
                {pipeline.stages.map((stage, index) => (
                  <div
                    key={stage.key}
                    className={cn('h-full', ['bg-primary/20', 'bg-primary/40', 'bg-primary/60', 'bg-primary/80', 'bg-primary'][index])}
                    style={{ width: stageWidth(stage) }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-auto">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Average Time to Hire</span>
                <span className="text-sm font-bold text-foreground mt-1">
                  {pipeline.avg_time_to_hire_days === null ? 'No hires yet' : `${pipeline.avg_time_to_hire_days} Days`}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Offer Acceptance Rate</span>
                <span className={cn('text-sm font-bold mt-1', pipeline.offer_acceptance_rate === null ? 'text-muted-foreground' : 'text-success')}>
                  {pipeline.offer_acceptance_rate === null ? 'No offers extended' : `${pipeline.offer_acceptance_rate}%`}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Cycle Progress */}
        <Card className="shadow-sm col-span-1 flex flex-col">
          <CardHeader className="pb-2 pt-5 px-5 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-bold text-foreground">Performance Cycle Progress</CardTitle>
            </div>
            <button
              type="button"
              onClick={() => go('performance')}
              className="text-xs font-bold text-primary cursor-pointer hover:underline"
            >
              View Details
            </button>
          </CardHeader>
          <CardContent className="p-5 pt-4 flex-1 flex flex-col justify-between">
            {cycle.total === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
                <Clock className="size-6 text-muted-foreground/60" />
                <p className="text-sm font-medium text-foreground">No reviews in this cycle yet</p>
                <p className="text-xs text-muted-foreground">
                  {cycle.cycle_name ? `${cycle.cycle_name} has no employee reviews.` : 'No review cycle has been created.'}
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-8 flex-1">
                <DonutChart percentage={cycle.completed_pct} colorClass="text-slate-700" label="Completed" />
                <div className="flex flex-col gap-3">
                  <LegendRow swatch="bg-slate-700" label="Completed" value={cycle.completed} total={cycle.total} />
                  <LegendRow swatch="bg-muted-foreground/40" label="In Progress" value={cycle.in_progress} total={cycle.total} />
                  <LegendRow swatch="bg-muted/60" label="Not Started" value={cycle.not_started} total={cycle.total} />
                </div>
              </div>
            )}
            <div className="flex flex-col items-center justify-center border-t border-border/40 pt-4 mt-6">
              <span className="text-xs font-bold text-foreground">
                {cycle.cycle_name ? `Cycle: ${cycle.cycle_name}` : 'No active cycle'}
              </span>
              {cyclePeriod && <span className="text-xs text-muted-foreground mt-0.5">{cyclePeriod}</span>}
            </div>
          </CardContent>
        </Card>

        {/* Onboarding Progress */}
        <Card className="shadow-sm col-span-1 flex flex-col">
          <CardHeader className="pb-2 pt-5 px-5 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-bold text-foreground">Onboarding Progress</CardTitle>
            </div>
            <button
              type="button"
              onClick={() => go('onboarding')}
              className="text-xs font-bold text-primary cursor-pointer hover:underline"
            >
              View Details
            </button>
          </CardHeader>
          <CardContent className="p-5 pt-4 flex-1 flex flex-col justify-between">
            {onboarding.total === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
                <UserPlus className="size-6 text-muted-foreground/60" />
                <p className="text-sm font-medium text-foreground">No onboarding journeys yet</p>
                <p className="text-xs text-muted-foreground">New hires will appear here once a journey is created.</p>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-8 flex-1">
                <DonutChart percentage={onboarding.completed_pct} colorClass="text-slate-600" label="Completed" />
                <div className="flex flex-col gap-3">
                  <LegendRow swatch="bg-slate-600" label="Completed" value={onboarding.completed} total={onboarding.total} />
                  <LegendRow swatch="bg-muted-foreground/40" label="In Progress" value={onboarding.in_progress} total={onboarding.total} />
                  <LegendRow swatch="bg-muted/60" label="Not Started" value={onboarding.not_started} total={onboarding.total} />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-6">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Average Onboarding Completion Time
              </span>
              <span className={cn('text-sm font-bold mt-1', onboarding.avg_completion_days === null ? 'text-muted-foreground' : 'text-success')}>
                {onboarding.avg_completion_days === null ? 'No data' : `${onboarding.avg_completion_days} Days`}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Dashboard Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Action Items */}
        <Card className="shadow-sm col-span-1 flex flex-col">
          <CardHeader className="pb-2 pt-5 px-5 flex flex-row items-center justify-between border-b border-border/40">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-bold text-foreground">My Action Items</CardTitle>
            </div>
            <button
              type="button"
              onClick={() => go('recruitment')}
              className="text-xs font-bold text-primary cursor-pointer hover:underline"
            >
              View All
            </button>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col">
            <div className="flex flex-col divide-y divide-border/40">
              {actionItems.map((item: TalentActionItem) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => go(item.menu)}
                  className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer group text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <div className="flex items-center gap-3">
                    <ActionIcon actionKey={item.key} />
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className={cn('font-bold border-0', item.count === 0 ? TONE_BADGE.neutral : TONE_BADGE[item.tone])}>
                      {numberFormat.format(item.count)}
                    </Badge>
                    <span className={cn('text-xs font-bold flex items-center gap-1 group-hover:underline', item.count === 0 ? 'text-muted-foreground' : TONE_TEXT[item.tone])}>
                      {item.count === 0 ? 'All clear' : 'Open'} <ChevronRight className="size-3" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card className="shadow-sm col-span-1 flex flex-col">
          <CardHeader className="pb-2 pt-5 px-5 flex flex-row items-center justify-between border-b border-border/40">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-bold text-foreground">Recent Activities</CardTitle>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              className="text-xs font-bold text-primary cursor-pointer hover:underline"
            >
              Refresh
            </button>
          </CardHeader>
          <CardContent className="p-5 flex-1 flex flex-col gap-6">
            {activity.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
                <TrendingUp className="size-6 text-muted-foreground/60" />
                <p className="text-sm font-medium text-foreground">No recent activity</p>
                <p className="text-xs text-muted-foreground">Actions across the talent modules will appear here.</p>
              </div>
            ) : (
              activity.map((entry: TalentActivityEntry) => (
                <div key={entry.id} className="flex gap-4">
                  <div
                    className={cn(
                      'size-8 rounded-full flex items-center justify-center shrink-0 border',
                      entry.tone === 'success' && 'bg-success/10 border-success/20',
                      entry.tone === 'danger' && 'bg-destructive/10 border-destructive/20',
                      (entry.tone === 'neutral' || entry.tone === 'primary' || entry.tone === 'warning') && 'bg-muted border-border/60',
                    )}
                  >
                    <ActivityIcon entry={entry} />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-medium text-foreground">{entry.text}</span>
                    {entry.context && <span className="text-xs font-bold text-muted-foreground">{entry.context}</span>}
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground ml-auto whitespace-nowrap">
                    {relativeTime(entry.at)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card className="shadow-sm col-span-1 flex flex-col">
          <CardHeader className="pb-2 pt-5 px-5 flex flex-row items-center justify-between border-b border-border/40">
            <div className="flex items-center gap-2">
              <LinkIcon className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-bold text-foreground">Quick Links</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-5 flex-1 flex flex-col justify-center">
            <div className="grid grid-cols-2 gap-3">
              {quickLinks.map((link) => (
                <Button
                  key={link.label}
                  variant="outline"
                  onClick={link.run}
                  className="h-12 justify-start gap-3 shadow-sm hover:border-primary/40 font-medium"
                >
                  <div className="size-6 rounded-md bg-muted flex items-center justify-center border border-border/60">
                    {link.icon}
                  </div>
                  {link.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ── small presentational helpers ─────────────────────────────────────────── */

function ActionIcon({ actionKey }: { actionKey: string }) {
  const className = 'size-4 text-muted-foreground'

  switch (actionKey) {
    case 'requisitions':
      return <FileText className={className} />
    case 'interviews':
      return <Briefcase className={className} />
    case 'offers':
      return <LogOut className={className} />
    case 'reviews':
      return <Users className={className} />
    case 'onboarding':
      return <UserPlus className={className} />
    default:
      return <CheckCircle2 className={className} />
  }
}

function ActivityIcon({ entry }: { entry: TalentActivityEntry }) {
  if (entry.tone === 'success') return <CheckCircle2 className="size-3.5 text-success" />
  if (entry.tone === 'danger') return <AlertCircle className="size-3.5 text-destructive" />

  switch (entry.type) {
    case 'application':
      return <Users className="size-3.5 text-muted-foreground" />
    case 'offer':
      return <Briefcase className="size-3.5 text-muted-foreground" />
    case 'performance':
      return <FileText className="size-3.5 text-muted-foreground" />
    case 'onboarding':
      return <UserPlus className="size-3.5 text-muted-foreground" />
    case 'mobility':
      return <ArrowRightLeft className="size-3.5 text-muted-foreground" />
    default:
      return <LogOut className="size-3.5 text-muted-foreground" />
  }
}
