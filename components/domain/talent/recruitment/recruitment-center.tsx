'use client'

import React, { useState, useMemo } from 'react'
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
  ArrowUpDown,
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
  mockCandidates,
  mockRequisitions,
  mockJobOpenings,
  mockInterviews,
  mockOffers,
  PIPELINE_STAGES,
  type Candidate,
  type CandidateStage,
} from './recruitment-data'
import { KanbanColumn } from './candidate-kanban'
import { CandidateDetailPanel } from './candidate-detail-panel'
import { TalentProfileView } from '../profile/talent-profile-view'

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

// -------------------------------------------------------------------
// Main Component
// -------------------------------------------------------------------
export function RecruitmentCenter() {
  // State
  const [activeTab, setActiveTab] = useState<MainTab>('candidates')
  const [candidateView, setCandidateView] = useState<CandidateView>('kanban')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedJob, setSelectedJob] = useState('')
  const [selectedStage, setSelectedStage] = useState('')
  const [selectedSource, setSelectedSource] = useState('')
  const [selectedRecruiter, setSelectedRecruiter] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [viewingProfileFor, setViewingProfileFor] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)

  const pageSize = 25

  const tabs: { id: MainTab; label: string }[] = [
    { id: 'requisitions', label: 'Requisitions' },
    { id: 'job-openings', label: 'Job Openings' },
    { id: 'candidates', label: 'Candidates' },
    { id: 'interviews', label: 'Interviews' },
    { id: 'offers', label: 'Offers' },
  ]

  // Filtered candidates
  const filteredCandidates = useMemo(() => {
    return mockCandidates.filter((c) => {
      if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase()) && !c.role.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (selectedJob && c.jobOpening !== selectedJob) return false
      if (selectedStage && c.stage !== selectedStage) return false
      if (selectedSource && c.source !== selectedSource) return false
      if (selectedRecruiter && c.recruiter !== selectedRecruiter) return false
      if (selectedLocation && c.location !== selectedLocation) return false
      return true
    })
  }, [searchQuery, selectedJob, selectedStage, selectedSource, selectedRecruiter, selectedLocation])

  // Candidates grouped by stage for Kanban
  const candidatesByStage = useMemo(() => {
    const map: Record<CandidateStage, Candidate[]> = {
      Applied: [], Screened: [], Assessment: [], Interview: [], Offer: [], Hired: [], Rejected: [],
    }
    filteredCandidates.forEach((c) => map[c.stage].push(c))
    return map
  }, [filteredCandidates])

  // Stage counts for Kanban headers  (use total not filtered for display purposes)
  const stageCounts: Record<CandidateStage, number> = useMemo(() => {
    const counts: Record<CandidateStage, number> = { Applied: 348, Screened: 156, Assessment: 86, Interview: 42, Offer: 10, Hired: 8, Rejected: 598 }
    return counts
  }, [])

  // Unique values for filters
  const uniqueJobs = [...new Set(mockCandidates.map((c) => c.jobOpening))]
  const uniqueSources = [...new Set(mockCandidates.map((c) => c.source))]
  const uniqueRecruiters = [...new Set(mockCandidates.map((c) => c.recruiter))]
  const uniqueLocations = [...new Set(mockCandidates.map((c) => c.location))]

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

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-300 overflow-hidden">
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
          <Button variant="outline" className="gap-2 font-semibold shadow-sm">
            <Upload className="size-4" /> Import Candidates
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted outline-none cursor-pointer">
                More Actions <ChevronDown className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Export Data</DropdownMenuItem>
              <DropdownMenuItem>Bulk Update</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Settings</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 outline-none cursor-pointer">
                <Plus className="size-4" /> Create New <ChevronDown className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>New Requisition</DropdownMenuItem>
              <DropdownMenuItem>New Job Opening</DropdownMenuItem>
              <DropdownMenuItem>Add Candidate</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Schedule Interview</DropdownMenuItem>
              <DropdownMenuItem>Create Offer</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard icon={FileText} label="Open Requisitions" value={24} subtitle="8 awaiting approval" subtitleColor="text-warning" />
        <KpiCard icon={Briefcase} label="Open Positions" value={37} subtitle="12 critical" subtitleColor="text-destructive" />
        <KpiCard icon={Users} label="Applications" value="1,248" subtitle="+18 this week" subtitleColor="text-success" />
        <KpiCard icon={Filter} label="In Pipeline" value={642} subtitle="52% of total" subtitleColor="text-primary" />
        <KpiCard icon={FileText} label="Offers" value={28} subtitle="6 awaiting approval" subtitleColor="text-warning" />
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
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            {/* Filter / Search Bar */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
              <div className="shrink-0">
                <Select
                  value={selectedJob}
                  onChange={setSelectedJob}
                  options={[{ label: 'All Jobs', value: '' }, ...uniqueJobs.map((j) => ({ label: j, value: j }))]}
                  className="w-28"
                  size="sm"
                />
              </div>
              <div className="relative shrink-0 w-[180px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none z-10" />
                <Input
                  placeholder="Search candidates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-7 text-xs w-full"
                />
              </div>
              <div className="shrink-0">
                <Select
                  value={selectedStage}
                  onChange={setSelectedStage}
                  options={[{ label: 'Stage', value: '' }, ...PIPELINE_STAGES.map((s) => ({ label: s.label, value: s.id }))]}
                  className="w-24"
                  size="sm"
                />
              </div>
              <div className="shrink-0">
                <Select
                  value={selectedSource}
                  onChange={setSelectedSource}
                  options={[{ label: 'Source', value: '' }, ...uniqueSources.map((s) => ({ label: s, value: s }))]}
                  className="w-24"
                  size="sm"
                />
              </div>
              <div className="shrink-0">
                <Select
                  value={selectedRecruiter}
                  onChange={setSelectedRecruiter}
                  options={[{ label: 'Recruiter', value: '' }, ...uniqueRecruiters.map((r) => ({ label: r, value: r }))]}
                  className="w-28"
                  size="sm"
                />
              </div>
              <div className="shrink-0">
                <Select
                  value={selectedLocation}
                  onChange={setSelectedLocation}
                  options={[{ label: 'Location', value: '' }, ...uniqueLocations.map((l) => ({ label: l, value: l }))]}
                  className="w-28"
                  size="sm"
                />
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold ml-auto shrink-0">
                <Filter className="size-3.5" /> More Filters
              </Button>
              {/* View Toggle */}
              <div className="flex items-center border border-border rounded-lg overflow-hidden ml-2">
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
                <button className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
                  <MoveRight className="size-3.5" /> Move Stage
                </button>
                <button className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
                  <UserPlus className="size-3.5" /> Assign Recruiter
                </button>
                <button className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
                  <Mail className="size-3.5" /> Send Email
                </button>
                <button className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
                  <Tag className="size-3.5" /> Add Tag
                </button>
                <button className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
                  <MoreHorizontal className="size-3.5" /> More
                </button>
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
                  <Button size="icon" variant="ghost" className="p-1.5 text-muted-foreground">
                    <Settings className="size-3.5" />
                  </Button>
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
                          <DropdownMenu>
                            <DropdownMenuTrigger className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors outline-none cursor-pointer">
                                <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem>View Profile</DropdownMenuItem>
                              <DropdownMenuItem>Move Stage</DropdownMenuItem>
                              <DropdownMenuItem>Schedule Interview</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>Reject</DropdownMenuItem>
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
              {mockRequisitions.map((req) => (
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
                      variant={req.status === 'Open' ? 'active' : req.status === 'Pending Approval' ? 'pending' : req.status === 'Approved' ? 'processing' : 'inactive'}
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
                    <Button size="icon" variant="ghost" className="p-1 text-muted-foreground">
                      <MoreHorizontal className="size-4" />
                    </Button>
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
              {mockJobOpenings.map((job) => (
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
                      variant={job.status === 'Active' ? 'active' : job.status === 'Draft' ? 'pending' : job.status === 'Paused' ? 'pending' : 'inactive'}
                      size="sm"
                    >
                      {job.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell><span className="text-sm text-muted-foreground">{job.postedOn}</span></TableCell>
                  <TableCell><span className="text-sm text-muted-foreground">{job.closingDate}</span></TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="p-1 text-muted-foreground">
                      <MoreHorizontal className="size-4" />
                    </Button>
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
              {mockInterviews.map((interview) => (
                <TableRow key={interview.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell><span className="text-sm font-semibold text-primary">{interview.id}</span></TableCell>
                  <TableCell><span className="text-sm font-semibold text-foreground">{interview.candidateName}</span></TableCell>
                  <TableCell><span className="text-sm text-foreground">{interview.jobTitle}</span></TableCell>
                  <TableCell><span className="text-sm font-bold text-foreground">Round {interview.round}</span></TableCell>
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
                    <Button size="icon" variant="ghost" className="p-1 text-muted-foreground">
                      <MoreHorizontal className="size-4" />
                    </Button>
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
              {mockOffers.map((offer) => (
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
                    <Button size="icon" variant="ghost" className="p-1 text-muted-foreground">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
