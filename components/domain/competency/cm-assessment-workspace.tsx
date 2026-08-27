'use client'

import React, { useEffect, useState } from 'react'
import {
  Info,
  Plus,
  Search,
  Filter,
  Settings,
  MoreVertical,
  Users,
  CheckCircle2,
  Clock,
  X,
  ChevronRight,
  ChevronLeft,
  FileText,
  Activity,
  ClipboardList,
  Scale
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
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
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { useAssessmentWorkspace } from '@/hooks/use-assessment-workspace'
// AI generation, review and publish. Mounted on the Campaigns tab because that
// is where an HR user already comes to create an assessment — a separate menu
// would need its own rights row to say the same thing twice.
import { CmAssessmentGenerator } from './cm-assessment-generator'
import { CmAssessmentConsole } from './cm-assessment-console'
import { useCompetencyStudio } from '@/hooks/use-competency-studio'

export function CmAssessmentWorkspace() {
  const [activeTab, setActiveTab] = useState('campaigns')
  // Frameworks come from the studio hook so the picker offers exactly what
  // Framework & Role Mapping publishes.
  const { frameworks } = useCompetencyStudio()
  const frameworkOptions = React.useMemo(
    () => [
      { label: 'No framework (ad-hoc)', value: '' },
      ...frameworks.map((framework) => ({ label: framework.name, value: String(framework.id) })),
    ],
    [frameworks],
  )
  const [campaignTab, setCampaignTab] = useState('participants')
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newCampaignName, setNewCampaignName] = useState('')
  // Was a hardcoded value="self" with a no-op onChange, so the picker looked
  // real but every campaign was created with whatever the server defaulted to.
  const [newCampaignType, setNewCampaignType] = useState('self')
  // Which framework the campaign assesses against - every assessment row
  // already carried a framework_id, the campaign that groups them did not.
  const [newCampaignFramework, setNewCampaignFramework] = useState('')
  const [newCampaignStartDate, setNewCampaignStartDate] = useState('')
  const [newCampaignEndDate, setNewCampaignEndDate] = useState('')

  const {
    metrics,
    campaigns,
    participants,
    selectedCycleId,
    loadParticipants,
    clearSelectedCycle,
    createCampaign,
    creating,
    error,
    tabLoading,
    tabRows,
    closedCampaigns,
    loadTab,
    reviewAssessment,
    reviewing,
  } = useAssessmentWorkspace()

  // ── FILTER OPTIONS COME FROM THE DATA ──────────────────────────────────────
  // Both of these were hardcoded lists. Deriving them means a status that exists
  // can always be filtered for, and a type that does not exist is never offered.
  //
  // `type` is null on every campaign today, so typeOptions correctly collapses to
  // "All Types" plus "Not set". THAT IS THE HONEST VIEW — the backend stopped
  // substituting a default for it, and the screen must not reintroduce one.
  const statusOptions = React.useMemo(() => {
    const seen = Array.from(new Set((campaigns ?? []).map((c) => c.status).filter(Boolean)))
    return [
      { label: 'All Status', value: 'all' },
      ...seen.map((s) => ({
        label: String(s).replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
        value: String(s),
      })),
    ]
  }, [campaigns])

  const typeOptions = React.useMemo(() => {
    const seen = Array.from(new Set((campaigns ?? []).map((c) => c.type).filter(Boolean)))
    const hasUnset = (campaigns ?? []).some((c) => !c.type)
    return [
      { label: 'All Types', value: 'all' },
      ...seen.map((t) => ({ label: String(t), value: String(t) })),
      // Named, not hidden. A campaign with no type is a real state, and the only
      // state any campaign is currently in.
      ...(hasUnset ? [{ label: 'Not set', value: '__unset' }] : []),
    ]
  }, [campaigns])

  // Load the list for the active top tab (Participant Ratings / Calibration / Approvals / Closed).
  useEffect(() => {
    if (['participant', 'calibration', 'approvals', 'closed'].includes(activeTab)) {
      queueMicrotask(() => loadTab(activeTab))
    }
  }, [activeTab, loadTab])

  const handleCampaignClick = (id: string) => {
    loadParticipants(id)
  }

  const handleReview = async (id: string, action: 'approve' | 'calibrate' | 'reject') => {
    const res = await reviewAssessment(id, action)
    if (res.ok) loadTab(activeTab)
    else alert(res.message)
  }

  const handleCreateSubmit = async () => {
    if (!newCampaignName.trim()) return
    const res = await createCampaign({
      name: newCampaignName,
      type: newCampaignType,
      framework_id: newCampaignFramework ? Number(newCampaignFramework) : undefined,
      start_date: newCampaignStartDate || undefined,
      end_date: newCampaignEndDate || undefined,
    })
    if (res.ok) {
      setCreateDialogOpen(false)
      setNewCampaignName('')
      setNewCampaignType('self')
      setNewCampaignFramework('')
      setNewCampaignStartDate('')
      setNewCampaignEndDate('')
    } else {
      alert(res.message)
    }
  }

  const activeCampaign = campaigns.find(c => c.id === selectedCycleId)

  return (
    <div className="flex flex-col gap-6 p-6 min-h-max">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Assessment & Calibration Workspace <Info className="w-5 h-5 text-muted-foreground" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage assessment campaigns, ratings, and calibration for competency evaluations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-10 px-4 rounded-xl font-semibold border-border bg-background gap-2">
            <Settings className="w-4 h-4" /> View Configuration
          </Button>
          
          <Button 
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold h-10 px-4 flex items-center gap-2 rounded-xl shadow-md shadow-primary/20"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="w-4 h-4 stroke-[3]" /> New Assessment Campaign
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm font-medium">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card/50 backdrop-blur-xl border border-primary/10 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Active Campaigns</p>
            <p className="text-2xl font-bold text-foreground">{metrics?.active_campaigns || 0}</p>
          </div>
        </div>
        
        <div className="bg-card/50 backdrop-blur-xl border border-primary/10 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="relative w-12 h-12 rounded-full flex items-center justify-center shrink-0">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="50%" cy="50%" r="46%" className="stroke-muted fill-none stroke-[4px]" />
              <circle cx="50%" cy="50%" r="46%" className="stroke-green-500 fill-none stroke-[4px]" strokeDasharray={`${metrics?.overall_completion_percent || 0}, 100`} />
            </svg>
            <span className="text-sm font-bold text-foreground z-10">{metrics?.overall_completion_percent || 0}%</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Overall Completion</p>
            <p className="text-xs font-bold text-foreground mt-1">{metrics?.completed_assessments || 0} / {metrics?.total_assessments || 0} Completed</p>
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-xl border border-primary/10 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Pending Manager Ratings</p>
            <p className="text-2xl font-bold text-foreground">{metrics?.pending_manager_ratings || 0}</p>
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-xl border border-primary/10 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-warning">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Pending Calibration</p>
            <p className="text-2xl font-bold text-foreground">{metrics?.pending_calibration || 0}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-8 border-b border-border px-2 mt-2">
        {/* THE ID IS EXPLICIT, NOT DERIVED FROM THE LABEL.
            It used to be `tab.toLowerCase().split(' ')[0]`, so renaming
            "Campaigns" to "Review Cycles" silently changed the id from
            `campaigns` to `review` and every `activeTab === 'campaigns'` check
            stopped matching - the tab would render and show nothing. A display
            string is not a key. */}
        {([
          ['campaigns', 'Review Cycles'],
          ['participant', 'Participant Ratings'],
          ['calibration', 'Calibration'],
          ['approvals', 'Approvals'],
          ['closed', 'Closed Cycles'],
        ] as const).map(([id, tab]) => {
          const isActive = id === activeTab
          return (
            <button
              key={id}
              onClick={() => { setActiveTab(id); clearSelectedCycle(); }}
              className={`pb-3 text-sm font-semibold transition-colors relative ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tab}
              {isActive && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
              )}
            </button>
          )
        })}
      </div>

      {/* Main Studio Area */}
      {activeTab === 'campaigns' && (
        <div className="mb-4 flex flex-col gap-6">
          <CmAssessmentGenerator />
          {/* The generator only ever showed a four-row summary of what it wrote.
              This is where the questions themselves become readable, where a
              test gets assigned, where a written answer gets marked, and where
              a result becomes a rating. */}
          <CmAssessmentConsole />
        </div>
      )}

      {activeTab === 'campaigns' ? (
        <div className="w-full overflow-x-auto pb-4 g2g-scrollbar">
          <div className="flex gap-6 items-stretch min-w-[1000px] h-[700px]">
            
            {/* Left/Main Area: Campaigns List */}
            <div className={`flex flex-col bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm overflow-hidden h-full transition-all duration-300 ${selectedCycleId ? 'w-1/2' : 'w-full'}`}>
              <div className="p-4 border-b border-primary/10 flex items-center justify-between bg-card z-10 shrink-0">
                <div className="flex items-center gap-2 w-64">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search review cycles..." className="h-9 pl-8 bg-background border-border" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* DERIVED FROM THE DATA, NOT LISTED HERE.
                      The status list was hardcoded to two values when the data
                      holds four (open, in_progress, completed, overdue), so two
                      real states could never be filtered for. The type list
                      offered "Self + Manager" — a value NO campaign has, because
                      `type` is null on every one of them. A filter that offers a
                      value nothing matches is worse than no filter: it reports an
                      empty result as "none found" rather than "never set". */}
                  <Select options={statusOptions} placeholder="Status" className="h-9 bg-background w-32" />
                  <Select options={typeOptions} placeholder="Assessment Type" className="h-9 bg-background w-44" />
                  <Button variant="outline" className="h-9 px-3 gap-2 bg-background border-border text-sm">
                    <Filter className="w-3.5 h-3.5" /> More Filters
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-auto g2g-scrollbar relative z-10">
                <Table className="w-full text-sm">
                  <TableHeader className="bg-muted/30 border-b border-primary/10 sticky top-0 z-20">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-4 py-3 font-bold text-foreground">Campaign Name</TableHead>
                      {!selectedCycleId && <TableHead className="px-4 py-3 font-bold text-foreground">Assessment Type</TableHead>}
                      <TableHead className="px-4 py-3 font-bold text-foreground text-center">Participants</TableHead>
                      {!selectedCycleId && <TableHead className="px-4 py-3 font-bold text-foreground">Completion</TableHead>}
                      <TableHead className="px-4 py-3 font-bold text-foreground">Status</TableHead>
                      {!selectedCycleId && <TableHead className="px-4 py-3 font-bold text-foreground">Due Date</TableHead>}
                      <TableHead className="w-16 text-center font-bold text-foreground"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-primary/5">
                    {campaigns.map((row) => (
                      <TableRow key={row.id} className={`hover:bg-muted/30 cursor-pointer ${selectedCycleId === row.id ? 'bg-primary/5' : ''}`} onClick={() => handleCampaignClick(row.id)}>
                        <TableCell className="px-4 py-4 font-medium text-foreground">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${row.status === 'Completed' ? 'bg-success' : 'bg-primary'}`} />
                            {row.name}
                          </div>
                        </TableCell>
                        {!selectedCycleId && (
                          <TableCell className="px-4 py-4 text-muted-foreground">
                            {row.type}
                          </TableCell>
                        )}
                        <TableCell className="px-4 py-4 text-center font-semibold">
                          {row.participants}
                        </TableCell>
                        {!selectedCycleId && (
                          <TableCell className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold w-8">{row.completion}%</span>
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${row.completion === 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${row.completion}%` }} />
                              </div>
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="px-4 py-4">
                          <StatusBadge status={row.status === 'Completed' ? 'success' : 'info'} label={row.status} />
                        </TableCell>
                        {!selectedCycleId && (
                          <TableCell className="px-4 py-4 text-muted-foreground">
                            {row.date}
                          </TableCell>
                        )}
                        <TableCell className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground outline-none transition-colors mx-auto">
                              <MoreVertical className="w-4 h-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>View Details</DropdownMenuItem>
                              <DropdownMenuItem>Edit Campaign</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {campaigns.length === 0 && (
                      <TableRow>
                        {/* NOT "no campaigns found". Two instruments on this
                            screen measure capability and they are easily
                            confused, so the empty state says which one this is
                            and how it differs from the other. */}
                        <TableCell colSpan={7} className="py-12 text-center">
                          <p className="text-sm font-semibold text-foreground">No review cycles yet</p>
                          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                            A review cycle asks managers to rate their team against a framework over a
                            set period. That is different from an <strong>assessment</strong>, which
                            people sit and answer themselves — a cycle can use one as its evidence.
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-card">
                <span className="tabular-nums">Showing {campaigns.length} review cycle{campaigns.length === 1 ? '' : 's'}</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0"><ChevronLeft className="w-4 h-4" /></Button>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0 bg-primary text-primary-foreground border-primary">1</Button>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0"><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>

            {/* Right Sidebar: Campaign Details */}
            {selectedCycleId && (
              <div className="flex-1 flex flex-col bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm overflow-hidden h-full">
                <div className="p-5 border-b border-primary/10 flex flex-col gap-3 bg-card z-10 shrink-0 relative">
                  <Button 
                    variant="ghost" 
                    className="absolute top-4 right-4 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    onClick={clearSelectedCycle}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <div className="flex justify-between items-start pr-8">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">
                        {activeCampaign?.name}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {activeCampaign?.type} • {activeCampaign?.framework_name || 'No framework'} • {activeCampaign?.participants} Participants • Due: {activeCampaign?.date}
                      </p>
                    </div>
                    <StatusBadge status={activeCampaign?.status === 'Completed' ? 'success' : 'info'} label={activeCampaign?.status || 'In Progress'} />
                  </div>
                  
                  {/* Internal Tabs */}
                  <div className="flex items-center gap-6 mt-2 border-b border-border/50">
                    {['Overview', 'Participants', 'Ratings', 'Calibration', 'Audit Trail'].map(tab => {
                      const id = tab.toLowerCase().split(' ')[0]
                      const isActive = id === campaignTab
                      return (
                        <button
                          key={tab}
                          onClick={() => setCampaignTab(id)}
                          className={`pb-2 text-xs font-semibold transition-colors relative ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          {tab} {['Ratings', 'Calibration'].includes(tab) && <span className="bg-muted px-1.5 py-0.5 rounded-full ml-1 text-[10px]">5</span>}
                          {isActive && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex-1 overflow-auto g2g-scrollbar relative z-10 p-4">
                  {campaignTab === 'participants' ? (
                    <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between mb-4">
                        <div className="relative w-64">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input placeholder="Search employee..." className="h-9 pl-8 bg-background border-border" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" className="h-9 text-xs gap-2"><Filter className="w-3.5 h-3.5" /> Filters</Button>
                          {/* A DEAD CONTROL, NOW HONEST ABOUT IT. This was a
                              dropdown whose only option was its own placeholder —
                              it looked operable and did nothing. Disabled and
                              labelled rather than removed, so the intent stays
                              visible: a control that looks live and does nothing
                              is worse than one that says it is unavailable. */}
                          {/* A DEAD CONTROL, HONEST ABOUT IT. Rendered as a
                              disabled button rather than a Select, because Select
                              has no `disabled` prop — a disabled-looking dropdown
                              that still opens is worse than one that plainly
                              cannot be pressed. */}
                          <Button
                            variant="outline"
                            disabled
                            title="Bulk actions are not implemented yet"
                            className="h-9 w-52 justify-start text-muted-foreground"
                          >
                            Bulk actions — not available yet
                          </Button>
                        </div>
                      </div>

                      <div className="border border-border rounded-xl overflow-hidden">
                        <Table className="w-full text-sm">
                          <TableHeader className="bg-muted/30 border-b border-primary/10">
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="w-10 text-center"><input type="checkbox" className="rounded border-border" /></TableHead>
                              <TableHead className="px-4 py-3 font-bold text-foreground">Employee</TableHead>
                              <TableHead className="px-4 py-3 font-bold text-foreground">Role</TableHead>
                              <TableHead className="px-4 py-3 text-center font-bold text-foreground">Self</TableHead>
                              <TableHead className="px-4 py-3 text-center font-bold text-foreground">Manager</TableHead>
                              <TableHead className="px-4 py-3 font-bold text-foreground">Status</TableHead>
                              <TableHead className="w-10"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="divide-y divide-primary/5">
                            {participants.map((row, i) => (
                              <TableRow key={row.assessment_id} className="hover:bg-muted/30">
                                <TableCell className="text-center">
                                  <input type="checkbox" className="rounded border-border" />
                                </TableCell>
                                <TableCell className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                      {row.initials}
                                    </div>
                                    <div>
                                      <p className="font-bold text-foreground text-xs leading-none">{row.name}</p>
                                      <p className="text-[10px] text-muted-foreground mt-1">{row.emp_id}</p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                                  {row.role}
                                </TableCell>
                                <TableCell className="px-4 py-3 text-center">
                                  {row.self ? <CheckCircle2 className="w-4 h-4 text-success mx-auto" /> : <Clock className="w-4 h-4 text-warning mx-auto" />}
                                  {row.self && row.self_date && <span className="text-[10px] text-muted-foreground block mt-1">{row.self_date}</span>}
                                </TableCell>
                                <TableCell className="px-4 py-3 text-center">
                                  {row.manager ? <CheckCircle2 className="w-4 h-4 text-success mx-auto" /> : <Clock className="w-4 h-4 text-warning mx-auto" />}
                                  {row.manager && row.manager_date ? <span className="text-[10px] text-muted-foreground block mt-1">{row.manager_date}</span> : <span className="text-[10px] text-muted-foreground block mt-1">--</span>}
                                </TableCell>
                                <TableCell className="px-4 py-3">
                                  <StatusBadge 
                                    status={row.status.includes('Calibration') ? 'default' : row.status === 'Completed' ? 'success' : 'warning'} 
                                    label={row.status} 
                                  />
                                </TableCell>
                                <TableCell className="px-4 py-3 text-center">
                                  <Button variant="ghost" className="h-6 w-6 p-0 text-muted-foreground"><MoreVertical className="w-3.5 h-3.5" /></Button>
                                </TableCell>
                              </TableRow>
                            ))}
                            {participants.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                  No participants found for this campaign.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="mt-auto pt-4 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">0 participants selected</span>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" className="h-8 text-xs"><FileText className="w-3.5 h-3.5 mr-2" /> Send Reminder</Button>
                          <Button variant="outline" className="h-8 text-xs"><Activity className="w-3.5 h-3.5 mr-2" /> View Ratings</Button>
                          <Button className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90">Start Calibration</Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-primary/20 rounded-2xl bg-card/20 text-muted-foreground p-12 h-full">
                      <p className="text-lg font-bold">This section is coming soon</p>
                      <p className="text-sm">We are currently building the {campaignTab} functionality.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm overflow-hidden mt-2">
          <div className="p-4 border-b border-primary/10 flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">
              {activeTab === 'participant' ? 'Participant Ratings'
                : activeTab === 'calibration' ? 'Calibration Queue'
                : activeTab === 'approvals' ? 'Approvals'
                : 'Closed Campaigns'}
            </h2>
            <span className="text-xs text-muted-foreground">
              {activeTab === 'closed' ? `${closedCampaigns.length} cycle(s)` : `${tabRows.length} record(s)`}
            </span>
          </div>

          {tabLoading ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Loading…</div>
          ) : activeTab === 'closed' ? (
            closedCampaigns.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">No closed campaigns yet.</div>
            ) : (
              <div className="overflow-x-auto g2g-scrollbar">
                <Table className="w-full text-sm">
                  <TableHeader className="bg-muted/30 border-b border-primary/10">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-4 py-3 font-bold text-foreground">Campaign</TableHead>
                      <TableHead className="px-4 py-3 font-bold text-foreground">Framework</TableHead>
                      <TableHead className="px-4 py-3 font-bold text-foreground text-center">Participants</TableHead>
                      <TableHead className="px-4 py-3 font-bold text-foreground">Completion</TableHead>
                      <TableHead className="px-4 py-3 font-bold text-foreground">Period</TableHead>
                      <TableHead className="px-4 py-3 font-bold text-foreground">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-primary/5">
                    {closedCampaigns.map(c => (
                      <TableRow key={c.id} className="hover:bg-muted/30">
                        <TableCell className="px-4 py-4 font-medium text-foreground">{c.name}</TableCell>
                        <TableCell className="px-4 py-4 text-muted-foreground">{c.framework_name || '—'}</TableCell>
                        <TableCell className="px-4 py-4 text-center font-semibold">{c.participants}</TableCell>
                        <TableCell className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold w-8">{c.completion}%</span>
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[120px]">
                              <div className="h-full rounded-full bg-success" style={{ width: `${c.completion}%` }} />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-4 text-muted-foreground text-xs">{c.start_date || '—'} → {c.date}</TableCell>
                        <TableCell className="px-4 py-4"><StatusBadge status="success" label="Closed" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : tabRows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              {activeTab === 'calibration' ? 'No assessments awaiting calibration.'
                : activeTab === 'approvals' ? 'No assessments awaiting approval.'
                : 'No participant ratings found.'}
            </div>
          ) : (
            <div className="overflow-x-auto g2g-scrollbar">
              <Table className="w-full text-sm">
                <TableHeader className="bg-muted/30 border-b border-primary/10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-4 py-3 font-bold text-foreground">Employee</TableHead>
                    <TableHead className="px-4 py-3 font-bold text-foreground">Role</TableHead>
                    <TableHead className="px-4 py-3 font-bold text-foreground">Campaign</TableHead>
                    <TableHead className="px-4 py-3 text-center font-bold text-foreground">Score</TableHead>
                    <TableHead className="px-4 py-3 text-center font-bold text-foreground">Self</TableHead>
                    <TableHead className="px-4 py-3 text-center font-bold text-foreground">Manager</TableHead>
                    <TableHead className="px-4 py-3 font-bold text-foreground">Status</TableHead>
                    {(activeTab === 'calibration' || activeTab === 'approvals') && <TableHead className="px-4 py-3 text-center font-bold text-foreground">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-primary/5">
                  {tabRows.map(row => (
                    <TableRow key={row.assessment_id} className="hover:bg-muted/30">
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">{row.initials}</div>
                          <div>
                            <p className="font-bold text-foreground text-xs leading-none">{row.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{row.emp_id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-muted-foreground max-w-[220px] truncate">{row.role}</TableCell>
                      <TableCell className="px-4 py-3 text-xs text-muted-foreground">{row.campaign}</TableCell>
                      <TableCell className="px-4 py-3 text-center font-semibold text-foreground">{row.score != null ? row.score.toFixed(1) : '—'}</TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        {row.self ? <CheckCircle2 className="w-4 h-4 text-success mx-auto" /> : <Clock className="w-4 h-4 text-warning mx-auto" />}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        {row.manager ? <CheckCircle2 className="w-4 h-4 text-success mx-auto" /> : <Clock className="w-4 h-4 text-warning mx-auto" />}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <StatusBadge
                          status={row.review_status === 'reviewed' ? 'success' : row.review_status === 'pending_review' ? 'warning' : row.status === 'completed' ? 'info' : 'default'}
                          label={row.review_status === 'reviewed' ? 'Reviewed' : row.review_status === 'pending_review' ? 'Pending Calibration' : row.status.replace('_', ' ')}
                        />
                      </TableCell>
                      {(activeTab === 'calibration' || activeTab === 'approvals') && (
                        <TableCell className="px-4 py-3 text-center">
                          <div className="flex items-center gap-2 justify-center">
                            <Button
                              size="sm" disabled={reviewing}
                              onClick={() => handleReview(row.assessment_id, activeTab === 'calibration' ? 'calibrate' : 'approve')}
                              className="h-7 text-xs bg-success/10 text-success border border-success/20 hover:bg-success/20"
                            >
                              {activeTab === 'calibration' ? 'Mark Calibrated' : 'Approve'}
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Create Campaign Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>New Assessment Campaign</DialogTitle>
            <DialogDescription>
              Create a new assessment cycle to evaluate competencies.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Campaign Name</label>
              <Input 
                value={newCampaignName} 
                onChange={e => setNewCampaignName(e.target.value)} 
                placeholder="e.g. Q3 2025 Performance Review" 
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Type</label>
              <Select
                options={[
                  { label: 'Self + Manager', value: 'self' },
                  { label: '360 Degree Review', value: '360' },
                ]}
                value={newCampaignType}
                onChange={setNewCampaignType}
                aria-label="Campaign type"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Framework</label>
              <Select
                options={frameworkOptions}
                value={newCampaignFramework}
                onChange={setNewCampaignFramework}
                placeholder="Select framework"
                aria-label="Framework"
              />
              <p className="text-[11px] text-muted-foreground">
                Sets which competencies the campaign rates against. Leave blank for an ad-hoc campaign.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Start Date</label>
                <Input 
                  type="date" 
                  value={newCampaignStartDate} 
                  onChange={e => setNewCampaignStartDate(e.target.value)} 
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">End Date</label>
                <Input 
                  type="date" 
                  value={newCampaignEndDate} 
                  onChange={e => setNewCampaignEndDate(e.target.value)} 
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateSubmit} disabled={!newCampaignName.trim() || creating}>
              {creating ? 'Creating...' : 'Create Campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
