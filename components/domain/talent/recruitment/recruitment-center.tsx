'use client'

import React, { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Briefcase,
  Users,
  FileText,
  Filter,
  Search,
  Plus,
  ChevronDown,
  MoreHorizontal,
  Upload,
  Star,
  LayoutGrid,
  List,
  CalendarDays,
  Mail,
  Tag,
  MoveRight,
  UserPlus,
  ChevronRight,
  Settings,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  PIPELINE_STAGES,
  canProgressCandidate,
  type Candidate,
  type CandidateStage,
} from './recruitment-data'
import { useRecruitment } from '@/hooks/use-recruitment'
import { KanbanColumn } from './candidate-kanban'
import { CandidateDetailPanel } from './candidate-detail-panel'
import { TalentProfileView } from '../profile/talent-profile-view'
import { RecruitmentActionDrawer, type RecruitmentAction } from './recruitment-action-drawer'
import { recruitmentService } from '@/services/talent'
import { InterviewToolsDrawer } from './interview-tools-drawer'
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// -------------------------------------------------------------------
// KPI Card (reusable within this feature)
// -------------------------------------------------------------------
function KpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  subtitleColor,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  subtitle: string
  subtitleColor?: string
}) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5 flex items-start gap-4">
        <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border/60">
          <Icon className="size-5 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
          <span className="text-2xl font-black text-foreground tracking-tight">{value}</span>
          <span className={cn('text-xs font-bold', subtitleColor || 'text-muted-foreground')}>{subtitle}</span>
        </div>
      </CardContent>
    </Card>
  )
}

// -------------------------------------------------------------------
// Stage badge variant helper
// -------------------------------------------------------------------
function getStageVariant(stage: CandidateStage): 'default' | 'active' | 'inactive' | 'pending' | 'error' | 'processing' {
  const map: Record<CandidateStage, 'default' | 'active' | 'inactive' | 'pending' | 'error' | 'processing'> = {
    Applied: 'default',
    Screened: 'processing',
    Assessment: 'pending',
    Interview: 'processing',
    Offer: 'active',
    Hired: 'active',
    Rejected: 'error',
  }
  return map[stage]
}

// -------------------------------------------------------------------
// Tab type
// -------------------------------------------------------------------
type MainTab = 'requisitions' | 'job-openings' | 'candidates' | 'interviews' | 'offers'
type CandidateView = 'kanban' | 'table' | 'calendar'

/**
 * Deep links into this screen, used by the Talent Dashboard's Quick Links and
 * KPI cards: ?tab=<MainTab> lands on a tab, ?action=<RecruitmentAction> opens
 * the matching create drawer.
 *
 * Read once, as the initial state, rather than kept in sync with the URL: once
 * the user is here their own clicks own the state, and re-applying the param on
 * every render would reopen a drawer they had just closed.
 */
const DEEP_LINK_TABS: MainTab[] = ['requisitions', 'job-openings', 'candidates', 'interviews', 'offers']
const DEEP_LINK_ACTIONS: RecruitmentAction[] = ['job', 'candidate', 'interview', 'offer']

function readDeepLinkTab(value: string | null): MainTab | null {
  return DEEP_LINK_TABS.includes(value as MainTab) ? (value as MainTab) : null
}

function readDeepLinkAction(value: string | null): RecruitmentAction | null {
  return DEEP_LINK_ACTIONS.includes(value as RecruitmentAction) ? (value as RecruitmentAction) : null
}

// -------------------------------------------------------------------
// Main Component
// -------------------------------------------------------------------
export function RecruitmentCenter() {
  const router = useRouter()
  const {
    candidates,
    jobs,
    jobRecords,
    interviews,
    interviewRecords,
    offers,
    offerRecords,
    requisitions,
    teamOverview,
    pendingFeedbackCount,
    loading,
    error,
    refresh,
    moveCandidate,
    stageCounts: backendStageCounts,
  } = useRecruitment()
  const searchParams = useSearchParams()
  // State
  const [activeTab, setActiveTab] = useState<MainTab>(
    () => readDeepLinkTab(searchParams.get('tab')) ?? 'candidates',
  )
  const [candidateView, setCandidateView] = useState<CandidateView>('kanban')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedJob, setSelectedJob] = useState('')
  const [selectedStage, setSelectedStage] = useState('')
  const [selectedSource, setSelectedSource] = useState('')
  const [selectedRecruiter, setSelectedRecruiter] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [tableStatus, setTableStatus] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  /**
   * The candidate the action drawer opens against.
   *
   * Named for interviews because that was its only use; it now also carries the
   * candidate into "Create offer", which is what lets that form pre-fill. Kept
   * under one name because the drawer takes exactly one `preselectedCandidate`
   * and two states for the same slot would drift.
   */
  const [interviewCandidate, setInterviewCandidate] = useState<Candidate | null>(null)
  const [viewingProfileFor, setViewingProfileFor] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [activeAction, setActiveAction] = useState<RecruitmentAction | null>(
    () => readDeepLinkAction(searchParams.get('action')),
  )
  const [interviewTool, setInterviewTool] = useState<'panels' | 'feedback' | 'decision' | null>(null)
  const [decisionInterviewId, setDecisionInterviewId] = useState<string | null>(null)
  const [selectedJobRecord, setSelectedJobRecord] = useState<(typeof jobRecords)[number] | null>(null)
  const [selectedInterviewRecord, setSelectedInterviewRecord] = useState<(typeof interviewRecords)[number] | null>(null)
  const [selectedOfferRecord, setSelectedOfferRecord] = useState<(typeof offerRecords)[number] | null>(null)
  const [confirmation, setConfirmation] = useState<{ title: string; description: string; run: () => Promise<unknown> } | null>(null)
  /**
   * The candidate's accept/decline link, after HR issues it.
   *
   * Shown rather than assumed: outbound mail is gated per organisation, so the
   * recruiter is told plainly whether it was emailed and can copy it either way.
   */
  const [candidateLink, setCandidateLink] = useState<{ url: string; emailSent: boolean; message: string } | null>(null)

  /*
   * Rows per page is state, not a constant, because the settings button beside
   * the paginator now changes it. It was a fixed 25 and that button did nothing.
   */
  const [pageSize, setPageSize] = useState(25)

  /** How many filters are actually narrowing the list, for the clear button. */
  const activeFilterCount = [
    searchQuery, selectedJob, selectedStage, selectedSource, selectedRecruiter, selectedLocation,
  ].filter(Boolean).length

  const tabs: { id: MainTab; label: string }[] = [
    { id: 'requisitions', label: 'Requisitions' },
    { id: 'job-openings', label: 'Job Openings' },
    { id: 'candidates', label: 'Candidates' },
    { id: 'interviews', label: 'Interviews' },
    { id: 'offers', label: 'Offers' },
  ]

  // Filtered candidates
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase()) && !c.role.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (selectedJob && c.jobOpening !== selectedJob) return false
      if (selectedStage && c.stage !== selectedStage) return false
      if (selectedSource && c.source !== selectedSource) return false
      if (selectedRecruiter && c.recruiter !== selectedRecruiter) return false
      if (selectedLocation && c.location !== selectedLocation) return false
      return true
    })
  }, [candidates, searchQuery, selectedJob, selectedStage, selectedSource, selectedRecruiter, selectedLocation])

  // Candidates grouped by stage for Kanban
  const candidatesByStage = useMemo(() => {
    const map: Record<CandidateStage, Candidate[]> = {
      Applied: [], Screened: [], Assessment: [], Interview: [], Offer: [], Hired: [], Rejected: [],
    }
    filteredCandidates.forEach((candidate) => {
      const column = map[candidate.stage]
      if (column) column.push(candidate)
    })
    return map
  }, [filteredCandidates])

  // Counts follow the active job/search/filter selection, just like the columns.
  const stageCounts: Record<CandidateStage, number> = useMemo(() => {
    if (!searchQuery && !selectedJob && !selectedStage && !selectedSource && !selectedRecruiter && !selectedLocation) {
      return { ...backendStageCounts, Rejected: 0 }
    }
    const counts: Record<CandidateStage, number> = { Applied: 0, Screened: 0, Assessment: 0, Interview: 0, Offer: 0, Hired: 0, Rejected: 0 }
    filteredCandidates.forEach((candidate) => {
      if (candidate.stage in counts) counts[candidate.stage] += 1
    })
    return counts
  }, [backendStageCounts, filteredCandidates, searchQuery, selectedJob, selectedStage, selectedSource, selectedRecruiter, selectedLocation])

  // Unique values for filters
  const uniqueJobs = [...new Set(candidates.map((c) => c.jobOpening))]
  const hasFilterValue = (value: string) => Boolean(value && value !== '—' && value !== '-' && value !== 'N/A')
  const uniqueSources = [...new Set(candidates.map((c) => c.source).filter(hasFilterValue))]
  const uniqueRecruiters = [...new Set(candidates.map((c) => c.recruiter).filter(hasFilterValue))]
  const uniqueLocations = [...new Set(candidates.map((c) => c.location).filter(hasFilterValue))]

  const sortedJobs = useMemo(
    () => [...jobs].sort((a, b) => Number(a.status === 'Closed') - Number(b.status === 'Closed')),
    [jobs],
  )

  // Pagination
  const totalPages = Math.ceil(filteredCandidates.length / pageSize)
  const paginatedCandidates = filteredCandidates.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleSelectAll = () => {
    if (selectedIds.length === paginatedCandidates.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(paginatedCandidates.map((c) => c.id))
    }
  }

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  if (viewingProfileFor) {
    return (
      <TalentProfileView 
        profileId={viewingProfileFor} 
        onBack={() => setViewingProfileFor(null)} 
      />
    )
  }

  if (loading) {
    return <div className="flex min-h-[360px] items-center justify-center text-sm font-medium text-muted-foreground">Loading recruitment data…</div>
  }

  if (error) {
    return (
      <Card className="m-6 border-destructive/30">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <p className="font-semibold text-destructive">Recruitment data could not be loaded</p>
          <p className="max-w-xl text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => void refresh()}>Try again</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-300 overflow-visible">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Recruitment & ATS Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            Manage requisitions, job openings, candidate pipeline, interviews and offers.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" className="gap-2 font-semibold shadow-sm" onClick={() => setActiveAction('candidate')}>
            <Upload className="size-4" /> Candidate Apply
          </Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted outline-none cursor-pointer">
                More Actions <ChevronDown className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setInterviewTool('panels')}>Interview panels</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setInterviewTool('feedback')}>Submit feedback</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 outline-none cursor-pointer">
                <Plus className="size-4" /> Create New <ChevronDown className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setActiveAction('job')}>New Job Opening</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveAction('candidate')}>Candidate Apply</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveAction('interview')}>Schedule Interview</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveAction('offer')}>Create Offer</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {activeTab !== 'candidates' && (
        <div className="mb-4 flex items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={`Search ${tabs.find((tab) => tab.id === activeTab)?.label.toLowerCase()}…`} className="pl-9" />
          </div>
          {(activeTab === 'offers' || activeTab === 'interviews' || activeTab === 'job-openings') && (
            <Select value={tableStatus} onChange={setTableStatus} className="w-40" options={[
              { label: 'All statuses', value: '' },
              ...(activeTab === 'offers'
                ? ['Draft', 'Sent', 'Accepted', 'Declined']
                : activeTab === 'interviews'
                  ? ['Scheduled', 'Completed', 'Cancelled']
                  : ['Open', 'Closed']).map((status) => ({ label: status, value: status })),
            ]} />
          )}
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard icon={FileText} label="Open Requisitions" value={requisitions.filter((item) => item.status === 'Open').length} subtitle={`${requisitions.length} total`} />
        <KpiCard icon={Briefcase} label="Open Positions" value={jobs.filter((item) => item.status === 'Open').length} subtitle={`${jobs.length} job postings`} />
        <KpiCard icon={Users} label="Applications" value={candidates.length} subtitle={`${stageCounts.Applied} newly applied`} subtitleColor="text-success" />
        <KpiCard icon={Filter} label="In Pipeline" value={candidates.filter((item) => !['Hired', 'Rejected'].includes(item.stage)).length} subtitle={`${stageCounts.Interview} interviewing`} subtitleColor="text-primary" />
        <KpiCard icon={FileText} label="Offers" value={offers.length} subtitle={`${offers.filter((item) => item.status === 'Accepted').length} accepted · ${pendingFeedbackCount} feedback pending`} subtitleColor="text-success" />
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-0 border-b border-border/60 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap',
              activeTab === tab.id
                ? 'text-primary border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB: Candidates */}
      {activeTab === 'candidates' && (
        <div className="flex flex-col gap-6 flex-1 min-h-0">
          {/* Main content */}
          <div className="flex flex-col flex-1 min-w-0 overflow-visible">
            {/* Filter / Search Bar */}
            <div className="flex flex-wrap items-center gap-3 mb-4 overflow-visible pb-1">
              <div className="min-w-fit flex-shrink-0">
                <Select
                  value={selectedJob}
                  onChange={setSelectedJob}
                  options={[{ label: 'All Jobs', value: '' }, ...uniqueJobs.map((j) => ({ label: j, value: j }))]}
                  className="w-28"
                  size="sm"
                />
              </div>
              <div className="relative min-w-fit flex-shrink-0 w-[180px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none z-10" />
                <Input
                  placeholder="Search candidates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-7 text-xs w-full"
                />
              </div>
              <div className="min-w-fit flex-shrink-0">
                <Select
                  value={selectedStage}
                  onChange={setSelectedStage}
                  options={[{ label: 'Stage', value: '' }, ...PIPELINE_STAGES.map((s) => ({ label: s.label, value: s.id }))]}
                  className="w-24"
                  size="sm"
                />
              </div>
              <div className="min-w-fit flex-shrink-0">
                <Select
                  value={selectedSource}
                  onChange={setSelectedSource}
                  options={[{ label: 'Source', value: '' }, ...uniqueSources.map((s) => ({ label: s, value: s }))]}
                  className="w-24"
                  size="sm"
                />
              </div>
              <div className="min-w-fit flex-shrink-0">
                <Select
                  value={selectedRecruiter}
                  onChange={setSelectedRecruiter}
                  options={[{ label: 'Recruiter', value: '' }, ...uniqueRecruiters.map((r) => ({ label: r, value: r }))]}
                  className="w-28"
                  size="sm"
                />
              </div>
              <div className="min-w-fit flex-shrink-0">
                <Select
                  value={selectedLocation}
                  onChange={setSelectedLocation}
                  options={[{ label: 'Location', value: '' }, ...uniqueLocations.map((l) => ({ label: l, value: l }))]}
                  className="w-28"
                  size="sm"
                />
              </div>
              {/* WAS "More Filters", WITH NO HANDLER AND NOTHING TO ADD.
                  All five filters — job, stage, source, recruiter, location —
                  are already inline to the left, so there were no more filters
                  to show. Rather than invent a purpose for the button, it now
                  does the one thing this row was missing: clear them all, and
                  say how many are active. Disabled when none are. */}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-semibold lg:ml-auto min-w-fit flex-shrink-0"
                disabled={activeFilterCount === 0}
                onClick={() => {
                  setSearchQuery('')
                  setSelectedJob('')
                  setSelectedStage('')
                  setSelectedSource('')
                  setSelectedRecruiter('')
                  setSelectedLocation('')
                  setCurrentPage(1)
                }}
              >
                <Filter className="size-3.5" />
                {activeFilterCount > 0 ? `Clear ${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''}` : 'No filters'}
              </Button>
              {/* View Toggle */}
              <div className="flex min-w-fit flex-shrink-0 items-center border border-border rounded-lg overflow-hidden">
                {([
                  { id: 'kanban' as const, icon: LayoutGrid, label: 'Kanban' },
                  { id: 'table' as const, icon: List, label: 'Table' },
                  { id: 'calendar' as const, icon: CalendarDays, label: 'Calendar' },
                ] as const).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setCandidateView(v.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors',
                      candidateView === v.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <v.icon className="size-3.5" />
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Kanban View */}
            {candidateView === 'kanban' && (
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-max">
                  {PIPELINE_STAGES.map((stage) => (
                    <KanbanColumn
                      key={stage.id}
                      stage={stage}
                      candidates={candidatesByStage[stage.id]}
                      count={stageCounts[stage.id]}
                      onCandidateClick={(c) => setSelectedCandidate(c)}
                      onCandidateApply={() => setActiveAction('candidate')}
                      onCandidateMove={(candidateId, stage) => void moveCandidate(candidateId, stage)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Table View */}
            {candidateView === 'table' && (
              <div className="mt-4">
                {/* Bulk Actions Bar */}
              <div className="flex items-center gap-3 px-1 py-2 mb-2">
                <span className="text-xs font-bold text-muted-foreground">{selectedIds.length} selected</span>
                <div className="h-4 w-px bg-border" />

                {/* MOVE STAGE — the one bulk action with a real endpoint behind it.
                    `moveCandidate` already existed and worked for drag-and-drop on
                    the kanban; the bar simply never called it, which also made the
                    row checkboxes below meaningless. */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
                      <MoveRight className="size-3.5" /> Move Stage
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {PIPELINE_STAGES.map((stage) => (
                      <DropdownMenuItem
                        key={stage.id}
                        onSelect={() =>
                          setConfirmation({
                            title: `Move ${selectedIds.length} candidate(s) to ${stage.label}?`,
                            description:
                              'Each application moves to that stage. Anything the stage triggers — '
                              + 'an assessment invite, for example — is not sent automatically here.',
                            run: async () => {
                              /*
                               * Sequential, not Promise.all. Each move is a PUT that
                               * the optimistic cache update in useRecruitment rolls
                               * back on failure; firing 25 at once would interleave
                               * those rollbacks and leave the board showing a state
                               * that never existed.
                               */
                              for (const id of selectedIds) {
                                await moveCandidate(id, stage.id as Candidate['stage'])
                              }
                              setSelectedIds([])
                            },
                          })
                        }
                      >
                        {stage.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* ASSIGN RECRUITER, SEND EMAIL, ADD TAG — DELIBERATELY DISABLED.
                    There is no endpoint for any of them: no recruiter-assignment
                    column on talent_job_applications, no bulk-mail route, and no
                    tag table. A button that opens a dialog which cannot save is
                    worse than one that says it is not available yet, so each
                    states the reason on hover instead of failing silently. */}
                <button
                  disabled
                  title="Not available yet — applications have no recruiter-assignment field."
                  className="flex items-center gap-1 text-xs font-semibold text-muted-foreground/40 cursor-not-allowed"
                >
                  <UserPlus className="size-3.5" /> Assign Recruiter
                </button>
                <button
                  disabled
                  title="Not available yet — there is no bulk email endpoint. Use the candidate drawer to email one person."
                  className="flex items-center gap-1 text-xs font-semibold text-muted-foreground/40 cursor-not-allowed"
                >
                  <Mail className="size-3.5" /> Send Email
                </button>
                <button
                  disabled
                  title="Not available yet — candidates have no tags."
                  className="flex items-center gap-1 text-xs font-semibold text-muted-foreground/40 cursor-not-allowed"
                >
                  <Tag className="size-3.5" /> Add Tag
                </button>

                {/* MORE — clearing the selection is a real action and the only one
                    that needs no backend. */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
                      <MoreHorizontal className="size-3.5" /> More
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onSelect={() => setSelectedIds([])}>
                      Clear selection
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setSelectedIds(paginatedCandidates.map((c) => c.id))}
                    >
                      Select all on this page
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* Pagination */}
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-muted-foreground font-medium tabular-nums">
                    {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredCandidates.length)} of {filteredCandidates.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="size-7 p-0" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>
                      <ChevronRight className="size-3.5 rotate-180" />
                    </Button>
                    {Array.from({ length: Math.min(totalPages, 4) }, (_, i) => i + 1).map((p) => (
                      <Button
                        key={p}
                        variant={currentPage === p ? 'default' : 'outline'}
                        size="sm"
                        className="size-7 p-0 text-xs font-bold"
                        onClick={() => setCurrentPage(p)}
                      >
                        {p}
                      </Button>
                    ))}
                    {totalPages > 4 && <span className="text-xs text-muted-foreground">...</span>}
                    {totalPages > 4 && (
                      <Button variant="outline" size="sm" className="size-7 p-0 text-xs font-bold" onClick={() => setCurrentPage(totalPages)}>
                        {totalPages}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="size-7 p-0" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                  {/* WAS A DEAD SETTINGS ICON beside the paginator. It now does
                      the thing its position implies: rows per page. Changing it
                      returns to page 1, since page 7 of 25 does not exist at 100. */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="p-1.5 text-muted-foreground" title="Rows per page">
                        <Settings className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {[10, 25, 50, 100].map((size) => (
                        <DropdownMenuItem
                          key={size}
                          onSelect={() => { setPageSize(size); setCurrentPage(1) }}
                        >
                          {size} per page{size === pageSize ? ' ✓' : ''}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Table */}
              <div className="rounded-lg border border-border overflow-hidden">
                <Table className="w-full [&_td]:p-3 [&_th]:p-3">
                  <TableHeader className="bg-surface-muted">
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedIds.length === paginatedCandidates.length && paginatedCandidates.length > 0}
                          indeterminate={selectedIds.length > 0 && selectedIds.length < paginatedCandidates.length}
                          onChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="font-semibold">Candidate</TableHead>
                      <TableHead className="font-semibold">Job Opening</TableHead>
                      <TableHead className="font-semibold">Current Stage</TableHead>
                      <TableHead className="font-semibold">Source</TableHead>
                      <TableHead className="font-semibold">Recruiter</TableHead>
                      <TableHead className="font-semibold">Applied On</TableHead>
                      <TableHead className="font-semibold">Last Updated</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCandidates.map((candidate) => (
                      <TableRow
                        key={candidate.id}
                        onClick={() => setSelectedCandidate(candidate)}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.includes(candidate.id)}
                            onChange={() => handleSelectRow(candidate.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground border border-border/60 shrink-0">
                              {candidate.name.split(' ').map((n) => n[0]).join('')}
                            </div>
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="text-sm font-semibold text-foreground truncate">{candidate.name}</span>
                            </div>
                            {candidate.starred && <Star className="size-3.5 text-warning fill-warning shrink-0" />}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-foreground">{candidate.jobOpening}</span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={getStageVariant(candidate.stage)} size="sm">
                            {candidate.stage}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-foreground">{candidate.source}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                              {candidate.recruiterInitials}
                            </div>
                            <span className="text-sm text-foreground">{candidate.recruiter}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{candidate.appliedOn}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{candidate.lastUpdated}</span>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors outline-none cursor-pointer">
                                <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => setSelectedCandidate(candidate)}>View application</DropdownMenuItem>
                              {candidate.resume && <DropdownMenuItem onClick={() => window.open(candidate.resume, '_blank', 'noopener,noreferrer')}>Open resume</DropdownMenuItem>}
                              {canProgressCandidate(candidate) && <DropdownMenuItem onClick={() => void recruitmentService.updateApplication(candidate.id, { status: 'Shortlisted' }).then(refresh)}>Shortlist</DropdownMenuItem>}
                              {canProgressCandidate(candidate) && <DropdownMenuItem onClick={() => { setInterviewCandidate(candidate); setActiveAction('interview') }}>Schedule interview</DropdownMenuItem>}
                              {/* THE MISSING ENTRY POINT. Creating an offer was only
                                  reachable from a global "Create Offer" menu with no
                                  candidate context, so HR picked the person again from
                                  a list of everyone and typed details the screen
                                  already knew. Reusing `interviewCandidate` as the
                                  drawer's preselected candidate - the prop it already
                                  accepts - is what lets the offer form pre-fill. */}
                              {canProgressCandidate(candidate) && <DropdownMenuItem onClick={() => { setInterviewCandidate(candidate); setActiveAction('offer') }}>Create offer</DropdownMenuItem>}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => void recruitmentService.updateApplication(candidate.id, { status: 'Rejected' }).then(refresh)}>Reject</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            )}

            {/* Calendar View Placeholder */}
            {candidateView === 'calendar' && (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg border border-dashed border-border/60 bg-card mt-4">
                <CalendarDays className="size-10 text-muted-foreground/40 mb-3" />
                <h3 className="text-sm font-semibold text-foreground mb-1">Calendar View</h3>
                <p className="text-xs text-muted-foreground max-w-xs">
                  View interview schedules, follow-up dates, and onboarding timelines in a calendar format.
                </p>
              </div>
            )}
          </div>

          {/* Right Panel — Candidate Detail (Renders as Sheet Overlay) */}
          {selectedCandidate && (
            <CandidateDetailPanel
              candidate={selectedCandidate}
              onSaved={() => void refresh()}
              onSchedule={(candidate) => {
                setInterviewCandidate(candidate)
                setSelectedCandidate(null)
                setActiveAction('interview')
              }}
              onCreateOffer={(candidate) => {
                setInterviewCandidate(candidate)
                setSelectedCandidate(null)
                setActiveAction('offer')
              }}
              onClose={() => setSelectedCandidate(null)}
              onViewProfile={() => {
                setSelectedCandidate(null)
                setViewingProfileFor(selectedCandidate.id)
              }}
            />
          )}
        </div>
      )}

      {/* TAB: Requisitions */}
      {activeTab === 'requisitions' && (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table className="w-full [&_td]:p-3 [&_th]:p-3">
            <TableHeader className="bg-surface-muted">
              <TableRow>
                <TableHead className="font-semibold">Requisition ID</TableHead>
                <TableHead className="font-semibold">Title</TableHead>
                <TableHead className="font-semibold">Department</TableHead>
                <TableHead className="font-semibold">Location</TableHead>
                <TableHead className="font-semibold">Headcount</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Priority</TableHead>
                <TableHead className="font-semibold">Created By</TableHead>
                <TableHead className="font-semibold">Created On</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requisitions.filter((req) => !searchQuery || `${req.title} ${req.department} ${req.location}`.toLowerCase().includes(searchQuery.toLowerCase())).map((req) => (
                <TableRow key={req.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell><span className="text-sm font-semibold text-primary">{req.id}</span></TableCell>
                  <TableCell><span className="text-sm font-semibold text-foreground">{req.title}</span></TableCell>
                  <TableCell><span className="text-sm text-foreground">{req.department}</span></TableCell>
                  <TableCell><span className="text-sm text-foreground">{req.location}</span></TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground">{req.filled}/{req.headcount}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      variant={req.status === 'Open' ? 'active' : 'inactive'}
                      size="sm"
                    >
                      {req.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      variant={req.priority === 'Critical' ? 'error' : req.priority === 'High' ? 'pending' : 'default'}
                      size="sm"
                    >
                      {req.priority}
                    </StatusBadge>
                  </TableCell>
                  <TableCell><span className="text-sm text-foreground">{req.createdBy}</span></TableCell>
                  <TableCell><span className="text-sm text-muted-foreground">{req.createdOn}</span></TableCell>
                  <TableCell>
                    {/* WAS A DEAD OVERFLOW BUTTON on every requisition row. The
                        job-record actions it implies already exist on the Jobs
                        tab; this reuses them rather than adding a second path. */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="p-1 text-muted-foreground">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            setSelectedJobRecord(jobRecords.find((r) => String(r.id) === String(req.id)) ?? null)
                            setActiveAction('job-view')
                          }}
                        >
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            setSelectedJobRecord(jobRecords.find((r) => String(r.id) === String(req.id)) ?? null)
                            setActiveAction('job-edit')
                          }}
                        >
                          Edit requisition
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* TAB: Job Openings */}
      {activeTab === 'job-openings' && (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table className="w-full [&_td]:p-3 [&_th]:p-3">
            <TableHeader className="bg-surface-muted">
              <TableRow>
                <TableHead className="font-semibold">Job ID</TableHead>
                <TableHead className="font-semibold">Title</TableHead>
                <TableHead className="font-semibold">Department</TableHead>
                <TableHead className="font-semibold">Location</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Applications</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Posted On</TableHead>
                <TableHead className="font-semibold">Closing Date</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedJobs.filter((job) => (!searchQuery || `${job.title} ${job.department} ${job.location}`.toLowerCase().includes(searchQuery.toLowerCase())) && (!tableStatus || job.status === tableStatus)).map((job) => (
                <TableRow key={job.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell><span className="text-sm font-semibold text-primary">{job.id}</span></TableCell>
                  <TableCell><span className="text-sm font-semibold text-foreground">{job.title}</span></TableCell>
                  <TableCell><span className="text-sm text-foreground">{job.department}</span></TableCell>
                  <TableCell><span className="text-sm text-foreground">{job.location}</span></TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs font-semibold">{job.type}</Badge>
                  </TableCell>
                  <TableCell><span className="text-sm font-bold text-foreground">{job.applications}</span></TableCell>
                  <TableCell>
                    <StatusBadge
                      variant={job.status === 'Open' ? 'active' : 'inactive'}
                      size="sm"
                    >
                      {job.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell><span className="text-sm text-muted-foreground">{job.postedOn}</span></TableCell>
                  <TableCell><span className="text-sm text-muted-foreground">{job.closingDate}</span></TableCell>
                  <TableCell>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => { setSelectedJobRecord(jobRecords.find((record) => String(record.id) === job.id) ?? null); setActiveAction('job-view') }}>View details</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedJobRecord(jobRecords.find((record) => String(record.id) === job.id) ?? null); setActiveAction('candidate') }}>Apply</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedJobRecord(jobRecords.find((record) => String(record.id) === job.id) ?? null); setActiveAction('job-edit') }}>Edit job</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setConfirmation({
                          title: 'Delete job opening?',
                          description: 'Laravel will soft-delete the job and its related applications, interviews, feedback, and offers.',
                          run: async () => { await recruitmentService.deleteJob(job.id); await refresh() },
                        })}>Delete job</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* TAB: Interviews */}
      {activeTab === 'interviews' && (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table className="w-full [&_td]:p-3 [&_th]:p-3">
            <TableHeader className="bg-surface-muted">
              <TableRow>
                <TableHead className="font-semibold">Interview ID</TableHead>
                <TableHead className="font-semibold">Candidate</TableHead>
                <TableHead className="font-semibold">Job Title</TableHead>
                <TableHead className="font-semibold">Round</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Scheduled At</TableHead>
                <TableHead className="font-semibold">Duration</TableHead>
                <TableHead className="font-semibold">Interviewers</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {interviews.filter((interview) => (!searchQuery || `${interview.candidateName} ${interview.jobTitle}`.toLowerCase().includes(searchQuery.toLowerCase())) && (!tableStatus || interview.status === tableStatus)).map((interview) => (
                <TableRow key={interview.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell><span className="text-sm font-semibold text-primary">{interview.id}</span></TableCell>
                  <TableCell><span className="text-sm font-semibold text-foreground">{interview.candidateName}</span></TableCell>
                  <TableCell><span className="text-sm text-foreground">{interview.jobTitle}</span></TableCell>
                  <TableCell><span className="text-sm font-bold text-foreground">Round {(interview as { round?: number }).round ?? '—'}</span></TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs font-semibold">{interview.type}</Badge>
                  </TableCell>
                  <TableCell><span className="text-sm text-foreground">{interview.scheduledAt}</span></TableCell>
                  <TableCell><span className="text-sm text-muted-foreground">{interview.duration}</span></TableCell>
                  <TableCell>
                    <div className="flex -space-x-1">
                      {interview.interviewers.map((name, i) => (
                        <div key={i} className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold border-2 border-card" title={name}>
                          {name.split(' ').map((n) => n[0]).join('')}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      variant={interview.status === 'Scheduled' ? 'processing' : interview.status === 'Completed' ? 'active' : 'error'}
                      size="sm"
                    >
                      {interview.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setInterviewTool('feedback')}>Submit feedback</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setDecisionInterviewId(interview.id); setInterviewTool('decision') }}>Hiring decision</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedInterviewRecord(interviewRecords.find((record) => String(record.id) === interview.id) ?? null); setActiveAction('interview-edit') }}>Reschedule</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* TAB: Offers */}
      {activeTab === 'offers' && (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table className="w-full [&_td]:p-3 [&_th]:p-3">
            <TableHeader className="bg-surface-muted">
              <TableRow>
                <TableHead className="font-semibold">Offer ID</TableHead>
                <TableHead className="font-semibold">Candidate</TableHead>
                <TableHead className="font-semibold">Job Title</TableHead>
                <TableHead className="font-semibold">CTC</TableHead>
                <TableHead className="font-semibold">Joining Date</TableHead>
                <TableHead className="font-semibold">Approved By</TableHead>
                <TableHead className="font-semibold">Sent On</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.filter((offer) => (!searchQuery || `${offer.candidateName} ${offer.jobTitle}`.toLowerCase().includes(searchQuery.toLowerCase())) && (!tableStatus || offer.status === tableStatus)).map((offer) => (
                <TableRow key={offer.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell><span className="text-sm font-semibold text-primary">{offer.id}</span></TableCell>
                  <TableCell><span className="text-sm font-semibold text-foreground">{offer.candidateName}</span></TableCell>
                  <TableCell><span className="text-sm text-foreground">{offer.jobTitle}</span></TableCell>
                  <TableCell><span className="text-sm font-bold text-foreground">{offer.ctc}</span></TableCell>
                  <TableCell><span className="text-sm text-foreground">{offer.joiningDate}</span></TableCell>
                  <TableCell><span className="text-sm text-foreground">{offer.approvedBy}</span></TableCell>
                  <TableCell><span className="text-sm text-muted-foreground">{offer.sentOn}</span></TableCell>
                  <TableCell>
                    <StatusBadge
                      variant={offer.status === 'Accepted' ? 'active' : offer.status === 'Sent' ? 'processing' : offer.status === 'Declined' ? 'error' : 'pending'}
                      size="sm"
                    >
                      {offer.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => { setSelectedOfferRecord(offerRecords.find((record) => String(record.id) === offer.id) ?? null); setActiveAction('offer-view') }}>View details</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(recruitmentService.offerLetterUrl(offer.id), '_blank', 'noopener,noreferrer')}>View offer letter</DropdownMenuItem>
                        {offer.status !== 'Accepted' && offer.status !== 'Declined' && (
                          <DropdownMenuItem onClick={() => void recruitmentService.candidateLink(offer.id).then((res) => {
                            const url = res?.data?.url
                            if (!url) return
                            void navigator.clipboard?.writeText(url).catch(() => undefined)
                            setCandidateLink({ url, emailSent: Boolean(res?.data?.email_sent), message: res?.message ?? '' })
                          }).catch((cause) => setCandidateLink({ url: '', emailSent: false, message: cause instanceof Error ? cause.message : 'The link could not be created.' }))}>
                            Send / copy candidate link
                          </DropdownMenuItem>
                        )}
                        {offer.status === 'Accepted' && <DropdownMenuItem onClick={() => router.push('/module/talent-management/onboarding/onboarding')}>Start onboarding</DropdownMenuItem>}
                        {offer.status !== 'Accepted' && offer.status !== 'Declined' && <DropdownMenuItem onClick={() => setConfirmation({
                          title: 'Accept this offer?',
                          description: 'The candidate becomes an employee: a record is created in the Employee Directory and linked to this offer. Accepting again will not create a second employee.',
                          run: async () => { await recruitmentService.acceptOffer(offer.id); await refresh() },
                        })}>Accept offer</DropdownMenuItem>}
                        {offer.status !== 'Accepted' && offer.status !== 'Declined' && <DropdownMenuItem onClick={() => setConfirmation({
                          title: 'Reject this offer?',
                          description: 'The offer status will be changed to rejected.',
                          run: async () => { await recruitmentService.rejectOffer(offer.id); await refresh() },
                        })}>Reject offer</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <RecruitmentActionDrawer action={activeAction} jobs={jobs} candidates={candidates} selectedJob={selectedJobRecord} selectedInterview={selectedInterviewRecord} selectedOffer={selectedOfferRecord} preselectedCandidate={interviewCandidate} onClose={() => { setActiveAction(null); setSelectedJobRecord(null); setSelectedInterviewRecord(null); setSelectedOfferRecord(null); setInterviewCandidate(null) }} onSaved={refresh} onEditJob={() => setActiveAction('job-edit')} />
      <InterviewToolsDrawer open={Boolean(interviewTool)} mode={interviewTool ?? 'panels'} interviewId={decisionInterviewId} jobs={jobs} candidates={candidates} onClose={() => { setInterviewTool(null); setDecisionInterviewId(null) }} onSaved={refresh} />
      <AlertDialog open={Boolean(confirmation)} onOpenChange={(open) => !open && setConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmation?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirmation(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              const action = confirmation?.run
              setConfirmation(null)
              if (action) void action()
            }}>Confirm</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(candidateLink)} onOpenChange={(open) => !open && setCandidateLink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Candidate link</AlertDialogTitle>
            <AlertDialogDescription>{candidateLink?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          {candidateLink?.url ? (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {candidateLink.emailSent ? 'Emailed to the candidate' : 'Copy this to the candidate'}
              </span>
              <p className="break-all rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs text-foreground">
                {candidateLink.url}
              </p>
              <p className="text-xs text-muted-foreground">
                Copied to your clipboard. The link works once and invalidates any earlier one.
              </p>
            </div>
          ) : null}
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setCandidateLink(null)}>Close</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
