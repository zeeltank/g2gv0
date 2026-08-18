'use client'

/**
 * Talent Management -> Onboarding & Employee Lifecycle Center.
 *
 * Backed end to end by the Laravel /api/onboarding/* module. Nothing on this
 * screen is placeholder data: every KPI, table row, timeline step, workstream
 * card and sidebar panel is fetched, and every button either mutates through the
 * API or navigates.
 *
 * A journey is picked from the search box or by drilling into a KPI card - the
 * design has no dedicated selector, so the list sheet doubles as one and the
 * right-hand column follows whatever is selected.
 */

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  DollarSign,
  FileCheck,
  FileText,
  Filter,
  Heart,
  Laptop,
  MoreHorizontal,
  Plus,
  Search,
  Shield,
  User,
  UserCheck,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { EMPLOYEE_DIRECTORY_ACCESS_LINK } from '@/lib/gtg-navigation'
import {
  useJourneyDetail,
  useLifecycleTimeline,
  useOnboardingFilters,
  useOnboardingJourneys,
  useOnboardingMutations,
  useOnboardingOverview,
  useOnboardingProbation,
  useOnboardingTasks,
  useOnboardingWorkstreams,
  type MutationResult,
} from '@/hooks/use-onboarding'
import {
  ALL,
  Initials,
  PaginationBar,
  ResultBanner,
  TableMessageRow,
  TableSkeleton,
  activeFilter,
  taskStatusVariant,
} from './onboarding-shared'
import {
  ConfirmDialog,
  ContactsSheet,
  DocumentsSheet,
  JourneyListSheet,
  JourneySheet,
  NotesSheet,
  ProbationDecisionDialog,
  ProbationWindowDialog,
  StageDialog,
  StartFromOfferDialog,
  TaskFiltersSheet,
  TaskSheet,
  withAll,
  type TaskMoreFilters,
} from './onboarding-sheets'
import { OnboardingSidebar } from './onboarding-sidebar'
import { JourneyTab, ProbationTab, TimelineTab } from './onboarding-tabs'
import type {
  JourneyFilters,
  OnbDocument,
  OnbJourney,
  OnbKpi,
  OnbProbation,
  OnbStage,
  OnbTask,
  ProbationFilters,
} from '@/services/talent/onboarding'

type TabId = 'preboarding' | 'journey' | 'probation' | 'timeline'

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'preboarding', label: 'Preboarding', icon: <User className="size-4" /> },
  { id: 'journey', label: 'Onboarding Journey', icon: <CheckCircle2 className="size-4" /> },
  { id: 'probation', label: 'Probation & Confirmation', icon: <FileText className="size-4" /> },
  { id: 'timeline', label: 'Lifecycle Timeline', icon: <Calendar className="size-4" /> },
]

const EMPTY_MORE_FILTERS: TaskMoreFilters = {
  owner_id: ALL,
  status: ALL,
  due_from: '',
  due_to: '',
  overdue_only: false,
}

function kpiIcon(icon: OnbKpi['icon']) {
  switch (icon) {
    case 'user-check':
      return <UserCheck className="size-5 text-primary" />
    case 'calendar':
      return <Calendar className="size-5 text-primary" />
    case 'check-circle':
      return <CheckCircle2 className="size-5 text-primary" />
    case 'shield':
      return <Shield className="size-5 text-primary" />
    default:
      return <Users className="size-5 text-primary" />
  }
}

function workstreamIcon(icon: string) {
  switch (icon) {
    case 'it':
      return <Laptop className="size-5 text-muted-foreground" />
    case 'learning':
      return <BookOpen className="size-5 text-muted-foreground" />
    case 'payroll':
      return <DollarSign className="size-5 text-muted-foreground" />
    case 'benefits':
      return <Heart className="size-5 text-muted-foreground" />
    case 'compliance':
      return <FileCheck className="size-5 text-muted-foreground" />
    default:
      return <FileText className="size-5 text-muted-foreground" />
  }
}

export function OnboardingCenter() {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()

  /* -- Screen state -- */
  const [activeTab, setActiveTab] = React.useState<TabId>('preboarding')
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [result, setResult] = React.useState<MutationResult | null>(null)
  const [selectedJourneyId, setSelectedJourneyId] = React.useState<number | null>(null)
  const [journeyTouched, setJourneyTouched] = React.useState(false)

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

  /* -- Filter options + the journey the screen opens on -- */
  const { options, defaultJourneyId, loading: optionsLoading, error: optionsError, retry: retryOptions } =
    useOnboardingFilters(refreshKey)

  // Adopt the API's default journey once, and only until the user picks one.
  const effectiveJourneyId = journeyTouched
    ? selectedJourneyId
    : selectedJourneyId ?? (defaultJourneyId ? Number(defaultJourneyId) : null)

  const journeyKey = effectiveJourneyId ? String(effectiveJourneyId) : undefined

  /* -- Task table state -- */
  const [taskSearch, setTaskSearch] = React.useState('')
  const [taskCategory, setTaskCategory] = React.useState(ALL)
  const [taskOwner, setTaskOwner] = React.useState(ALL)
  const [moreFilters, setMoreFilters] = React.useState<TaskMoreFilters>(EMPTY_MORE_FILTERS)
  const [taskPage, setTaskPage] = React.useState(1)
  const [taskPerPage, setTaskPerPage] = React.useState(25)
  const [selectedTaskIds, setSelectedTaskIds] = React.useState<number[]>([])

  const taskFilters = React.useMemo(
    () => ({
      journey_id: journeyKey,
      search: taskSearch || undefined,
      category: activeFilter(taskCategory),
      owner_id: activeFilter(taskOwner === ALL ? moreFilters.owner_id : taskOwner),
      status: activeFilter(moreFilters.status),
      due_from: moreFilters.due_from || undefined,
      due_to: moreFilters.due_to || undefined,
      overdue_only: moreFilters.overdue_only || undefined,
      page: taskPage,
      per_page: taskPerPage,
    }),
    [journeyKey, taskSearch, taskCategory, taskOwner, moreFilters, taskPage, taskPerPage],
  )

  /* -- Journey list sheet state -- */
  const [journeyListOpen, setJourneyListOpen] = React.useState(false)
  const [journeyListTitle, setJourneyListTitle] = React.useState('Onboarding Journeys')
  const [journeyFilters, setJourneyFilters] = React.useState<JourneyFilters>({ page: 1, per_page: 25 })

  /* -- Probation tab state -- */
  const [probationFilters, setProbationFilters] = React.useState<ProbationFilters>({ page: 1, per_page: 25 })

  /* -- Dialog / sheet state -- */
  const [taskSheetOpen, setTaskSheetOpen] = React.useState(false)
  const [editingTask, setEditingTask] = React.useState<OnbTask | null>(null)
  const [journeySheetOpen, setJourneySheetOpen] = React.useState(false)
  const [editingJourney, setEditingJourney] = React.useState<OnbJourney | null>(null)
  const [offerDialogOpen, setOfferDialogOpen] = React.useState(false)
  const [filtersSheetOpen, setFiltersSheetOpen] = React.useState(false)
  const [documentsOpen, setDocumentsOpen] = React.useState(false)
  const [contactsOpen, setContactsOpen] = React.useState(false)
  const [notesOpen, setNotesOpen] = React.useState(false)
  const [stageDialog, setStageDialog] = React.useState<OnbStage | null>(null)
  const [probationWindowRow, setProbationWindowRow] = React.useState<OnbProbation | null>(null)
  const [probationDecision, setProbationDecision] = React.useState<{
    row: OnbProbation
    decision: 'confirm' | 'extend' | 'terminate'
  } | null>(null)
  const [confirmation, setConfirmation] = React.useState<{
    title: string
    description?: string
    confirmLabel?: string
    destructive?: boolean
    run: () => Promise<MutationResult>
  } | null>(null)

  /* -- Data -- */
  const { kpis, totals, loading: kpisLoading, error: kpisError, retry: retryKpis } =
    useOnboardingOverview(undefined, refreshKey)

  const { tasks, pagination: taskPagination, summary: taskSummary, loading: tasksLoading, error: tasksError, retry: retryTasks } =
    useOnboardingTasks(taskFilters, refreshKey)

  const { workstreams, loading: workstreamsLoading, error: workstreamsError, retry: retryWorkstreams } =
    useOnboardingWorkstreams(journeyKey, refreshKey)

  const {
    journey, stages, stageProgress, contacts, notes, documents,
    loading: detailLoading, error: detailError, retry: retryDetail,
  } = useJourneyDetail(effectiveJourneyId, refreshKey)

  const {
    journeys, pagination: journeyPagination, loading: journeysLoading,
    error: journeysError, retry: retryJourneys,
  } = useOnboardingJourneys(journeyFilters, journeyListOpen, refreshKey)

  const {
    rows: probationRows, pagination: probationPagination, summary: probationSummary,
    loading: probationLoading, error: probationError, retry: retryProbation,
  } = useOnboardingProbation(probationFilters, activeTab === 'probation', refreshKey)

  const { timeline, loading: timelineLoading, error: timelineError, retry: retryTimeline } =
    useLifecycleTimeline(effectiveJourneyId, activeTab === 'timeline', refreshKey)

  const mutations = useOnboardingMutations()

  /* -- Helpers -- */
  const selectJourney = React.useCallback((id: number | null) => {
    setSelectedJourneyId(id)
    setJourneyTouched(true)
    setTaskPage(1)
    setSelectedTaskIds([])
  }, [])

  const openJourneyList = React.useCallback((title: string, filters: Partial<JourneyFilters> = {}) => {
    setJourneyListTitle(title)
    setJourneyFilters({ page: 1, per_page: 25, ...filters })
    setJourneyListOpen(true)
  }, [])

  /** A KPI's "View all" drills into whatever that card counts. */
  const drillIntoKpi = React.useCallback(
    (kpi: OnbKpi) => {
      if (kpi.id === 'probation-due') {
        setProbationFilters({ page: 1, per_page: 25, due_in_days: '30', confirmation_status: 'pending' })
        setActiveTab('probation')
        return
      }

      if (kpi.id === 'onboarding-completion') {
        setMoreFilters({ ...EMPTY_MORE_FILTERS, status: 'pending' })
        setActiveTab('preboarding')
        setTaskPage(1)
        return
      }

      openJourneyList(kpi.title, kpi.filter as Partial<JourneyFilters>)
    },
    [openJourneyList],
  )

  /**
   * A task cannot exist without a journey (journey_id is required), so Add Task
   * routes to whatever is actually missing instead of sitting disabled: pick a
   * hire when journeys exist, create the first one when none do.
   */
  const hasJourneys = (options?.journeys.length ?? 0) > 0

  const startAddTask = React.useCallback(() => {
    if (effectiveJourneyId) {
      setEditingTask(null)
      setTaskSheetOpen(true)
      return
    }

    if (hasJourneys) {
      openJourneyList('Select a hire to add a task for')
      return
    }

    setEditingJourney(null)
    setJourneySheetOpen(true)
  }, [effectiveJourneyId, hasJourneys, openJourneyList])

  /** "Browse journeys" is a dead end on an empty tenant - offer creation instead. */
  const browseOrCreateJourneys = React.useCallback(() => {
    if (hasJourneys) {
      openJourneyList('Onboarding Journeys')
      return
    }

    setEditingJourney(null)
    setJourneySheetOpen(true)
  }, [hasJourneys, openJourneyList])

  const addTaskHint = effectiveJourneyId
    ? 'Add a preboarding task for this hire'
    : hasJourneys
      ? 'Select a hire first'
      : 'Create an onboarding journey first'

  const toggleTaskSelection = (id: number) => {
    setSelectedTaskIds((state) =>
      state.includes(id) ? state.filter((value) => value !== id) : [...state, id],
    )
  }

  const allVisibleSelected = tasks.length > 0 && tasks.every((task) => selectedTaskIds.includes(task.id))

  const clearFilters = () => {
    setTaskSearch('')
    setTaskCategory(ALL)
    setTaskOwner(ALL)
    setMoreFilters(EMPTY_MORE_FILTERS)
    setTaskPage(1)
  }

  const activeFilterCount =
    (taskCategory !== ALL ? 1 : 0) +
    (taskOwner !== ALL ? 1 : 0) +
    (moreFilters.owner_id !== ALL ? 1 : 0) +
    (moreFilters.status !== ALL ? 1 : 0) +
    (moreFilters.due_from ? 1 : 0) +
    (moreFilters.due_to ? 1 : 0) +
    (moreFilters.overdue_only ? 1 : 0)

  /** Export what the task table currently shows, client-side - no new endpoint. */
  const exportTasks = () => {
    if (tasks.length === 0) {
      setResult({ ok: false, message: 'There is nothing to export.' })
      return
    }

    const header = ['Task', 'Category', 'Due Date', 'Owner', 'Status']
    const rows = tasks.map((task) => [
      task.title,
      task.category_label ?? '',
      task.due_date_label ?? '',
      task.owner_name ?? '',
      task.status_label ?? '',
    ])

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `onboarding-tasks-${journey?.journey_code ?? 'all'}.csv`
    link.click()
    URL.revokeObjectURL(url)

    setResult({ ok: true, message: `Exported ${tasks.length} task(s).` })
  }

  const remindOpenTasks = async () => {
    const open = tasks.filter((task) => task.status !== 'completed').map((task) => task.id)

    if (open.length === 0) {
      setResult({ ok: false, message: 'There are no open tasks to remind about.' })
      return
    }

    await report(mutations.bulkTasks('remind', open))
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background animate-in fade-in duration-300">
      {/* ============================== Header ============================== */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Home</span>
            <ChevronRight className="size-3.5" />
            <span>Onboarding & Lifecycle</span>
            <ChevronRight className="size-3.5" />
            <button
              type="button"
              className="transition-colors hover:text-foreground"
              onClick={browseOrCreateJourneys}
            >
              New Hire Journey
            </button>
            <ChevronRight className="size-3.5" />
            <span className="font-semibold text-foreground">
              {journey?.journey_code ?? (detailLoading ? '…' : 'No hire selected')}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Onboarding & Employee Lifecycle Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage end-to-end employee onboarding and lifecycle milestones.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden w-64 md:block">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search for employee, candidate, requisition..."
              className="bg-background pl-9"
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                const value = (event.target as HTMLInputElement).value.trim()
                openJourneyList(value ? `Results for “${value}”` : 'Onboarding Journeys', { search: value })
              }}
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 bg-background">
                More Actions <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setEditingJourney(null)
                  setJourneySheetOpen(true)
                }}
              >
                New journey
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setOfferDialogOpen(true)}>
                Start from accepted offer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openJourneyList('Onboarding Journeys')}>
                Browse all journeys
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={remindOpenTasks} disabled={mutations.saving}>
                Send reminders for open tasks
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportTasks}>Export tasks (CSV)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button className="gap-2" title={addTaskHint} onClick={startAddTask}>
            <Plus className="size-4" /> Add Task
          </Button>
        </div>
      </div>

      {/* =============================== Tabs =============================== */}
      <div className="mb-6 flex min-w-max items-center gap-6 overflow-x-auto border-b border-border/40 px-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 border-b-2 py-3 text-sm font-semibold outline-none transition-all',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto pb-8 pr-2">
        {result && (
          <div className="mb-4">
            <ResultBanner result={result} onDismiss={() => setResult(null)} />
          </div>
        )}

        {optionsError && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
            <span className="text-sm text-destructive">{optionsError}</span>
            <Button variant="outline" size="sm" onClick={retryOptions}>
              Retry
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="flex flex-col gap-6 xl:col-span-9">
            {/* ============================== KPIs ============================== */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              {kpisLoading &&
                Array.from({ length: 5 }).map((_, index) => (
                  <Card key={index} className="shadow-sm">
                    <CardContent className="flex flex-col gap-3 p-4">
                      <Skeleton className="size-10 rounded-xl" />
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-7 w-12" />
                      <Skeleton className="h-3 w-16" />
                    </CardContent>
                  </Card>
                ))}

              {!kpisLoading && kpisError && (
                <Card className="col-span-full border-destructive/30 bg-destructive/5 shadow-sm">
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <span className="text-sm text-destructive">{kpisError}</span>
                    <Button variant="outline" size="sm" onClick={retryKpis}>
                      Retry
                    </Button>
                  </CardContent>
                </Card>
              )}

              {!kpisLoading &&
                !kpisError &&
                kpis.map((kpi) => (
                  <Card key={kpi.id} className="shadow-sm">
                    <CardContent className="flex h-full flex-col gap-2 p-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">{kpiIcon(kpi.icon)}</div>
                        <span className="text-sm font-semibold text-foreground/80">{kpi.title}</span>
                      </div>
                      <div className="mt-1 flex flex-col gap-2 pl-[52px]">
                        <span className="text-3xl font-bold leading-none text-foreground">{kpi.value}</span>
                        {kpi.progress !== undefined && (
                          <Progress value={kpi.progress} className="mt-1 h-1.5 w-full bg-muted" />
                        )}
                        <span className="text-[11px] text-muted-foreground">{kpi.subtitle}</span>
                      </div>
                      <div className="mt-auto pl-[52px] pt-4">
                        <button
                          type="button"
                          onClick={() => drillIntoKpi(kpi)}
                          className="text-left text-xs font-bold text-primary hover:underline"
                        >
                          {kpi.id === 'onboarding-completion' ? 'View pending tasks' : 'View all'}
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>

            {/* ============================== Tab body ============================== */}
            {activeTab === 'preboarding' && (
              <>
                <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
                  {/* Preboarding tasks */}
                  <div className="lg:col-span-2">
                    <Card className="flex h-full flex-col shadow-sm">
                      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 p-4 pb-0">
                        <CardTitle className="text-base">Preboarding Tasks</CardTitle>
                        <div className="flex items-center gap-2">
                          <div className="w-[150px]">
                            <Select
                              value={taskCategory}
                              options={withAll(options?.categories ?? [], 'All Tasks')}
                              onChange={(value) => {
                                setTaskCategory(value)
                                setTaskPage(1)
                              }}
                              aria-label="Filter by category"
                            />
                          </div>
                          <div className="w-[150px]">
                            <Select
                              value={taskOwner}
                              options={withAll(options?.owners ?? [], 'All Owners')}
                              onChange={(value) => {
                                setTaskOwner(value)
                                setTaskPage(1)
                              }}
                              aria-label="Filter by owner"
                            />
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            className="relative size-9 bg-background"
                            onClick={() => setFiltersSheetOpen(true)}
                            aria-label="More filters"
                          >
                            <Filter className="size-4" />
                            {activeFilterCount > 0 && (
                              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                                {activeFilterCount}
                              </span>
                            )}
                          </Button>
                        </div>
                      </CardHeader>

                      <CardContent className="mt-4 flex flex-1 flex-col justify-between p-0">
                        {selectedTaskIds.length > 0 && (
                          <div className="mx-4 mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                            <span className="text-xs font-semibold text-foreground">
                              {selectedTaskIds.length} selected
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={mutations.saving}
                              onClick={async () => {
                                await report(mutations.bulkTasks('complete', selectedTaskIds))
                                setSelectedTaskIds([])
                              }}
                            >
                              Mark complete
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={mutations.saving}
                              onClick={async () => {
                                await report(mutations.bulkTasks('remind', selectedTaskIds))
                                setSelectedTaskIds([])
                              }}
                            >
                              Send reminder
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              disabled={mutations.saving}
                              onClick={() =>
                                setConfirmation({
                                  title: `Delete ${selectedTaskIds.length} task(s)?`,
                                  description: 'They will no longer appear on this journey.',
                                  confirmLabel: 'Delete',
                                  destructive: true,
                                  run: async () => {
                                    const outcome = await mutations.bulkTasks('delete', selectedTaskIds)
                                    setSelectedTaskIds([])
                                    return outcome
                                  },
                                })
                              }
                            >
                              Delete
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedTaskIds([])}>
                              Clear
                            </Button>
                          </div>
                        )}

                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="w-10 pl-4">
                                <Checkbox
                                  checked={allVisibleSelected}
                                  indeterminate={selectedTaskIds.length > 0 && !allVisibleSelected}
                                  onCheckedChange={(checked) =>
                                    setSelectedTaskIds(checked ? tasks.map((task) => task.id) : [])
                                  }
                                  aria-label="Select all tasks"
                                />
                              </TableHead>
                              <TableHead>Task</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead>Due Date</TableHead>
                              <TableHead>Owner</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="w-10 pr-4" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tasksLoading && <TableSkeleton columns={7} />}

                            {!tasksLoading && tasksError && (
                              <TableMessageRow
                                colSpan={7}
                                tone="error"
                                title="Could not load preboarding tasks"
                                description={tasksError}
                                action={
                                  <Button variant="outline" size="sm" onClick={retryTasks}>
                                    Retry
                                  </Button>
                                }
                              />
                            )}

                            {!tasksLoading && !tasksError && tasks.length === 0 && (
                              <TableMessageRow
                                colSpan={7}
                                title={effectiveJourneyId ? 'No tasks match these filters' : 'No hire selected'}
                                description={
                                  effectiveJourneyId
                                    ? 'Add a task, or clear the filters to see everything.'
                                    : 'Pick an onboarding journey to see its preboarding checklist.'
                                }
                                action={
                                  effectiveJourneyId ? (
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setEditingTask(null)
                                          setTaskSheetOpen(true)
                                        }}
                                      >
                                        Add task
                                      </Button>
                                      {activeFilterCount > 0 && (
                                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                                          Clear filters
                                        </Button>
                                      )}
                                    </div>
                                  ) : (
                                    <Button variant="outline" size="sm" onClick={browseOrCreateJourneys}>
                                      {hasJourneys ? 'Browse journeys' : 'Create journey'}
                                    </Button>
                                  )
                                }
                              />
                            )}

                            {!tasksLoading &&
                              !tasksError &&
                              tasks.map((task) => (
                                <TableRow key={task.id}>
                                  <TableCell className="py-3 pl-4">
                                    <Checkbox
                                      checked={selectedTaskIds.includes(task.id)}
                                      onCheckedChange={() => toggleTaskSelection(task.id)}
                                      aria-label={`Select ${task.title}`}
                                    />
                                  </TableCell>
                                  <TableCell className="py-3 text-sm font-medium text-foreground">
                                    <button
                                      type="button"
                                      className="text-left hover:underline"
                                      onClick={() => {
                                        setEditingTask(task)
                                        setTaskSheetOpen(true)
                                      }}
                                    >
                                      {task.title}
                                    </button>
                                  </TableCell>
                                  <TableCell className="py-3 text-sm text-muted-foreground">
                                    {task.category_label ?? '—'}
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      'py-3 text-sm',
                                      task.is_overdue ? 'font-semibold text-destructive' : 'text-muted-foreground',
                                    )}
                                  >
                                    {task.due_date_label ?? '—'}
                                  </TableCell>
                                  <TableCell className="py-3">
                                    <div className="flex items-center gap-2">
                                      <Initials value={task.owner_initials} />
                                      <span className="text-sm text-foreground">{task.owner_name ?? 'Unassigned'}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-3">
                                    <StatusBadge variant={taskStatusVariant(task.status)} size="sm">
                                      {task.status === 'completed' && <Check className="mr-1 inline size-3" />}
                                      {task.status_label}
                                    </StatusBadge>
                                  </TableCell>
                                  <TableCell className="py-3 pr-4 text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger className="rounded p-1 text-muted-foreground outline-none hover:bg-muted">
                                        <MoreHorizontal className="size-4" />
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          onClick={() =>
                                            report(mutations.completeTask(task.id, task.status === 'completed'))
                                          }
                                        >
                                          {task.status === 'completed' ? 'Reopen' : 'Mark Complete'}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => {
                                            setEditingTask(task)
                                            setTaskSheetOpen(true)
                                          }}
                                        >
                                          Edit Task
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => report(mutations.bulkTasks('remind', [task.id]))}>
                                          Send Reminder
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={() =>
                                            setConfirmation({
                                              title: 'Delete this task?',
                                              description: task.title,
                                              confirmLabel: 'Delete',
                                              destructive: true,
                                              run: () => mutations.deleteTask(task.id),
                                            })
                                          }
                                        >
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>

                        <PaginationBar
                          page={taskPagination.page}
                          perPage={taskPagination.per_page}
                          total={taskPagination.total}
                          lastPage={taskPagination.last_page}
                          onPageChange={setTaskPage}
                          onPerPageChange={(value) => {
                            setTaskPerPage(value)
                            setTaskPage(1)
                          }}
                        />
                      </CardContent>
                    </Card>
                  </div>

                  {/* Journey progress */}
                  <div className="lg:col-span-1">
                    <Card className="flex h-full flex-col shadow-sm">
                      <CardHeader className="border-b border-border/40 p-4 pb-2">
                        <CardTitle className="text-base">Onboarding Journey Progress</CardTitle>
                        <div className="mb-2 mt-4 flex flex-col gap-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Overall Progress</span>
                            <span className="text-xl font-bold text-primary">{stageProgress}%</span>
                          </div>
                          <Progress value={stageProgress} className="h-2 bg-muted" />
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 overflow-y-auto p-5 pt-6">
                        {detailLoading && (
                          <div className="flex flex-col gap-4">
                            {Array.from({ length: 6 }).map((_, index) => (
                              <Skeleton key={index} className="h-8 w-full" />
                            ))}
                          </div>
                        )}

                        {!detailLoading && !journey && (
                          <div className="flex flex-col items-center gap-2 py-8 text-center">
                            <span className="text-sm text-muted-foreground">No hire selected.</span>
                            <Button variant="outline" size="sm" onClick={browseOrCreateJourneys}>
                              {hasJourneys ? 'Browse journeys' : 'Create journey'}
                            </Button>
                          </div>
                        )}

                        {!detailLoading && journey && stages.length > 0 && (
                          <div className="relative space-y-6 pl-6">
                            <div className="absolute bottom-4 left-[11px] top-2 w-0.5 bg-border/60" />
                            {stages.map((stage) => (
                              <button
                                key={stage.id}
                                type="button"
                                onClick={() => setStageDialog(stage)}
                                className="relative block w-full text-left"
                              >
                                <div
                                  className={cn(
                                    'absolute -left-6 top-0.5 flex size-4 items-center justify-center rounded-full border-2 bg-background',
                                    stage.status === 'completed'
                                      ? 'border-primary bg-primary'
                                      : stage.status === 'in_progress'
                                        ? 'border-primary ring-2 ring-primary/20'
                                        : 'border-border/80',
                                  )}
                                >
                                  {stage.status === 'completed' && (
                                    <CheckCircle2 className="size-2.5 text-primary-foreground" />
                                  )}
                                  {stage.status === 'in_progress' && (
                                    <div className="size-1.5 rounded-full bg-primary" />
                                  )}
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span
                                    className={cn(
                                      'text-sm font-semibold',
                                      stage.status === 'in_progress'
                                        ? 'text-primary'
                                        : stage.status === 'completed'
                                          ? 'text-foreground'
                                          : 'text-muted-foreground',
                                    )}
                                  >
                                    {stage.title}
                                  </span>
                                  {stage.date_label && (
                                    <span
                                      className={cn(
                                        'text-xs',
                                        stage.status === 'in_progress'
                                          ? 'font-medium text-primary/70'
                                          : 'text-muted-foreground',
                                      )}
                                    >
                                      {stage.date_label}
                                    </span>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Integrations */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-foreground">Onboarding Integrations & Tasks</h3>
                    {workstreamsError && (
                      <Button variant="outline" size="sm" onClick={retryWorkstreams}>
                        Retry
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                    {workstreamsLoading &&
                      Array.from({ length: 5 }).map((_, index) => (
                        <Card key={index} className="shadow-sm">
                          <CardContent className="flex flex-col gap-2 p-3">
                            <Skeleton className="size-8 rounded-lg" />
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-2 w-24" />
                          </CardContent>
                        </Card>
                      ))}

                    {!workstreamsLoading &&
                      workstreams.map((workstream) => (
                        <Card
                          key={workstream.id}
                          className={cn(
                            'cursor-pointer shadow-sm transition-colors hover:border-primary/40',
                            taskCategory === workstream.category && 'border-primary',
                          )}
                          onClick={() => {
                            setTaskCategory(taskCategory === workstream.category ? ALL : workstream.category)
                            setTaskPage(1)
                          }}
                        >
                          <CardContent className="flex items-start gap-3 p-3">
                            <div className="mt-0.5 shrink-0 rounded-lg bg-muted/50 p-2 text-muted-foreground">
                              {workstreamIcon(workstream.icon)}
                            </div>
                            <div className="flex min-w-0 flex-col gap-1">
                              <span className="line-clamp-1 text-xs font-bold text-foreground">
                                {workstream.title}
                              </span>
                              <span className="line-clamp-1 text-[10px] text-muted-foreground">
                                {workstream.description}
                              </span>
                              <div className="mt-1">
                                <span
                                  className={cn(
                                    'rounded px-2 py-0.5 text-[10px] font-semibold',
                                    workstream.status === 'In Progress'
                                      ? 'bg-primary/10 text-primary'
                                      : workstream.status === 'Completed'
                                        ? 'bg-success/10 text-success'
                                        : 'bg-muted/50 text-muted-foreground',
                                  )}
                                >
                                  {workstream.status}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'journey' && (
              <JourneyTab
                journey={journey}
                stages={stages}
                progress={stageProgress}
                loading={detailLoading}
                error={detailError}
                saving={mutations.saving}
                onEditStage={setStageDialog}
                onToggleStage={(stage) =>
                  report(mutations.completeStage(stage.id, stage.status === 'completed'))
                }
                onRetry={retryDetail}
                onPickJourney={browseOrCreateJourneys}
              />
            )}

            {activeTab === 'probation' && (
              <ProbationTab
                rows={probationRows}
                pagination={probationPagination}
                summary={probationSummary}
                loading={probationLoading}
                error={probationError}
                saving={mutations.saving}
                filters={probationFilters}
                options={options}
                onFilterChange={(patch) => setProbationFilters((state) => ({ ...state, ...patch }))}
                onDecide={(row, decision) => setProbationDecision({ row, decision })}
                onEditWindow={setProbationWindowRow}
                onRetry={retryProbation}
              />
            )}

            {activeTab === 'timeline' && (
              <TimelineTab
                journey={journey}
                timeline={timeline}
                loading={timelineLoading || detailLoading}
                error={timelineError}
                onRetry={retryTimeline}
                onPickJourney={browseOrCreateJourneys}
              />
            )}
          </div>

          {/* ============================== Sidebar ============================== */}
          <div className="flex h-full flex-col gap-4 xl:col-span-3">
            <OnboardingSidebar
              journey={journey}
              documents={documents}
              contacts={contacts}
              notes={notes}
              loading={detailLoading}
              error={detailError}
              onRetry={retryDetail}
              onPickJourney={browseOrCreateJourneys}
              onEditJourney={() => {
                setEditingJourney(journey)
                setJourneySheetOpen(true)
              }}
              onViewEmployee={() => router.push(resolveAccessLink(EMPLOYEE_DIRECTORY_ACCESS_LINK))}
              onOpenDocuments={() => setDocumentsOpen(true)}
              onOpenContacts={() => setContactsOpen(true)}
              onOpenNotes={() => setNotesOpen(true)}
            />
          </div>
        </div>

        {totals && !kpisLoading && (
          <p className="mt-6 text-xs text-muted-foreground">
            {totals.total_journeys} journey(s) · {totals.completed_tasks}/{totals.total_tasks} tasks complete ·{' '}
            {totals.overdue_tasks} overdue
            {taskSummary ? ` · ${taskSummary.total} task(s) in the current view` : ''}
          </p>
        )}
      </div>

      {/* ============================== Overlays ============================== */}
      <TaskSheet
        open={taskSheetOpen}
        task={editingTask}
        journeyId={effectiveJourneyId}
        journeyName={journey?.name ?? null}
        options={options}
        saving={mutations.saving}
        onClose={() => setTaskSheetOpen(false)}
        onSubmit={async (payload) => {
          const outcome = await report(
            editingTask
              ? mutations.updateTask(editingTask.id, payload)
              : mutations.createTask(payload),
          )
          if (outcome.ok) setTaskSheetOpen(false)
        }}
      />

      <JourneySheet
        open={journeySheetOpen}
        journey={editingJourney}
        options={options}
        saving={mutations.saving}
        onClose={() => setJourneySheetOpen(false)}
        onSubmit={async (payload) => {
          const outcome = await report(
            editingJourney
              ? mutations.updateJourney(editingJourney.id, payload)
              : mutations.createJourney(payload),
          )
          if (!outcome.ok) return
          setJourneySheetOpen(false)
          // Land on the journey that was just created, so Add Task works next.
          if (!editingJourney && outcome.id) selectJourney(outcome.id)
        }}
      />

      <StartFromOfferDialog
        open={offerDialogOpen}
        options={options}
        saving={mutations.saving}
        onClose={() => setOfferDialogOpen(false)}
        onSubmit={async (offerId) => {
          const outcome = await report(mutations.createJourneyFromOffer(offerId))
          if (!outcome.ok) return
          setOfferDialogOpen(false)
          if (outcome.id) selectJourney(outcome.id)
          else openJourneyList('Onboarding Journeys')
        }}
      />

      <JourneyListSheet
        open={journeyListOpen}
        title={journeyListTitle}
        journeys={journeys}
        pagination={journeyPagination}
        loading={journeysLoading}
        error={journeysError}
        filters={journeyFilters}
        options={options}
        selectedId={effectiveJourneyId}
        onFilterChange={(patch) => setJourneyFilters((state) => ({ ...state, ...patch }))}
        onSelect={(selected) => {
          selectJourney(selected.id)
          setJourneyListOpen(false)
        }}
        onEdit={(selected) => {
          setEditingJourney(selected)
          setJourneySheetOpen(true)
        }}
        onDelete={(selected) =>
          setConfirmation({
            title: 'Delete this onboarding journey?',
            description: `${selected.name} (${selected.journey_code}) and all its tasks, stages, documents and notes will be removed.`,
            confirmLabel: 'Delete',
            destructive: true,
            run: async () => {
              const outcome = await mutations.deleteJourney(selected.id)
              if (outcome.ok && effectiveJourneyId === selected.id) selectJourney(null)
              return outcome
            },
          })
        }
        onClose={() => setJourneyListOpen(false)}
        onRetry={retryJourneys}
      />

      <TaskFiltersSheet
        open={filtersSheetOpen}
        value={moreFilters}
        options={options}
        onApply={(filters) => {
          setMoreFilters(filters)
          setTaskPage(1)
          setFiltersSheetOpen(false)
        }}
        onReset={() => {
          setMoreFilters(EMPTY_MORE_FILTERS)
          setTaskPage(1)
          setFiltersSheetOpen(false)
        }}
        onClose={() => setFiltersSheetOpen(false)}
      />

      <DocumentsSheet
        open={documentsOpen}
        documents={documents}
        options={options}
        saving={mutations.saving}
        journeyName={journey?.name ?? null}
        onClose={() => setDocumentsOpen(false)}
        onCreate={(payload) => {
          if (effectiveJourneyId) report(mutations.createDocument(effectiveJourneyId, payload))
        }}
        onUpload={(documentId, file) => report(mutations.uploadDocumentFile(documentId, file))}
        onStatusChange={(documentId, status: OnbDocument['status']) =>
          report(mutations.updateDocument(documentId, { status }))
        }
        onDelete={(documentId) =>
          setConfirmation({
            title: 'Delete this document?',
            confirmLabel: 'Delete',
            destructive: true,
            run: () => mutations.deleteDocument(documentId),
          })
        }
      />

      <ContactsSheet
        open={contactsOpen}
        contacts={contacts}
        journeyName={journey?.name ?? null}
        onClose={() => setContactsOpen(false)}
        onAssign={() => {
          setContactsOpen(false)
          setEditingJourney(journey)
          setJourneySheetOpen(true)
        }}
      />

      <NotesSheet
        open={notesOpen}
        notes={notes}
        saving={mutations.saving}
        journeyName={journey?.name ?? null}
        onClose={() => setNotesOpen(false)}
        onCreate={(payload) => {
          if (effectiveJourneyId) report(mutations.createNote(effectiveJourneyId, payload))
        }}
        onUpdate={(id, payload) => report(mutations.updateNote(id, payload))}
        onDelete={(id) =>
          setConfirmation({
            title: 'Delete this note?',
            confirmLabel: 'Delete',
            destructive: true,
            run: () => mutations.deleteNote(id),
          })
        }
      />

      <StageDialog
        open={Boolean(stageDialog)}
        stage={stageDialog}
        saving={mutations.saving}
        onClose={() => setStageDialog(null)}
        onSubmit={async (payload) => {
          if (!stageDialog) return
          const outcome = await report(mutations.updateStage(stageDialog.id, payload))
          if (outcome.ok) setStageDialog(null)
        }}
      />

      <ProbationWindowDialog
        open={Boolean(probationWindowRow)}
        row={probationWindowRow}
        saving={mutations.saving}
        onClose={() => setProbationWindowRow(null)}
        onSubmit={async (payload) => {
          if (!probationWindowRow) return
          const outcome = await report(mutations.updateProbation(probationWindowRow.id, payload))
          if (outcome.ok) setProbationWindowRow(null)
        }}
      />

      <ProbationDecisionDialog
        open={Boolean(probationDecision)}
        row={probationDecision?.row ?? null}
        decision={probationDecision?.decision ?? 'confirm'}
        saving={mutations.saving}
        onClose={() => setProbationDecision(null)}
        onSubmit={async (payload) => {
          if (!probationDecision) return
          const outcome = await report(
            mutations.decideProbation(probationDecision.row.id, probationDecision.decision, payload),
          )
          if (outcome.ok) setProbationDecision(null)
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.title ?? ''}
        description={confirmation?.description}
        confirmLabel={confirmation?.confirmLabel}
        destructive={confirmation?.destructive}
        saving={mutations.saving}
        onClose={() => setConfirmation(null)}
        onConfirm={async () => {
          if (!confirmation) return
          await report(confirmation.run())
          setConfirmation(null)
        }}
      />
    </div>
  )
}
