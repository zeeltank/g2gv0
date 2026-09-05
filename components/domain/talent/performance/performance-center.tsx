'use client'

/**
 * Talent Management -> Performance & Rewards Center.
 *
 * Fully wired to the /api/performance/* Laravel module (see
 * services/talent/performance.ts). Every element on this screen is live: the
 * cycle selector, the Actions menu, Create / Launch, all 7 KPI cards, the 6
 * domain tabs, the filter bar and More-Filters sheet, Saved Views, the 3 view
 * modes (Employee List / Review Board / Cycle Timeline), bulk actions, server
 * search + sort + paging, the row action menu, the 5 activity tabs and the whole
 * Employee Overview sidebar.
 *
 * Tab ids are explicit constants, never derived from the visible labels - that
 * derivation is what silently broke the tabs on two sibling screens.
 */

import * as React from 'react'
import {
  Bookmark,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Filter,
  Gift,
  History,
  Info,
  KanbanSquare,
  LayoutList,
  MoreHorizontal,
  Plus,
  Scale,
  Search,
  Send,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import {
  useCalibrationGrid,
  usePerformanceAppraisals,
  usePerformanceBoard,
  usePerformanceBonus,
  usePerformanceCalibration,
  usePerformanceCompensation,
  usePerformanceFilters,
  usePerformanceGoals,
  usePerformanceMutations,
  usePerformanceOverview,
  usePerformanceReviews,
  usePerformanceTimeline,
  useReviewActivity,
  useReviewDetail,
  useSavedViews,
  type ActivityTab,
  type MutationResult,
} from '@/hooks/use-performance'
import {
  performanceService,
  type CyclePayload,
  type PerfKpiIcon,
  type PerfReview,
  type PerfTab,
  type ReviewStage,
} from '@/services/talent/performance'
import { getLaravelContext } from '@/lib/laravel-context'
import { useAuth } from '@/hooks/use-auth'

import {
  AppraisalsTab,
  BonusTab,
  CalibrationTab,
  CompensationTab,
  GoalsTab,
} from './performance-tabs'
import { PerformanceSidebar, type SidebarTabId } from './performance-sidebar'
import { NineBoxGrid } from './nine-box-grid'
import {
  EmployeeCell,
  PaginationBar,
  RatingCell,
  ResultBanner,
  SortableHead,
  StatusBadge,
  TableLoadingRows,
  TableMessageRow,
  reviewStatusVariant,
  stageVariant,
} from './performance-shared'

/* ------------------------------------------------------------------ *
 * Constants - explicit ids, never derived from labels
 * ------------------------------------------------------------------ */

const MAIN_TABS = [
  { id: 'goals', label: 'Goals' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'appraisals', label: 'Appraisals' },
  { id: 'compensation', label: 'Compensation' },
  { id: 'bonus', label: 'Bonus' },
  { id: 'calibration', label: 'Calibration' },
  /*
   * The capability axis, at last.
   *
   * `NineBoxController` has been correct, routed and guarded for some time and
   * NOTHING CALLED IT - there was no reference to `nine-box` anywhere in this
   * app. Mounted as a tab here rather than behind a new menu row, which would
   * mean a schema change on both databases plus a rights grant per tenant.
   *
   * Distinct from Calibration: that grid is a RATING DISTRIBUTION across a
   * review session; this one is performance against measured capability.
   */
  { id: 'nine-box', label: '9-Box' },
] as const

type MainTabId = (typeof MAIN_TABS)[number]['id']

const VIEW_MODES = [
  { id: 'list', label: 'Employee List', icon: LayoutList },
  { id: 'board', label: 'Review Board', icon: KanbanSquare },
  { id: 'timeline', label: 'Cycle Timeline', icon: History },
] as const

type ViewModeId = (typeof VIEW_MODES)[number]['id']

const ACTIVITY_TABS: Array<{ id: ActivityTab; label: string }> = [
  { id: 'feed', label: 'Activity Feed' },
  { id: 'comments', label: 'Comments' },
  { id: 'notes', label: 'Notes' },
  { id: 'attachments', label: 'Attachments' },
  { id: 'audit', label: 'Audit Trail' },
]

const ALL = 'all'

const KPI_ICONS: Record<PerfKpiIcon, React.ComponentType<{ className?: string }>> = {
  calendar: Calendar,
  users: Users,
  'user-clock': Clock,
  'user-check': UserCheck,
  scale: Scale,
  'check-circle': CheckCircle2,
  gift: Gift,
}

interface SharedFilterState {
  search: string
  department_id: string
  manager_id: string
  status: string
  stage: string
  jobrole: string
  rating_min: string
  rating_max: string
  overdue_only: string
  sort_by: string
  sort_dir: 'asc' | 'desc'
  page: number
  per_page: number
}

const INITIAL_SHARED: SharedFilterState = {
  search: '',
  department_id: ALL,
  manager_id: ALL,
  status: ALL,
  stage: ALL,
  jobrole: ALL,
  rating_min: '',
  rating_max: '',
  overdue_only: '',
  sort_by: 'due_date',
  sort_dir: 'asc',
  page: 1,
  per_page: 25,
}

/** Strips the sentinel 'all' and blank values before the query is built. */
function activeFilters(state: Record<string, string | number>) {
  const result: Record<string, string | number> = {}

  for (const [key, value] of Object.entries(state)) {
    if (value === ALL || value === '' || value === null || value === undefined) continue
    result[key] = value
  }

  return result
}

function withAll(options: Array<{ value: string; label: string }>, allLabel: string) {
  return [{ value: ALL, label: allLabel }, ...options]
}

/* ================================================================== *
 * Screen
 * ================================================================== */

export function PerformanceCenter() {
  const { user } = useAuth()

  /* -- Header state -- */
  const [cycleId, setCycleId] = React.useState<string>('')
  const [cycleTouched, setCycleTouched] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<MainTabId>('reviews')
  const [viewMode, setViewMode] = React.useState<ViewModeId>('list')
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [result, setResult] = React.useState<MutationResult | null>(null)

  const bumpRefresh = React.useCallback(() => setRefreshKey((value) => value + 1), [])

  const report = React.useCallback(
    async (operation: Promise<MutationResult>) => {
      const outcome = await operation
      setResult(outcome)
      if (outcome.ok) bumpRefresh()
      return outcome
    },
    [bumpRefresh],
  )

  /* -- Filter options + default cycle -- */
  const { options, defaultCycleId, loading: optionsLoading, error: optionsError, retry: retryOptions } =
    usePerformanceFilters()

  // Adopt the API's default cycle once, and only until the user picks one.
  const effectiveCycleId = cycleTouched ? cycleId : cycleId || defaultCycleId || ''

  /* -- Shared filter bar (Reviews view) -- */
  const [shared, setShared] = React.useState<SharedFilterState>(INITIAL_SHARED)
  const [moreFiltersOpen, setMoreFiltersOpen] = React.useState(false)
  const [savedViewsOpen, setSavedViewsOpen] = React.useState(false)
  const [actionsOpen, setActionsOpen] = React.useState(false)
  const [cycleDialogOpen, setCycleDialogOpen] = React.useState(false)
  const [launchDialogOpen, setLaunchDialogOpen] = React.useState(false)
  const [teamDetailsOpen, setTeamDetailsOpen] = React.useState(false)

  const patchShared = React.useCallback((patch: Partial<SharedFilterState>) => {
    setShared((state) => ({ ...state, ...patch }))
  }, [])

  /* -- Per-tab filter state -- */
  const [goalFilters, setGoalFilters] = React.useState({
    search: '',
    department_id: ALL,
    category: ALL,
    goal_status: ALL,
    sort_by: 'due_date',
    sort_dir: 'asc' as 'asc' | 'desc',
    page: 1,
    per_page: 25,
  })
  const [appraisalFilters, setAppraisalFilters] = React.useState({
    search: '',
    department_id: ALL,
    recommendation: ALL,
    status: ALL,
    sort_by: 'created_at',
    sort_dir: 'desc' as 'asc' | 'desc',
    page: 1,
    per_page: 25,
  })
  const [compFilters, setCompFilters] = React.useState({
    search: '',
    department_id: ALL,
    revision_type: ALL,
    status: ALL,
    sort_by: 'created_at',
    sort_dir: 'desc' as 'asc' | 'desc',
    page: 1,
    per_page: 25,
  })
  const [bonusFilters, setBonusFilters] = React.useState({
    search: '',
    department_id: ALL,
    bonus_type: ALL,
    status: ALL,
    payout_month: ALL,
    sort_by: 'created_at',
    sort_dir: 'desc' as 'asc' | 'desc',
    page: 1,
    per_page: 25,
  })
  const [calibrationFilters, setCalibrationFilters] = React.useState({
    search: '',
    department_id: ALL,
    status: ALL,
    sort_by: 'scheduled_at',
    sort_dir: 'asc' as 'asc' | 'desc',
    page: 1,
    per_page: 25,
  })

  /* -- Data -- */
  const reviewQuery = React.useMemo(
    () => activeFilters({ ...shared, cycle_id: effectiveCycleId }),
    [shared, effectiveCycleId],
  )

  const { kpis, loading: kpisLoading, error: kpisError, retry: retryKpis } = usePerformanceOverview(
    effectiveCycleId || undefined,
    refreshKey,
  )

  const {
    reviews,
    pagination: reviewPagination,
    loading: reviewsLoading,
    error: reviewsError,
    retry: retryReviews,
  } = usePerformanceReviews(reviewQuery, refreshKey)

  const {
    columns: boardColumns,
    loading: boardLoading,
    error: boardError,
    retry: retryBoard,
  } = usePerformanceBoard(reviewQuery, activeTab === 'reviews' && viewMode === 'board', refreshKey)

  const {
    cycles: timelineCycles,
    loading: timelineLoading,
    error: timelineError,
    retry: retryTimeline,
  } = usePerformanceTimeline(effectiveCycleId || undefined, activeTab === 'reviews' && viewMode === 'timeline', refreshKey)

  const goalsQuery = React.useMemo(
    () => activeFilters({ ...goalFilters, cycle_id: effectiveCycleId }),
    [goalFilters, effectiveCycleId],
  )
  const goalsState = usePerformanceGoals(goalsQuery, activeTab === 'goals', refreshKey)

  const appraisalsQuery = React.useMemo(
    () => activeFilters({ ...appraisalFilters, cycle_id: effectiveCycleId }),
    [appraisalFilters, effectiveCycleId],
  )
  const appraisalsState = usePerformanceAppraisals(appraisalsQuery, activeTab === 'appraisals', refreshKey)

  const compQuery = React.useMemo(
    () => activeFilters({ ...compFilters, cycle_id: effectiveCycleId }),
    [compFilters, effectiveCycleId],
  )
  const compState = usePerformanceCompensation(compQuery, activeTab === 'compensation', refreshKey)

  const bonusQuery = React.useMemo(
    () => activeFilters({ ...bonusFilters, cycle_id: effectiveCycleId }),
    [bonusFilters, effectiveCycleId],
  )
  const bonusState = usePerformanceBonus(bonusQuery, activeTab === 'bonus', refreshKey)

  const calibrationQuery = React.useMemo(
    () => activeFilters({ ...calibrationFilters, cycle_id: effectiveCycleId }),
    [calibrationFilters, effectiveCycleId],
  )
  const calibrationState = usePerformanceCalibration(calibrationQuery, activeTab === 'calibration', refreshKey)

  const [openSessionId, setOpenSessionId] = React.useState<number | null>(null)
  const gridState = useCalibrationGrid(openSessionId, refreshKey)

  /* -- Selection + sidebar -- */
  const [selectedIds, setSelectedIds] = React.useState<number[]>([])
  const [activeReviewId, setActiveReviewId] = React.useState<number | null>(null)
  const [sidebarTab, setSidebarTab] = React.useState<SidebarTabId>('overview')
  const [activityTab, setActivityTab] = React.useState<ActivityTab>('feed')
  /**
   * The design opens the first row's panel by default, but the panel also has an
   * X. Without this flag the auto-open would fire again on the very next render
   * and the close button would appear broken.
   */
  const [panelDismissed, setPanelDismissed] = React.useState(false)

  if (activeReviewId === null && !panelDismissed && reviews.length > 0) {
    setActiveReviewId(reviews[0].id)
  }

  const openPanel = React.useCallback((reviewId: number) => {
    setPanelDismissed(false)
    setActiveReviewId(reviewId)
    setSidebarTab('overview')
  }, [])

  const closePanel = React.useCallback(() => {
    setPanelDismissed(true)
    setActiveReviewId(null)
  }, [])

  const detailState = useReviewDetail(activeReviewId, refreshKey)
  const activityState = useReviewActivity(activeReviewId, activityTab, refreshKey)

  // Sidebar panel data, loaded only for the tab that is open.
  const sidebarGoals = usePerformanceGoals(
    React.useMemo(
      () =>
        activeFilters({
          user_id_filter: detailState.detail ? String(detailState.detail.employee.id) : '',
          cycle_id: effectiveCycleId,
          per_page: 50,
        }),
      [detailState.detail, effectiveCycleId],
    ),
    sidebarTab === 'goals' && Boolean(detailState.detail),
    refreshKey,
  )

  const sidebarComp = usePerformanceCompensation(
    React.useMemo(
      () =>
        activeFilters({
          user_id_filter: detailState.detail ? String(detailState.detail.employee.id) : '',
          per_page: 50,
        }),
      [detailState.detail],
    ),
    sidebarTab === 'compensation' && Boolean(detailState.detail),
    refreshKey,
  )

  const sidebarAttachments = useReviewActivity(
    sidebarTab === 'docs' ? activeReviewId : null,
    'attachments',
    refreshKey,
  )

  /*
   * The 9-box has no filters, so it has no saved views — and `PerfTab` is the
   * SERVER's vocabulary for tabs that do. Widening that type to include
   * 'nine-box' would have made the type compile while sending the server a tab
   * name it does not know. The grid keeps whichever tab's views were last
   * loaded, which nothing on that tab reads.
   */
  const savedViewsTab: PerfTab = activeTab === 'nine-box' ? 'reviews' : activeTab
  const savedViewsState = useSavedViews(savedViewsTab, refreshKey)
  const mutations = usePerformanceMutations()

  const activeCycle = options?.cycles.find((cycle) => cycle.value === effectiveCycleId)

  /* -- Handlers -- */

  const toggleRow = (id: number) =>
    setSelectedIds((state) => (state.includes(id) ? state.filter((value) => value !== id) : [...state, id]))

  const allRowsSelected = reviews.length > 0 && selectedIds.length === reviews.length

  const sortReviews = (column: string) =>
    patchShared({
      sort_by: column,
      sort_dir: shared.sort_by === column && shared.sort_dir === 'asc' ? 'desc' : 'asc',
      page: 1,
    })

  const applySavedView = (filters: Record<string, string>) => {
    setShared((state) => ({ ...INITIAL_SHARED, sort_by: state.sort_by, sort_dir: state.sort_dir, ...filters }))
    setSavedViewsOpen(false)
  }

  const activeFilterCount = React.useMemo(() => {
    let count = 0
    if (shared.department_id !== ALL) count += 1
    if (shared.manager_id !== ALL) count += 1
    if (shared.status !== ALL) count += 1
    if (shared.stage !== ALL) count += 1
    if (shared.jobrole !== ALL) count += 1
    if (shared.rating_min) count += 1
    if (shared.rating_max) count += 1
    if (shared.overdue_only) count += 1
    return count
  }, [shared])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto pb-8 pr-2 custom-scrollbar">
        {/* ============================= Header ============================= */}
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Performance &amp; Rewards Center</h1>
              <Tooltip
                side="bottom"
                content="Goals, reviews, ratings, appraisals and reward decisions for the selected review cycle. Stage transitions and approvals are recorded in the Audit Trail."
              >
                <button type="button" aria-label="About this screen">
                  <Info className="size-4 text-muted-foreground" />
                </button>
              </Tooltip>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage goals, performance reviews, ratings, appraisals and reward decisions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-[240px]">
              {optionsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select
                  value={effectiveCycleId}
                  placeholder="Select review cycle"
                  options={
                    options?.cycles.map((cycle) => ({
                      value: cycle.value,
                      label: cycle.period_label ? `${cycle.label} (${cycle.period_label})` : cycle.label,
                    })) ?? []
                  }
                  onChange={(value) => {
                    setCycleTouched(true)
                    setCycleId(value)
                    setActiveReviewId(null)
                    setSelectedIds([])
                  }}
                  aria-label="Review cycle"
                />
              )}
            </div>

            {/* Actions menu */}
            <div className="relative">
              <Button variant="outline" className="gap-2" onClick={() => setActionsOpen((value) => !value)}>
                Actions <ChevronDown className="size-3" />
              </Button>
              {actionsOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setActionsOpen(false)} />
                  <div className="absolute right-0 top-11 z-30 w-60 overflow-hidden rounded-lg border bg-background shadow-lg">
                    <MenuItem
                      label="Launch reviews for this cycle"
                      disabled={!effectiveCycleId}
                      onSelect={() => {
                        setActionsOpen(false)
                        setLaunchDialogOpen(true)
                      }}
                    />
                    <MenuItem
                      label="Close this cycle"
                      disabled={!effectiveCycleId || mutations.saving}
                      onSelect={() => {
                        setActionsOpen(false)
                        report(mutations.closeCycle(Number(effectiveCycleId)))
                      }}
                    />
                    <MenuItem
                      label="Close this cycle (force)"
                      disabled={!effectiveCycleId || mutations.saving}
                      onSelect={() => {
                        setActionsOpen(false)
                        report(mutations.closeCycle(Number(effectiveCycleId), true))
                      }}
                    />
                    <MenuItem
                      label="Refresh all data"
                      onSelect={() => {
                        setActionsOpen(false)
                        bumpRefresh()
                      }}
                    />
                    <MenuItem
                      label="Delete this cycle"
                      danger
                      disabled={!effectiveCycleId || mutations.saving}
                      onSelect={() => {
                        setActionsOpen(false)
                        report(mutations.deleteCycle(Number(effectiveCycleId))).then((outcome) => {
                          if (outcome.ok) {
                            setCycleTouched(false)
                            setCycleId('')
                          }
                        })
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            <Button className="gap-2" onClick={() => setCycleDialogOpen(true)}>
              <Plus className="size-4" /> Create / Launch
            </Button>
          </div>
        </div>

        {result && <div className="mb-4"><ResultBanner result={result} onDismiss={() => setResult(null)} /></div>}

        {optionsError && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
            <span className="text-sm text-destructive">{optionsError}</span>
            <Button variant="outline" size="sm" onClick={retryOptions}>
              Retry
            </Button>
          </div>
        )}

        {/* =============================== KPIs =============================== */}
        <div className="mb-6 flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
          {kpisLoading &&
            Array.from({ length: 7 }).map((_, index) => (
              <Card key={index} className="min-w-[200px] flex-1 shadow-sm">
                <CardContent className="flex flex-col gap-3 p-4">
                  <Skeleton className="h-9 w-9 rounded-xl" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-7 w-12" />
                  <Skeleton className="h-2 w-20" />
                </CardContent>
              </Card>
            ))}

          {!kpisLoading && kpisError && (
            <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
              <span className="text-sm text-destructive">{kpisError}</span>
              <Button variant="outline" size="sm" onClick={retryKpis}>
                Retry
              </Button>
            </div>
          )}

          {!kpisLoading &&
            !kpisError &&
            kpis.map((kpi) => {
              const Icon = KPI_ICONS[kpi.icon] ?? Calendar

              return (
                <Card key={kpi.id} className="min-w-[210px] flex-1 shadow-sm">
                  <CardContent className="relative flex h-full flex-col gap-2 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl border bg-muted/50 p-2 text-muted-foreground">
                        <Icon className="size-5" />
                      </div>
                      <span className="text-sm font-semibold leading-tight text-foreground/80">{kpi.title}</span>
                    </div>
                    <div className="mt-2 flex flex-col gap-1 pl-[48px]">
                      <span className="text-3xl font-bold leading-none text-foreground">{kpi.value}</span>
                      <span className="text-[10px] text-muted-foreground">{kpi.subtitle}</span>
                    </div>
                    {kpi.progress !== undefined && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <div
                          className="flex size-12 items-center justify-center rounded-full"
                          style={{
                            background: `conic-gradient(var(--color-primary, currentColor) ${kpi.progress}%, transparent 0)`,
                          }}
                        >
                          <span className="flex size-9 items-center justify-center rounded-full bg-card text-xs font-bold text-foreground">
                            {kpi.progress}%
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
        </div>

        {/* ============================ Main layout =========================== */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className={cn('flex flex-col gap-5', activeReviewId ? 'xl:col-span-9' : 'xl:col-span-12')}>
            {/* Domain tabs */}
            <div className="flex items-center gap-6 overflow-x-auto border-b border-border custom-scrollbar">
              {MAIN_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-2 pb-3 text-sm font-semibold transition-colors',
                    activeTab === tab.id
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {activeTab === tab.id && <CheckCircle2 className="size-4" />}
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'reviews' && (
              <>
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-[170px]">
                    <Select
                      value={shared.department_id}
                      options={withAll(options?.departments ?? [], 'All Departments')}
                      onChange={(value) => patchShared({ department_id: value, page: 1 })}
                      aria-label="Department"
                    />
                  </div>
                  <div className="w-[170px]">
                    <Select
                      value={shared.manager_id}
                      options={withAll(options?.managers ?? [], 'All Managers')}
                      onChange={(value) => patchShared({ manager_id: value, page: 1 })}
                      aria-label="Manager"
                    />
                  </div>
                  <div className="w-[160px]">
                    <Select
                      value={shared.status}
                      options={withAll(options?.statuses ?? [], 'All Status')}
                      onChange={(value) => patchShared({ status: value, page: 1 })}
                      aria-label="Status"
                    />
                  </div>
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search employee"
                      className="pl-9"
                      value={shared.search}
                      onChange={(event) => patchShared({ search: event.target.value, page: 1 })}
                    />
                  </div>
                  <Button variant="outline" className="gap-2" onClick={() => setMoreFiltersOpen(true)}>
                    <Filter className="size-4" /> More Filters
                    {activeFilterCount > 0 && (
                      <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>

                  <div className="relative">
                    <Button variant="outline" className="gap-2" onClick={() => setSavedViewsOpen((value) => !value)}>
                      <Bookmark className="size-4" /> Saved Views <ChevronDown className="size-3" />
                    </Button>
                    {savedViewsOpen && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setSavedViewsOpen(false)} />
                        <div className="absolute right-0 top-11 z-30 w-72 overflow-hidden rounded-lg border bg-background shadow-lg">
                          {savedViewsState.loading && <p className="px-3 py-3 text-xs text-muted-foreground">Loading…</p>}
                          {!savedViewsState.loading && savedViewsState.views.length === 0 && (
                            <p className="px-3 py-3 text-xs text-muted-foreground">
                              No saved views yet. Set some filters and save the current view.
                            </p>
                          )}
                          {savedViewsState.views.map((view) => (
                            <div key={view.id} className="flex items-center justify-between gap-2 border-b last:border-b-0">
                              <button
                                type="button"
                                onClick={() => applySavedView(view.filters)}
                                className="flex flex-1 flex-col px-3 py-2 text-left hover:bg-muted"
                              >
                                <span className="text-xs font-semibold text-foreground">
                                  {view.name}
                                  {view.is_default && ' · default'}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {view.is_shared ? 'Shared' : 'Private'}
                                  {view.owner && !view.is_mine ? ` · ${view.owner}` : ''}
                                </span>
                              </button>
                              {view.is_mine && (
                                <button
                                  type="button"
                                  className="px-2 text-muted-foreground hover:text-destructive"
                                  aria-label={`Delete ${view.name}`}
                                  onClick={() => report(mutations.deleteSavedView(view.id))}
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                          <SaveCurrentView
                            onSave={(name, shareWithTeam) =>
                              report(
                                mutations.createSavedView({
                                  name,
                                  tab: 'reviews',
                                  is_shared: shareWithTeam,
                                  filters: activeFilters({
                                    department_id: shared.department_id,
                                    manager_id: shared.manager_id,
                                    status: shared.status,
                                    stage: shared.stage,
                                    jobrole: shared.jobrole,
                                    rating_min: shared.rating_min,
                                    rating_max: shared.rating_max,
                                    overdue_only: shared.overdue_only,
                                    search: shared.search,
                                  }) as Record<string, string>,
                                }),
                              ).then(() => setSavedViewsOpen(false))
                            }
                            saving={mutations.saving}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* View toggle + bulk actions */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex rounded-lg border bg-muted/50 p-1">
                      {VIEW_MODES.map((mode) => {
                        const Icon = mode.icon
                        return (
                          <Button
                            key={mode.id}
                            size="sm"
                            variant={viewMode === mode.id ? 'default' : 'ghost'}
                            className={cn(
                              'gap-2 px-3 py-1.5 text-sm',
                              viewMode === mode.id ? 'font-semibold' : 'font-medium text-muted-foreground',
                            )}
                            onClick={() => setViewMode(mode.id)}
                          >
                            <Icon className="size-4" /> {mode.label}
                          </Button>
                        )
                      })}
                    </div>

                    {selectedIds.length > 0 && (
                      <div className="ml-2 flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{selectedIds.length} selected</span>
                        <button
                          type="button"
                          className="text-xs font-medium text-primary hover:underline"
                          onClick={() => setSelectedIds([])}
                        >
                          Clear Selection
                        </button>
                      </div>
                    )}
                  </div>

                  <BulkActionsBar
                    selectedIds={selectedIds}
                    managers={options?.managers ?? []}
                    stages={options?.stages ?? []}
                    saving={mutations.saving}
                    onRun={(action, extra) =>
                      report(mutations.bulkReviews(selectedIds, action, extra)).then((outcome) => {
                        if (outcome.ok) setSelectedIds([])
                      })
                    }
                  />
                </div>

                {/* View body */}
                {viewMode === 'list' && (
                  <Card className="overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow>
                            <TableHead className="w-[40px] pl-4">
                              <Checkbox
                                checked={allRowsSelected}
                                onCheckedChange={() =>
                                  setSelectedIds(allRowsSelected ? [] : reviews.map((review) => review.id))
                                }
                                aria-label="Select all reviews"
                              />
                            </TableHead>
                            <TableHead>
                              <SortableHead
                                label="Employee"
                                column="employee"
                                activeColumn={shared.sort_by}
                                direction={shared.sort_dir}
                                onSort={sortReviews}
                              />
                            </TableHead>
                            <TableHead>
                              <SortableHead
                                label="Department"
                                column="department"
                                activeColumn={shared.sort_by}
                                direction={shared.sort_dir}
                                onSort={sortReviews}
                              />
                            </TableHead>
                            <TableHead>
                              <SortableHead
                                label="Manager"
                                column="manager"
                                activeColumn={shared.sort_by}
                                direction={shared.sort_dir}
                                onSort={sortReviews}
                              />
                            </TableHead>
                            <TableHead className="font-semibold text-foreground">Cycle</TableHead>
                            <TableHead>
                              <SortableHead
                                label="Stage"
                                column="stage"
                                activeColumn={shared.sort_by}
                                direction={shared.sort_dir}
                                onSort={sortReviews}
                              />
                            </TableHead>
                            <TableHead>
                              <SortableHead
                                label="Overall Rating"
                                column="overall_rating"
                                activeColumn={shared.sort_by}
                                direction={shared.sort_dir}
                                onSort={sortReviews}
                              />
                            </TableHead>
                            <TableHead>
                              <SortableHead
                                label="Status"
                                column="status"
                                activeColumn={shared.sort_by}
                                direction={shared.sort_dir}
                                onSort={sortReviews}
                              />
                            </TableHead>
                            <TableHead>
                              <SortableHead
                                label="Due Date"
                                column="due_date"
                                activeColumn={shared.sort_by}
                                direction={shared.sort_dir}
                                onSort={sortReviews}
                              />
                            </TableHead>
                            <TableHead className="w-[60px] text-center font-semibold text-foreground">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reviewsLoading && <TableLoadingRows columns={10} />}

                          {!reviewsLoading && reviewsError && (
                            <TableMessageRow
                              columns={10}
                              tone="error"
                              title={reviewsError}
                              description="The employee reviews could not be loaded."
                              action={
                                <Button variant="outline" size="sm" onClick={retryReviews}>
                                  Retry
                                </Button>
                              }
                            />
                          )}

                          {!reviewsLoading && !reviewsError && reviews.length === 0 && (
                            <TableMessageRow
                              columns={10}
                              title="No reviews match these filters"
                              description={
                                effectiveCycleId
                                  ? 'Launch this cycle to create reviews, or clear the filters.'
                                  : 'Select a review cycle above to see its participants.'
                              }
                              action={
                                effectiveCycleId ? (
                                  <Button variant="outline" size="sm" onClick={() => setLaunchDialogOpen(true)}>
                                    Launch reviews
                                  </Button>
                                ) : undefined
                              }
                            />
                          )}

                          {!reviewsLoading &&
                            !reviewsError &&
                            reviews.map((review) => (
                              <ReviewRow
                                key={review.id}
                                review={review}
                                selected={selectedIds.includes(review.id)}
                                isActive={review.id === activeReviewId}
                                saving={mutations.saving}
                                onToggle={() => toggleRow(review.id)}
                                onOpen={() => openPanel(review.id)}
                                onAdvance={() => report(mutations.advanceReview(review.id))}
                                onRemind={() => report(mutations.sendReminder(review.id))}
                                onComplete={() => report(mutations.advanceReview(review.id, { stage: 'completed' }))}
                                onRemove={() => report(mutations.deleteReview(review.id))}
                              />
                            ))}
                        </TableBody>
                      </Table>
                    </div>

                    <PaginationBar
                      page={reviewPagination.page}
                      perPage={reviewPagination.per_page}
                      total={reviewPagination.total}
                      lastPage={reviewPagination.last_page}
                      onPageChange={(page) => patchShared({ page })}
                      onPerPageChange={(perPage) => patchShared({ per_page: perPage, page: 1 })}
                    />
                  </Card>
                )}

                {viewMode === 'board' && (
                  <ReviewBoard
                    columns={boardColumns}
                    loading={boardLoading}
                    error={boardError}
                    retry={retryBoard}
                    activeReviewId={activeReviewId}
                    saving={mutations.saving}
                    onOpen={openPanel}
                    onAdvance={(id) => report(mutations.advanceReview(id))}
                  />
                )}

                {viewMode === 'timeline' && (
                  <CycleTimeline
                    cycles={timelineCycles}
                    loading={timelineLoading}
                    error={timelineError}
                    retry={retryTimeline}
                    activeCycleId={effectiveCycleId}
                    onSelectCycle={(id) => {
                      setCycleTouched(true)
                      setCycleId(id)
                      setActiveReviewId(null)
                    }}
                  />
                )}

                {/* Activity section */}
                <ActivityPanel
                  activeTab={activityTab}
                  onTabChange={setActivityTab}
                  state={activityState}
                  reviewId={activeReviewId}
                  saving={mutations.saving}
                  onAddNote={(body, noteType) =>
                    activeReviewId && report(mutations.createNote(activeReviewId, body, noteType))
                  }
                  onDeleteNote={(id) => report(mutations.deleteNote(id))}
                  onUploadAttachment={(file) =>
                    activeReviewId && report(mutations.uploadAttachment(activeReviewId, file))
                  }
                  onDeleteAttachment={(id) => report(mutations.deleteAttachment(id))}
                />
              </>
            )}

            {activeTab === 'goals' && (
              <GoalsTab
                goals={goalsState.goals}
                summary={goalsState.summary}
                pagination={goalsState.pagination}
                loading={goalsState.loading}
                error={goalsState.error}
                retry={goalsState.retry}
                options={options}
                filters={goalFilters}
                onFilterChange={(patch) => setGoalFilters((state) => ({ ...state, ...patch }))}
                onCreate={(payload) => report(mutations.createGoal(payload))}
                onUpdate={(id, payload) => report(mutations.updateGoal(id, payload))}
                onDelete={(id) => report(mutations.deleteGoal(id))}
                saving={mutations.saving}
                cycleId={effectiveCycleId || undefined}
              />
            )}

            {activeTab === 'appraisals' && (
              <AppraisalsTab
                appraisals={appraisalsState.appraisals}
                summary={appraisalsState.summary}
                pagination={appraisalsState.pagination}
                loading={appraisalsState.loading}
                error={appraisalsState.error}
                retry={appraisalsState.retry}
                options={options}
                filters={appraisalFilters}
                onFilterChange={(patch) => setAppraisalFilters((state) => ({ ...state, ...patch }))}
                onCreate={(payload) => report(mutations.createAppraisal(payload))}
                onUpdate={(id, payload) => report(mutations.updateAppraisal(id, payload))}
                onDecide={(id, action) => report(mutations.decideAppraisal(id, action))}
                onBulk={(ids, action) => report(mutations.bulkAppraisals(ids, action))}
                onDelete={(id) => report(mutations.deleteAppraisal(id))}
                saving={mutations.saving}
                cycleId={effectiveCycleId || undefined}
              />
            )}

            {activeTab === 'compensation' && (
              <CompensationTab
                revisions={compState.revisions}
                summary={compState.summary}
                pagination={compState.pagination}
                loading={compState.loading}
                error={compState.error}
                retry={compState.retry}
                options={options}
                filters={compFilters}
                onFilterChange={(patch) => setCompFilters((state) => ({ ...state, ...patch }))}
                onCreate={(payload) => report(mutations.createCompensation(payload))}
                onUpdate={(id, payload) => report(mutations.updateCompensation(id, payload))}
                onDecide={(id, action) => report(mutations.decideCompensation(id, action))}
                onBulk={(ids, action) => report(mutations.bulkCompensation(ids, action))}
                onDelete={(id) => report(mutations.deleteCompensation(id))}
                saving={mutations.saving}
                cycleId={effectiveCycleId || undefined}
              />
            )}

            {activeTab === 'bonus' && (
              <BonusTab
                awards={bonusState.awards}
                summary={bonusState.summary}
                payoutMonths={bonusState.payoutMonths}
                pagination={bonusState.pagination}
                loading={bonusState.loading}
                error={bonusState.error}
                retry={bonusState.retry}
                options={options}
                filters={bonusFilters}
                onFilterChange={(patch) => setBonusFilters((state) => ({ ...state, ...patch }))}
                onCreate={(payload) => report(mutations.createBonus(payload))}
                onUpdate={(id, payload) => report(mutations.updateBonus(id, payload))}
                onDecide={(id, action) => report(mutations.decideBonus(id, action))}
                onBulk={(ids, action) => report(mutations.bulkBonus(ids, action))}
                onDelete={(id) => report(mutations.deleteBonus(id))}
                saving={mutations.saving}
                cycleId={effectiveCycleId || undefined}
              />
            )}

            {activeTab === 'nine-box' && (
              <div className="p-1">
                {/* Self-contained: it owns its own fetch, because it shares no
                    filters, cycle or pagination with the review tabs. */}
                <NineBoxGrid />
              </div>
            )}

            {activeTab === 'calibration' && (
              <CalibrationTab
                sessions={calibrationState.sessions}
                summary={calibrationState.summary}
                pagination={calibrationState.pagination}
                loading={calibrationState.loading}
                error={calibrationState.error}
                retry={calibrationState.retry}
                options={options}
                filters={calibrationFilters}
                onFilterChange={(patch) => setCalibrationFilters((state) => ({ ...state, ...patch }))}
                onCreate={(payload) => report(mutations.createCalibrationSession(payload))}
                onUpdate={(id, payload) => report(mutations.updateCalibrationSession(id, payload))}
                onLock={(id, force) => report(mutations.lockCalibrationSession(id, { force }))}
                onDelete={(id) =>
                  report(mutations.deleteCalibrationSession(id)).then((outcome) => {
                    if (outcome.ok && openSessionId === id) setOpenSessionId(null)
                  })
                }
                onCalibrate={(sessionId, reviewId, rating) =>
                  report(mutations.calibrateRating(sessionId, reviewId, rating))
                }
                grid={gridState.grid}
                gridLoading={gridState.loading}
                gridError={gridState.error}
                openSessionId={openSessionId}
                onOpenSession={setOpenSessionId}
                saving={mutations.saving}
                cycleId={effectiveCycleId || undefined}
              />
            )}
          </div>

          {/* ============================== Sidebar ============================== */}
          {activeReviewId && (
            <div className="flex h-full flex-col gap-4 xl:col-span-3">
              <PerformanceSidebar
                detail={detailState.detail}
                team={detailState.team}
                loading={detailState.loading}
                error={detailState.error}
                activeTab={sidebarTab}
                onTabChange={setSidebarTab}
                onClose={closePanel}
                goals={sidebarGoals.goals}
                goalsLoading={sidebarGoals.loading}
                compensation={sidebarComp.revisions}
                compensationLoading={sidebarComp.loading}
                attachments={sidebarAttachments.attachments}
                attachmentsLoading={sidebarAttachments.loading}
                notes={activityState.notes.filter((note) => note.note_type === 'note')}
                onSendReminder={() => activeReviewId && report(mutations.sendReminder(activeReviewId))}
                onViewReview={() => {
                  setActivityTab('feed')
                  setSidebarTab('reviews')
                }}
                onAddNote={(body) => activeReviewId && report(mutations.createNote(activeReviewId, body, 'note'))}
                onAdvanceStage={() => activeReviewId && report(mutations.advanceReview(activeReviewId))}
                onOpenTeamDetails={() => setTeamDetailsOpen(true)}
                onSelectReview={openPanel}
                onSaveRatings={async (payload) => {
                  if (!activeReviewId) return
                  // mutations.updateReview has existed since the module was built
                  // with nothing calling it - PUT /performance/reviews/{id} is the
                  // only path that can set a self or manager rating.
                  await report(mutations.updateReview(activeReviewId, payload))
                }}
                saving={mutations.saving}
              />
            </div>
          )}
        </div>
      </div>

      {/* =============================== Overlays =============================== */}

      <MoreFiltersSheet
        open={moreFiltersOpen}
        onClose={() => setMoreFiltersOpen(false)}
        shared={shared}
        options={options}
        onApply={(patch) => {
          patchShared({ ...patch, page: 1 })
          setMoreFiltersOpen(false)
        }}
        onReset={() => {
          setShared(INITIAL_SHARED)
          setMoreFiltersOpen(false)
        }}
      />

      <CreateCycleDialog
        open={cycleDialogOpen}
        cycleTypes={options?.cycle_types ?? []}
        saving={mutations.saving}
        onClose={() => setCycleDialogOpen(false)}
        onSubmit={async (payload, launchNow) => {
          const context = getLaravelContext(user)

          try {
            const response = await performanceService.createCycle(context, payload)
            const newCycleId = response.data.id

            if (launchNow) {
              await performanceService.launchCycle(context, newCycleId)
            }

            setResult({
              ok: true,
              message: launchNow
                ? `Review cycle created and launched to all employees.`
                : 'Review cycle created as a draft.',
            })
            setCycleTouched(true)
            setCycleId(String(newCycleId))
            setActiveReviewId(null)
            bumpRefresh()
            retryOptions()
          } catch (error) {
            setResult({
              ok: false,
              message: error instanceof Error ? error.message : 'Failed to create the review cycle.',
            })
          }

          setCycleDialogOpen(false)
        }}
      />

      <LaunchDialog
        open={launchDialogOpen}
        cycleName={activeCycle?.label ?? ''}
        departments={options?.departments ?? []}
        employees={options?.employees ?? []}
        saving={mutations.saving}
        onClose={() => setLaunchDialogOpen(false)}
        onSubmit={(payload) => {
          report(mutations.launchCycle(Number(effectiveCycleId), payload))
          setLaunchDialogOpen(false)
        }}
      />

      <TeamDetailsSheet
        open={teamDetailsOpen}
        team={detailState.team}
        onClose={() => setTeamDetailsOpen(false)}
      />
    </div>
  )
}

/* ================================================================== *
 * Sub-components
 * ================================================================== */

function MenuItem({
  label,
  onSelect,
  disabled,
  danger,
}: {
  label: string
  onSelect: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'block w-full px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40',
        danger ? 'text-destructive' : 'text-foreground',
      )}
    >
      {label}
    </button>
  )
}

function ReviewRow({
  review,
  selected,
  isActive,
  saving,
  onToggle,
  onOpen,
  onAdvance,
  onRemind,
  onComplete,
  onRemove,
}: {
  review: PerfReview
  selected: boolean
  isActive: boolean
  saving: boolean
  onToggle: () => void
  onOpen: () => void
  onAdvance: () => void
  onRemind: () => void
  onComplete: () => void
  onRemove: () => void
}) {
  const [menuOpen, setMenuOpen] = React.useState(false)

  return (
    <TableRow
      className={cn('cursor-pointer hover:bg-muted/10', isActive && 'bg-primary/5')}
      onClick={onOpen}
    >
      <TableCell className="pl-4" onClick={(event) => event.stopPropagation()}>
        <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Select ${review.employee.name}`} />
      </TableCell>
      <TableCell>
        <EmployeeCell
          name={review.employee.name}
          initials={review.employee.initials}
          employeeNo={review.employee.employee_no}
        />
      </TableCell>
      <TableCell className="text-sm text-foreground/80">{review.department ?? '—'}</TableCell>
      <TableCell className="text-sm text-foreground/80">{review.manager ?? 'Not assigned'}</TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="text-sm text-foreground/80">{review.cycle ?? '—'}</span>
          {review.cycle_type_label && (
            <span className="text-[10px] text-muted-foreground">{review.cycle_type_label}</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge variant={stageVariant(review.stage)} className="border shadow-sm">
          {review.stage_label}
        </StatusBadge>
      </TableCell>
      <TableCell>
        <RatingCell rating={review.overall_rating} label={review.overall_rating_label} />
      </TableCell>
      <TableCell>
        <StatusBadge variant={reviewStatusVariant(review.status)} size="sm">
          {review.status_label}
        </StatusBadge>
      </TableCell>
      <TableCell className={cn('text-sm', review.is_overdue ? 'font-semibold text-destructive' : 'text-foreground/80')}>
        {review.due_label ?? '—'}
        {review.is_overdue && <span className="block text-[10px]">Overdue</span>}
      </TableCell>
      <TableCell className="text-center" onClick={(event) => event.stopPropagation()}>
        <div className="relative flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label={`Actions for ${review.employee.name}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-9 z-30 w-52 overflow-hidden rounded-lg border bg-background shadow-lg">
                <MenuItem
                  label="Open employee overview"
                  onSelect={() => {
                    setMenuOpen(false)
                    onOpen()
                  }}
                />
                <MenuItem
                  label="Advance to next stage"
                  disabled={review.stage === 'completed' || saving}
                  onSelect={() => {
                    setMenuOpen(false)
                    onAdvance()
                  }}
                />
                <MenuItem
                  label="Mark completed"
                  disabled={review.stage === 'completed' || saving}
                  onSelect={() => {
                    setMenuOpen(false)
                    onComplete()
                  }}
                />
                <MenuItem
                  label="Send reminder"
                  disabled={saving}
                  onSelect={() => {
                    setMenuOpen(false)
                    onRemind()
                  }}
                />
                <MenuItem
                  label="Remove from cycle"
                  danger
                  disabled={saving}
                  onSelect={() => {
                    setMenuOpen(false)
                    onRemove()
                  }}
                />
              </div>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

function BulkActionsBar({
  selectedIds,
  managers,
  stages,
  saving,
  onRun,
}: {
  selectedIds: number[]
  managers: Array<{ value: string; label: string }>
  stages: Array<{ value: string; label: string }>
  saving: boolean
  onRun: (
    action: 'advance' | 'remind' | 'assign_manager' | 'set_due_date' | 'complete',
    extra?: { stage?: ReviewStage; manager_id?: number; due_date?: string },
  ) => void
}) {
  const [action, setAction] = React.useState('')
  const [managerId, setManagerId] = React.useState('')
  const [dueDate, setDueDate] = React.useState('')
  const [targetStage, setTargetStage] = React.useState('')
  const [moreOpen, setMoreOpen] = React.useState(false)

  const disabled = selectedIds.length === 0 || saving

  const run = () => {
    if (!action) return

    if (action === 'assign_manager') {
      if (!managerId) return
      onRun('assign_manager', { manager_id: Number(managerId) })
      return
    }

    if (action === 'set_due_date') {
      if (!dueDate) return
      onRun('set_due_date', { due_date: dueDate })
      return
    }

    // A blank target stage means "one step forward", which is what the API does
    // when no stage is supplied.
    if (action === 'advance') {
      onRun('advance', targetStage ? { stage: targetStage as ReviewStage } : undefined)
      return
    }

    onRun(action as 'remind' | 'complete')
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-[170px]">
        <Select
          value={action}
          placeholder="Start Action"
          options={[
            { value: 'advance', label: 'Advance stage' },
            { value: 'complete', label: 'Mark completed' },
            { value: 'remind', label: 'Send reminders' },
            { value: 'assign_manager', label: 'Assign manager' },
            { value: 'set_due_date', label: 'Set due date' },
          ]}
          onChange={setAction}
          disabled={disabled}
          aria-label="Bulk action"
        />
      </div>

      {action === 'advance' && (
        <div className="w-[180px]">
          <Select
            value={targetStage}
            placeholder="Next stage"
            options={stages}
            onChange={setTargetStage}
            aria-label="Stage to advance to"
          />
        </div>
      )}

      {action === 'assign_manager' && (
        <div className="w-[170px]">
          <Select
            value={managerId}
            placeholder="Pick manager"
            options={managers}
            onChange={setManagerId}
            aria-label="Manager to assign"
          />
        </div>
      )}

      {action === 'set_due_date' && (
        <Input
          type="date"
          className="w-[160px]"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          aria-label="New due date"
        />
      )}

      <Button disabled={disabled || !action} onClick={run}>
        Apply
      </Button>

      <div className="relative">
        <Button variant="outline" className="gap-2" onClick={() => setMoreOpen((value) => !value)}>
          More <ChevronDown className="size-3" />
        </Button>
        {moreOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setMoreOpen(false)} />
            <div className="absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-lg border bg-background shadow-lg">
              <MenuItem
                label={`Advance ${selectedIds.length} review(s)`}
                disabled={disabled}
                onSelect={() => {
                  setMoreOpen(false)
                  onRun('advance')
                }}
              />
              <MenuItem
                label={`Remind ${selectedIds.length} employee(s)`}
                disabled={disabled}
                onSelect={() => {
                  setMoreOpen(false)
                  onRun('remind')
                }}
              />
              <MenuItem
                label={`Complete ${selectedIds.length} review(s)`}
                disabled={disabled}
                onSelect={() => {
                  setMoreOpen(false)
                  onRun('complete')
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ReviewBoard({
  columns,
  loading,
  error,
  retry,
  activeReviewId,
  saving,
  onOpen,
  onAdvance,
}: {
  columns: Array<{
    stage: string
    stage_label: string | null
    column_total: number
    truncated: boolean
    cards: PerfReview[]
  }>
  loading: boolean
  error: string | null
  retry: () => void
  activeReviewId: number | null
  saving: boolean
  onOpen: (id: number) => void
  onAdvance: (id: number) => void
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-lg border bg-muted/10 p-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
        <span className="text-sm text-destructive">{error}</span>
        <Button variant="outline" size="sm" onClick={retry}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {columns.map((column) => (
        <div key={column.stage} className="flex flex-col gap-2 rounded-lg border bg-muted/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-foreground">{column.stage_label}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {column.column_total}
            </span>
          </div>

          {column.cards.length === 0 && (
            <p className="py-6 text-center text-[10px] text-muted-foreground">Nothing at this stage.</p>
          )}

          {column.cards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onOpen(card.id)}
              className={cn(
                'flex flex-col gap-2 rounded-lg border bg-background p-2.5 text-left transition-colors hover:border-primary/40',
                card.id === activeReviewId && 'border-primary/50 ring-1 ring-primary/20',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-muted text-[10px] font-bold text-muted-foreground">
                  {card.employee.initials}
                </span>
                <span className="min-w-0 truncate text-xs font-semibold text-foreground">{card.employee.name}</span>
              </div>
              <span className="truncate text-[10px] text-muted-foreground">{card.department ?? '—'}</span>
              <div className="flex items-center justify-between gap-1">
                <RatingCell rating={card.overall_rating} label={card.overall_rating_label} />
                <span className={cn('text-[10px]', card.is_overdue ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
                  {card.due_label ?? '—'}
                </span>
              </div>
              {card.stage !== 'completed' && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-disabled={saving}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (!saving) onAdvance(card.id)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !saving) {
                      event.stopPropagation()
                      onAdvance(card.id)
                    }
                  }}
                  className="mt-0.5 text-[10px] font-semibold text-primary hover:underline"
                >
                  Advance →
                </span>
              )}
            </button>
          ))}

          {column.truncated && (
            <p className="text-center text-[10px] text-muted-foreground">
              Showing {column.cards.length} of {column.column_total} — narrow the filters to see the rest.
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function CycleTimeline({
  cycles,
  loading,
  error,
  retry,
  activeCycleId,
  onSelectCycle,
}: {
  cycles: Array<{
    id: number
    name: string
    status_label: string | null
    status: string
    period_label: string | null
    total_reviews: number
    launched_at: string | null
    milestones: Array<{
      key: string
      label: string
      due_label: string | null
      at_stage: number
      pct: number
      is_overdue: boolean
    }>
  }>
  loading: boolean
  error: string | null
  retry: () => void
  activeCycleId: string
  onSelectCycle: (id: string) => void
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
        <span className="text-sm text-destructive">{error}</span>
        <Button variant="outline" size="sm" onClick={retry}>
          Retry
        </Button>
      </div>
    )
  }

  if (cycles.length === 0) {
    return (
      <Card className="p-10 text-center shadow-sm">
        <p className="text-sm font-semibold text-foreground">No review cycles yet</p>
        <p className="mt-1 text-xs text-muted-foreground">Create a cycle to see its timeline here.</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {cycles.map((cycle) => (
        <Card
          key={cycle.id}
          className={cn(
            'cursor-pointer p-5 shadow-sm transition-colors hover:border-primary/40',
            String(cycle.id) === activeCycleId && 'border-primary/50',
          )}
          onClick={() => onSelectCycle(String(cycle.id))}
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground">{cycle.name}</span>
              <span className="text-xs text-muted-foreground">
                {cycle.period_label ?? '—'} · {cycle.total_reviews} participant(s)
              </span>
            </div>
            <StatusBadge
              variant={
                cycle.status === 'active'
                  ? 'primary'
                  : cycle.status === 'calibration'
                    ? 'warning'
                    : cycle.status === 'closed'
                      ? 'success'
                      : 'default'
              }
              size="sm"
            >
              {cycle.status_label}
            </StatusBadge>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {cycle.milestones.map((milestone) => (
              <div key={milestone.key} className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
                      milestone.pct >= 100
                        ? 'bg-success text-success-foreground'
                        : milestone.at_stage > 0
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {milestone.pct >= 100 ? <Check className="size-2.5" /> : milestone.at_stage}
                  </span>
                  <span className="truncate text-[11px] font-semibold text-foreground">{milestone.label}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${milestone.pct}%` }} />
                </div>
                <span
                  className={cn(
                    'text-[10px]',
                    milestone.is_overdue ? 'font-semibold text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {milestone.due_label ?? 'No due date'}
                  {milestone.is_overdue && ' · overdue'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

function ActivityPanel({
  activeTab,
  onTabChange,
  state,
  reviewId,
  saving,
  onAddNote,
  onDeleteNote,
  onUploadAttachment,
  onDeleteAttachment,
}: {
  activeTab: ActivityTab
  onTabChange: (tab: ActivityTab) => void
  state: ReturnType<typeof useReviewActivity>
  reviewId: number | null
  saving: boolean
  onAddNote: (body: string, noteType: 'comment' | 'note') => void
  onDeleteNote: (id: number) => void
  onUploadAttachment: (file: File) => void
  onDeleteAttachment: (id: number) => void
}) {
  const [draft, setDraft] = React.useState('')
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const labelFor = (tab: ActivityTab, label: string) => {
    if (tab === 'comments' && state.counts.comment) return `${label} (${state.counts.comment})`
    if (tab === 'notes' && state.counts.note) return `${label} (${state.counts.note})`
    if (tab === 'attachments' && state.counts.attachments) return `${label} (${state.counts.attachments})`
    return label
  }

  return (
    <div className="mt-2 flex flex-col gap-4">
      <div className="flex items-center gap-6 overflow-x-auto border-b border-border custom-scrollbar">
        {ACTIVITY_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'shrink-0 pb-3 text-sm font-semibold transition-colors',
              activeTab === tab.id
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {labelFor(tab.id, tab.label)}
          </button>
        ))}
      </div>

      {state.loading && (
        <div className="flex flex-col gap-3 px-2 py-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {!state.loading && state.error && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <span className="text-sm text-destructive">{state.error}</span>
          <Button variant="outline" size="sm" onClick={state.retry}>
            Retry
          </Button>
        </div>
      )}

      {!state.loading && !state.error && (activeTab === 'feed' || activeTab === 'audit') && (
        <div className="flex flex-col gap-6 px-2 py-2">
          {state.entries.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {activeTab === 'audit'
                ? 'No recorded changes yet. Field-level edits appear here.'
                : 'No activity recorded yet.'}
            </p>
          )}

          {state.entries.map((entry, index) => (
            <div key={entry.id} className="relative flex gap-4">
              {index !== state.entries.length - 1 && (
                <div className="absolute bottom-[-24px] left-[15px] top-8 w-0.5 bg-border" />
              )}
              <div
                className={cn(
                  'z-10 flex size-8 shrink-0 items-center justify-center rounded-full border',
                  entry.entry_type === 'status_change'
                    ? 'border-primary/20 bg-primary/10 text-primary'
                    : entry.entry_type === 'reminder'
                      ? 'border-warning/20 bg-warning/10 text-warning'
                      : entry.entry_type === 'approval'
                        ? 'border-success/20 bg-success/10 text-success'
                        : entry.entry_type === 'comment'
                          ? 'border-border bg-muted text-muted-foreground'
                          : 'border-border bg-muted text-muted-foreground',
                )}
              >
                {entry.entry_type === 'approval' ? (
                  <Check className="size-3.5" />
                ) : entry.entry_type === 'reminder' ? (
                  <Send className="size-3" />
                ) : (
                  <span className="size-1.5 rounded-full bg-current" />
                )}
              </div>

              <div className="flex flex-1 flex-col gap-1 pt-1.5">
                <div className="flex flex-col justify-between gap-1 md:flex-row md:items-center">
                  <p className="text-sm text-foreground">
                    <span className="mr-2 rounded border bg-muted px-1.5 py-0.5 text-xs font-bold">
                      {entry.actor_initials}
                    </span>
                    <span className="font-semibold">{entry.actor_name}</span> {entry.description}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">{entry.created_label}</span>
                </div>

                <span className="text-[10px] text-muted-foreground">
                  {entry.module}
                  {entry.subject_name ? ` · ${entry.subject_name}` : ''}
                </span>

                {entry.changes && entry.changes.length > 0 && (
                  <div className="mt-1 flex flex-col gap-1 rounded-lg border bg-muted/20 p-2.5">
                    {entry.changes.map((change) => (
                      <div key={change.field} className="flex flex-wrap items-baseline gap-1.5 text-[11px]">
                        <span className="font-semibold text-foreground">{change.label}:</span>
                        <span className="text-muted-foreground line-through">{String(change.old ?? '—')}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-semibold text-foreground">{String(change.new ?? '—')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!state.loading && !state.error && (activeTab === 'comments' || activeTab === 'notes') && (
        <div className="flex flex-col gap-3 px-2">
          {!reviewId && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Select an employee row to read and add {activeTab}.
            </p>
          )}

          {reviewId && (
            <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
              <Textarea
                rows={3}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={activeTab === 'notes' ? 'Add an internal HR note…' : 'Add a comment on this review…'}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={saving || !draft.trim()}
                  onClick={() => {
                    onAddNote(draft.trim(), activeTab === 'notes' ? 'note' : 'comment')
                    setDraft('')
                  }}
                >
                  {activeTab === 'notes' ? 'Add Note' : 'Add Comment'}
                </Button>
              </div>
            </div>
          )}

          {reviewId && state.notes.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No {activeTab} on this review yet.
            </p>
          )}

          {state.notes.map((note) => (
            <div key={note.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm text-foreground">{note.body}</p>
                <span className="text-[10px] text-muted-foreground">
                  {note.author_name} · {note.created_label} · {note.visibility}
                </span>
              </div>
              <button
                type="button"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Delete"
                disabled={saving}
                onClick={() => onDeleteNote(note.id)}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!state.loading && !state.error && activeTab === 'attachments' && (
        <div className="flex flex-col gap-3 px-2">
          {!reviewId && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Select an employee row to see and upload documents.
            </p>
          )}

          {reviewId && (
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) onUploadAttachment(file)
                  event.target.value = ''
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={saving}
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus className="size-4" /> Upload document
              </Button>
              <span className="text-[10px] text-muted-foreground">Max 20 MB</span>
            </div>
          )}

          {reviewId && state.attachments.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No documents on this review yet.</p>
          )}

          {state.attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold text-foreground">
                  {attachment.title ?? attachment.file_name}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {attachment.document_type_label}
                  {attachment.file_size_label ? ` · ${attachment.file_size_label}` : ''} · {attachment.uploaded_by} ·{' '}
                  {attachment.created_label}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {attachment.url && (
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Open
                  </a>
                )}
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Delete attachment"
                  disabled={saving}
                  onClick={() => onDeleteAttachment(attachment.id)}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SaveCurrentView({
  onSave,
  saving,
}: {
  onSave: (name: string, shareWithTeam: boolean) => void
  saving: boolean
}) {
  const [name, setName] = React.useState('')
  const [share, setShare] = React.useState(false)

  return (
    <div className="flex flex-col gap-2 border-t bg-muted/20 p-3">
      <Label className="text-[10px] font-semibold text-muted-foreground">Save the current filters as a view</Label>
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="View name"
        className="h-8 text-xs"
      />
      <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <Checkbox checked={share} onCheckedChange={() => setShare((value) => !value)} />
        Share with the team
      </label>
      <Button
        size="sm"
        className="h-7 text-xs"
        disabled={saving || !name.trim()}
        onClick={() => {
          onSave(name.trim(), share)
          setName('')
        }}
      >
        Save View
      </Button>
    </div>
  )
}

function MoreFiltersSheet({
  open,
  onClose,
  shared,
  options,
  onApply,
  onReset,
}: {
  open: boolean
  onClose: () => void
  shared: SharedFilterState
  options: ReturnType<typeof usePerformanceFilters>['options']
  onApply: (patch: Partial<SharedFilterState>) => void
  onReset: () => void
}) {
  const [draft, setDraft] = React.useState(shared)
  const [lastOpen, setLastOpen] = React.useState(open)

  // Re-seed the draft each time the sheet opens, so a cancelled edit is dropped.
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setDraft(shared)
  }

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent side="right" className="w-full max-w-md sm:max-w-md">
        <SheetHeader>
          <SheetTitle>More Filters</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Stage</Label>
            <Select
              value={draft.stage}
              options={withAll(options?.stages ?? [], 'All Stages')}
              onChange={(value) => setDraft((state) => ({ ...state, stage: value }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Job role</Label>
            <Select
              value={draft.jobrole}
              options={withAll(options?.jobroles ?? [], 'All Job Roles')}
              onChange={(value) => setDraft((state) => ({ ...state, jobrole: value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Min rating</Label>
              <Input
                type="number"
                step="0.1"
                min={0}
                max={5}
                value={draft.rating_min}
                onChange={(event) => setDraft((state) => ({ ...state, rating_min: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Max rating</Label>
              <Input
                type="number"
                step="0.1"
                min={0}
                max={5}
                value={draft.rating_max}
                onChange={(event) => setDraft((state) => ({ ...state, rating_max: event.target.value }))}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={draft.overdue_only === '1'}
              onCheckedChange={() =>
                setDraft((state) => ({ ...state, overdue_only: state.overdue_only === '1' ? '' : '1' }))
              }
            />
            Overdue reviews only
          </label>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onReset}>
            Reset all
          </Button>
          <Button
            onClick={() =>
              onApply({
                stage: draft.stage,
                jobrole: draft.jobrole,
                rating_min: draft.rating_min,
                rating_max: draft.rating_max,
                overdue_only: draft.overdue_only,
              })
            }
          >
            Apply Filters
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function CreateCycleDialog({
  open,
  cycleTypes,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean
  cycleTypes: Array<{ value: string; label: string }>
  saving: boolean
  onClose: () => void
  onSubmit: (payload: CyclePayload, launchNow: boolean) => void
}) {
  const [form, setForm] = React.useState({
    name: '',
    code: '',
    cycle_type: 'annual',
    description: '',
    period_start: '',
    period_end: '',
    self_review_due: '',
    manager_review_due: '',
    calibration_due: '',
    final_review_due: '',
    rating_scale_max: '5',
  })
  const [launchNow, setLaunchNow] = React.useState(true)
  const [validationError, setValidationError] = React.useState<string | null>(null)
  const [lastOpen, setLastOpen] = React.useState(open)

  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setValidationError(null)
      setLaunchNow(true)
      setForm({
        name: '',
        code: '',
        cycle_type: 'annual',
        description: '',
        period_start: '',
        period_end: '',
        self_review_due: '',
        manager_review_due: '',
        calibration_due: '',
        final_review_due: '',
        rating_scale_max: '5',
      })
    }
  }

  const submit = () => {
    if (!form.name.trim()) {
      setValidationError('A cycle name is required.')
      return
    }

    if (form.period_start && form.period_end && form.period_end < form.period_start) {
      setValidationError('The period end must be on or after the period start.')
      return
    }

    onSubmit(
      {
        name: form.name.trim(),
        code: form.code || null,
        cycle_type: form.cycle_type as CyclePayload['cycle_type'],
        description: form.description || null,
        period_start: form.period_start || null,
        period_end: form.period_end || null,
        self_review_due: form.self_review_due || null,
        manager_review_due: form.manager_review_due || null,
        calibration_due: form.calibration_due || null,
        final_review_due: form.final_review_due || null,
        rating_scale_max: Number(form.rating_scale_max || 5),
        status: launchNow ? 'active' : 'draft',
      },
      launchNow,
    )
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Review Cycle</DialogTitle>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-4 overflow-y-auto py-2 sm:grid-cols-2 custom-scrollbar">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs font-semibold text-muted-foreground">
              Cycle name<span className="ml-0.5 text-destructive">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))}
              placeholder="e.g. FY 2025-26 Annual"
            />
          </div>

          <LabelledInput
            label="Code"
            value={form.code}
            onChange={(value) => setForm((state) => ({ ...state, code: value }))}
            placeholder="FY25-ANN"
          />

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Cycle type</Label>
            <Select
              value={form.cycle_type}
              options={cycleTypes}
              onChange={(value) => setForm((state) => ({ ...state, cycle_type: value }))}
            />
          </div>

          <LabelledInput
            label="Period start"
            type="date"
            value={form.period_start}
            onChange={(value) => setForm((state) => ({ ...state, period_start: value }))}
          />
          <LabelledInput
            label="Period end"
            type="date"
            value={form.period_end}
            onChange={(value) => setForm((state) => ({ ...state, period_end: value }))}
          />
          <LabelledInput
            label="Self review due"
            type="date"
            value={form.self_review_due}
            onChange={(value) => setForm((state) => ({ ...state, self_review_due: value }))}
          />
          <LabelledInput
            label="Manager review due"
            type="date"
            value={form.manager_review_due}
            onChange={(value) => setForm((state) => ({ ...state, manager_review_due: value }))}
          />
          <LabelledInput
            label="Calibration due"
            type="date"
            value={form.calibration_due}
            onChange={(value) => setForm((state) => ({ ...state, calibration_due: value }))}
          />
          <LabelledInput
            label="Final review due"
            type="date"
            value={form.final_review_due}
            onChange={(value) => setForm((state) => ({ ...state, final_review_due: value }))}
          />
          <LabelledInput
            label="Rating scale max"
            type="number"
            value={form.rating_scale_max}
            onChange={(value) => setForm((state) => ({ ...state, rating_scale_max: value }))}
          />

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs font-semibold text-muted-foreground">Description</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm((state) => ({ ...state, description: event.target.value }))}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
            <Checkbox checked={launchNow} onCheckedChange={() => setLaunchNow((value) => !value)} />
            Launch immediately to every employee (creates one review per employee)
          </label>
        </div>

        {validationError && <p className="text-xs font-semibold text-destructive">{validationError}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {launchNow ? 'Create & Launch' : 'Create Draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LaunchDialog({
  open,
  cycleName,
  departments,
  employees,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean
  cycleName: string
  departments: Array<{ value: string; label: string }>
  employees: Array<{ value: string; label: string; employee_no: string | null }>
  saving: boolean
  onClose: () => void
  onSubmit: (payload: { user_ids?: number[]; department_ids?: number[]; due_date?: string | null }) => void
}) {
  const [scope, setScope] = React.useState<'all' | 'department' | 'employees'>('all')
  const [departmentId, setDepartmentId] = React.useState('')
  const [userIds, setUserIds] = React.useState<string[]>([])
  const [dueDate, setDueDate] = React.useState('')

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Launch Reviews</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <p className="text-xs text-muted-foreground">
            Creates one review per participant in <span className="font-semibold text-foreground">{cycleName || 'this cycle'}</span>.
            Employees who already have a review in the cycle are skipped, so this is safe to re-run.
          </p>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Participants</Label>
            <Select
              value={scope}
              options={[
                { value: 'all', label: 'Every employee in the tenant' },
                { value: 'department', label: 'One department' },
                { value: 'employees', label: 'Specific employees' },
              ]}
              onChange={(value) => setScope(value as 'all' | 'department' | 'employees')}
            />
          </div>

          {scope === 'department' && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Department</Label>
              <Select
                value={departmentId}
                placeholder="Select department"
                options={departments}
                onChange={setDepartmentId}
              />
            </div>
          )}

          {scope === 'employees' && (
            <div className="flex max-h-52 flex-col gap-1 overflow-y-auto rounded-lg border p-2 custom-scrollbar">
              {employees.map((employee) => (
                <label key={employee.value} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted">
                  <Checkbox
                    checked={userIds.includes(employee.value)}
                    onCheckedChange={() =>
                      setUserIds((state) =>
                        state.includes(employee.value)
                          ? state.filter((id) => id !== employee.value)
                          : [...state, employee.value],
                      )
                    }
                  />
                  {employee.label}
                  {employee.employee_no ? ` (${employee.employee_no})` : ''}
                </label>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Due date</Label>
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            <span className="text-[10px] text-muted-foreground">
              Left blank, the cycle&apos;s self-review deadline is used.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={saving || (scope === 'department' && !departmentId) || (scope === 'employees' && userIds.length === 0)}
            onClick={() =>
              onSubmit({
                ...(scope === 'department' ? { department_ids: [Number(departmentId)] } : {}),
                ...(scope === 'employees' ? { user_ids: userIds.map(Number) } : {}),
                due_date: dueDate || null,
              })
            }
          >
            Launch Reviews
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TeamDetailsSheet({
  open,
  team,
  onClose,
}: {
  open: boolean
  team: ReturnType<typeof useReviewDetail>['team']
  onClose: () => void
}) {
  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent side="right" className="w-full max-w-md sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{team?.department ? `${team.department} — Rating Distribution` : 'Rating Distribution'}</SheetTitle>
        </SheetHeader>

        {!team ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No comparison data available.</p>
        ) : (
          <div className="flex flex-col gap-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Reviews" value={team.total_reviews} />
              <Metric label="Rated" value={team.rated_count} />
              <Metric label="Average rating" value={team.average_rating ?? '—'} />
              <Metric label="Band" value={team.average_label ?? '—'} />
              <Metric label="Top performers" value={`${team.top_performers} (${team.top_performer_pct}%)`} />
              <Metric label="Low performers" value={`${team.low_performers} (${team.low_performer_pct}%)`} />
            </div>

            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-foreground">Distribution</h4>
              {team.distribution.map((band) => {
                const pct = team.rated_count > 0 ? Math.round((band.count / team.rated_count) * 100) : 0

                return (
                  <div key={band.band} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-xs text-muted-foreground">{band.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs font-semibold text-foreground">
                      {band.count} · {pct}%
                    </span>
                  </div>
                )
              })}
            </div>

            {team.calibration && (
              <div className="flex flex-col gap-1 rounded-lg border bg-muted/20 p-3">
                <span className="text-xs font-semibold text-foreground">{team.calibration.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {team.calibration.status_label}
                  {team.calibration.scheduled_label ? ` · ${team.calibration.scheduled_label}` : ''}
                </span>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border p-3">
      <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
      <span className="text-base font-bold text-foreground">{value}</span>
    </div>
  )
}

function LabelledInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <Input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}
