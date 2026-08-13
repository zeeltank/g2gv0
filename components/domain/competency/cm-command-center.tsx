'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen, Layers, Briefcase, ClipboardCheck, Award, User, Target,
  Filter, Plus, Clock, Users, ArrowRight, CalendarDays, RotateCcw, Network, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useCompetencyCommandCenter } from '@/hooks/use-competency'
import type {
  CompetencyFilters, CompetencyFilterOption, QuickCreateKind,
} from '@/services/competency'

/* ---- static presentation maps (icons/colours keyed by backend keys) ---- */

const SUMMARY_ICONS: Record<string, LucideIcon> = {
  competencies: BookOpen,
  frameworks: Layers,
  roles_mapped: Briefcase,
  assessments: ClipboardCheck,
  certifications: Award,
  development_plans: User,
}

const PROGRESS_COLORS: Record<string, string> = {
  role_mapping: 'text-primary',
  assessment: 'text-emerald-500',
  certification: 'text-primary',
  development: 'text-orange-500',
}

const QUEUE_ICONS: Record<string, LucideIcon> = {
  my_approvals: User,
  pending_reviews: Users,
  open_assessments: ClipboardCheck,
  expiring_certifications: Award,
  overdue_plans: Target,
}

const QUICK_ACTIONS: { label: string; icon: LucideIcon; kind: QuickCreateKind }[] = [
  // kind:'competency' posts to /competency/competencies, which writes a flat
  // SKILL row (G-RBAC-02b). The label now says what it creates. Composing a real
  // competency - a named bundle of KASBA items - is cm-competency-composer.tsx.
  { label: 'Create Skill', icon: BookOpen, kind: 'competency' },
  { label: 'Create Framework', icon: Layers, kind: 'framework' },
  { label: 'Launch Assessment', icon: ClipboardCheck, kind: 'assessment' },
  { label: 'Create Development Plan', icon: Target, kind: 'development-plan' },
  { label: 'Add Certification', icon: Award, kind: 'certification' },
  // G-MAP-01 / M-03 — REINSTATED 2026-08-10, now that a create path exists.
  //
  // This button previously carried kind:'framework' - the same kind as "Create
  // Framework" above - so clicking it silently created a FRAMEWORK and reported
  // success. It was REMOVED rather than disabled, because a control that quietly
  // does the wrong thing is worse than an absent one.
  //
  // It could not simply be re-pointed: there was no role-mapping kind and no
  // endpoint to point at. There is now - POST /competency/role-map writes
  // jobrole_competency_map BY KEY, with no text column to drift.
  { label: 'Map Role Requirements', icon: Network, kind: 'role-map' },
]

// Where each tile / ring / queue "view" affordance navigates. Every target is an
// existing competency screen (module competency-management; leaf menus route to /module/competency-management/{id}/{id}).
const SUMMARY_TARGET: Record<string, string> = {
  competencies: 'cm-competency-library',
  frameworks: 'cm-framework-mapping',
  roles_mapped: 'cm-framework-mapping',
  assessments: 'cm-assessments',
  certifications: 'cm-certifications',
  development_plans: 'cm-development-career',
}

const PROGRESS_TARGET: Record<string, string> = {
  role_mapping: 'cm-framework-mapping',
  assessment: 'cm-assessments',
  certification: 'cm-certifications',
  development: 'cm-development-career',
}

const QUEUE_TARGET: Record<string, string> = {
  my_approvals: 'cm-development-career',
  pending_reviews: 'cm-assessments',
  open_assessments: 'cm-assessments',
  expiring_certifications: 'cm-certifications',
  overdue_plans: 'cm-development-career',
}

const nf = (n: number) => n.toLocaleString()

const ALL = 'all'

/* ------------------------------------------------------------------ *
 * Quick Create dialog (backed by the /competency/* POST endpoints)
 * ------------------------------------------------------------------ */

const STATUS_OPTIONS: Record<QuickCreateKind, { value: string; label: string }[]> = {
  // A role mapping has no status of its own - it is a requirement, not a record
  // with a lifecycle. Empty rather than invented, so the dialog shows no field.
  'role-map': [],
  competency: [
    { value: 'published', label: 'Published' },
    { value: 'draft', label: 'Draft' },
    { value: 'archived', label: 'Archived' },
  ],
  framework: [
    { value: 'active', label: 'Active' },
    { value: 'draft', label: 'Draft' },
    { value: 'archived', label: 'Archived' },
  ],
  assessment: [
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
  ],
  certification: [
    { value: 'valid', label: 'Valid' },
    { value: 'expiring', label: 'Expiring' },
    { value: 'expired', label: 'Expired' },
  ],
  'development-plan': [
    { value: 'active', label: 'Active' },
    { value: 'on_hold', label: 'On Hold' },
    { value: 'completed', label: 'Completed' },
  ],
}

const KIND_OPTIONS: { value: QuickCreateKind; label: string }[] = [
  { value: 'competency', label: 'Competency' },
  { value: 'framework', label: 'Framework' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'certification', label: 'Certification' },
  { value: 'development-plan', label: 'Development Plan' },
]

const COMPETENCY_TYPES = [
  { value: 'technical', label: 'Technical' },
  { value: 'behavioural', label: 'Behavioural' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'functional', label: 'Functional' },
  { value: 'core', label: 'Core' },
]

interface QuickCreateProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialKind: QuickCreateKind
  departments: CompetencyFilterOption[]
  jobroles: CompetencyFilterOption[]
  creating: boolean
  onSubmit: (kind: QuickCreateKind, payload: Record<string, unknown>) => Promise<{ ok: boolean; message: string }>
}

function QuickCreateDialog({ open, onOpenChange, initialKind, departments, jobroles, creating, onSubmit }: QuickCreateProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        {/* Mount fresh on each open so field state resets via useState initialisers - no effects. */}
        {open && (
          <QuickCreateForm
            initialKind={initialKind}
            departments={departments}
            jobroles={jobroles}
            creating={creating}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
            onCreated={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

interface QuickCreateFormProps {
  initialKind: QuickCreateKind
  departments: CompetencyFilterOption[]
  jobroles: CompetencyFilterOption[]
  creating: boolean
  onSubmit: (kind: QuickCreateKind, payload: Record<string, unknown>) => Promise<{ ok: boolean; message: string }>
  onCancel: () => void
  onCreated: () => void
}

function QuickCreateForm({ initialKind, departments, jobroles, creating, onSubmit, onCancel, onCreated }: QuickCreateFormProps) {
  const [kind, setKind] = React.useState<QuickCreateKind>(initialKind)
  const [name, setName] = React.useState('')
  const [departmentId, setDepartmentId] = React.useState('')
  const [jobrole, setJobrole] = React.useState('')
  const [status, setStatus] = React.useState(() => STATUS_OPTIONS[initialKind][0].value)
  const [date, setDate] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [competencyType, setCompetencyType] = React.useState('technical')
  const [issuingBody, setIssuingBody] = React.useState('')
  const [progress, setProgress] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  // Changing the record type resets status to that type's first valid value.
  const changeKind = (next: QuickCreateKind) => {
    setKind(next)
    setStatus(STATUS_OPTIONS[next][0].value)
  }

  const nameLabel = kind === 'competency' || kind === 'certification' ? 'Name' : 'Title'
  const showDate = kind === 'assessment' || kind === 'certification' || kind === 'development-plan'
  const dateLabel = kind === 'certification' ? 'Expiry Date' : 'Due Date'

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(`${nameLabel} is required.`)
      return
    }
    setError(null)

    const base: Record<string, unknown> = {
      status,
      ...(departmentId ? { department_id: departmentId } : {}),
      ...(jobrole ? { jobrole } : {}),
    }

    let payload: Record<string, unknown>
    switch (kind) {
      case 'competency':
        payload = { ...base, name, category, competency_type: competencyType }
        break
      case 'certification':
        payload = { ...base, name, issuing_body: issuingBody, ...(date ? { expiry_date: date } : {}) }
        break
      case 'assessment':
        payload = { ...base, title: name, ...(date ? { due_date: date } : {}) }
        break
      case 'development-plan':
        payload = { ...base, title: name, ...(date ? { due_date: date } : {}), ...(progress ? { progress: Number(progress) } : {}) }
        break
      default: // framework
        payload = { ...base, name }
    }

    const result = await onSubmit(kind, payload)
    if (result.ok) {
      onCreated()
    } else {
      setError(result.message)
    }
  }

  const departmentOptions = [{ value: '', label: 'None' }, ...departments]
  const jobroleOptions = [{ value: '', label: 'None' }, ...jobroles]

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create New</DialogTitle>
        <DialogDescription>Add a new competency-management record.</DialogDescription>
      </DialogHeader>

        <div className="flex flex-col gap-3">
          <Field label="Type">
            <Select value={kind} options={KIND_OPTIONS} onChange={(v) => changeKind(v as QuickCreateKind)} className="h-9" />
          </Field>

          <Field label={nameLabel}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`${nameLabel}...`} />
          </Field>

          {kind === 'competency' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" />
              </Field>
              <Field label="Skill Type">
                <Select value={competencyType} options={COMPETENCY_TYPES} onChange={setCompetencyType} className="h-9" />
              </Field>
            </div>
          )}

          {kind === 'certification' && (
            <Field label="Issuing Body">
              <Input value={issuingBody} onChange={(e) => setIssuingBody(e.target.value)} placeholder="Issuing body" />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Department">
              <Select value={departmentId} options={departmentOptions} onChange={setDepartmentId} className="h-9" placeholder="None" />
            </Field>
            <Field label="Job Role">
              <Select value={jobrole} options={jobroleOptions} onChange={setJobrole} className="h-9" placeholder="None" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select value={status} options={STATUS_OPTIONS[kind]} onChange={setStatus} className="h-9" />
            </Field>
            {showDate && (
              <Field label={dateLabel}>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
            )}
            {kind === 'development-plan' && (
              <Field label="Progress (%)">
                <Input type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(e.target.value)} placeholder="0" />
              </Field>
            )}
          </div>

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onCancel} disabled={creating}>Cancel</Button>
          <Button size="lg" onClick={handleSubmit} disabled={creating}>
            {creating ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

/* ------------------------------------------------------------------ *
 * Command Center
 * ------------------------------------------------------------------ */

export function CmCommandCenter() {
  const [filters, setFilters] = React.useState<CompetencyFilters>({})
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [dialogKind, setDialogKind] = React.useState<QuickCreateKind>('competency')

  const {
    loading, error, data, filterOptions, creating, actionMessage, actionError, retry, create, clearMessages,
  } = useCompetencyCommandCenter(filters)

  const setFilter = (key: keyof CompetencyFilters) => (value: string) => {
    setFilters((prev) => {
      const next = { ...prev }
      if (value === ALL || value === '') delete next[key]
      else next[key] = value
      return next
    })
  }

  const hasActiveFilters = Object.keys(filters).length > 0
  const resetFilters = () => setFilters({})

  const openCreate = (kind: QuickCreateKind) => {
    clearMessages()
    setDialogKind(kind)
    setDialogOpen(true)
  }

  const router = useRouter()
  // Navigate to a sibling competency screen (all are module competency-management leaf menus).
  const go = (submenuId: string) => router.push(`/module/competency-management/${submenuId}/${submenuId}`)

  const filterConfig: { key: keyof CompetencyFilters; label: string; options: CompetencyFilterOption[] }[] = [
    { key: 'business_unit', label: 'Business Unit', options: filterOptions?.business_units ?? [] },
    { key: 'department_id', label: 'Department', options: filterOptions?.departments ?? [] },
    { key: 'location', label: 'Location', options: filterOptions?.locations ?? [] },
    { key: 'job_family', label: 'Job Family', options: filterOptions?.job_families ?? [] },
    { key: 'jobrole', label: 'Job Role', options: filterOptions?.jobroles ?? [] },
  ]

  return (
    <div className="flex h-full flex-col gap-6 p-6 overflow-y-auto g2g-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Competency Command Center</h1>
        <Button
          onClick={() => openCreate('competency')}
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl h-10 px-4 shadow-md shadow-primary/20 flex items-center gap-2"
        >
          <Plus className="w-4 h-4 stroke-[3]" /> Create New
        </Button>
      </div>

      {/* Action feedback */}
      {(actionMessage || actionError) && (
        <div
          className={cn(
            'rounded-xl border px-4 py-2.5 text-sm font-medium flex items-center justify-between',
            actionError ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600',
          )}
        >
          <span>{actionError || actionMessage}</span>
          <button onClick={clearMessages} className="text-xs opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 flex-1">
          {filterConfig.map(({ key, label, options }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">{label}</span>
              <Select
                value={filters[key] ?? ALL}
                options={[{ label: 'All', value: ALL }, ...options]}
                onChange={setFilter(key)}
                className="h-9 bg-background/50 rounded-lg text-xs font-medium"
                aria-label={label}
              />
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          onClick={resetFilters}
          disabled={!hasActiveFilters}
          className="h-9 rounded-lg px-4 gap-2 text-xs font-bold border-border bg-background/50"
        >
          {hasActiveFilters ? <RotateCcw className="w-3.5 h-3.5" /> : <Filter className="w-3.5 h-3.5" />}
          {hasActiveFilters ? 'Reset' : 'Filters'}
        </Button>
      </div>

      {/* Body */}
      {error ? (
        <ErrorState
          title="Couldn't load the command center"
          description={error}
          retry={retry}
          className="my-8"
        />
      ) : loading && !data ? (
        <DashboardSkeleton />
      ) : data ? (
        <>
          {/* Summary Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {data.summary.map((metric) => {
              const Icon = SUMMARY_ICONS[metric.key] ?? BookOpen
              return (
                <div key={metric.key} className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center text-center gap-2 group hover:shadow-md transition-all">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-1">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-2xl font-bold text-foreground leading-none">{nf(metric.value)}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{metric.label}</div>
                  <div className="text-xs text-muted-foreground">{metric.desc}</div>
                  <button
                    onClick={() => go(SUMMARY_TARGET[metric.key] ?? 'cm-competency-library')}
                    className="text-[10px] text-primary font-bold hover:underline mt-1 opacity-70 group-hover:opacity-100 transition-opacity"
                  >
                    View all
                  </button>
                </div>
              )
            })}
          </div>

          {/* Progress Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.progress.map((prog) => (
              <div key={prog.key} className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl p-5 shadow-sm flex items-center gap-5">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path className="text-muted/30" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className={PROGRESS_COLORS[prog.key] ?? 'text-primary'} strokeWidth="3" strokeDasharray={`${prog.percent}, 100`} strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">
                    {prog.percent}%
                  </div>
                </div>
                <div className="flex flex-col flex-1">
                  <div className="text-xs font-bold text-muted-foreground mb-1">{prog.title}</div>
                  <div className="text-lg font-bold text-foreground leading-tight">{nf(prog.current)} / {nf(prog.total)}</div>
                  <div className="text-xs text-muted-foreground">{prog.sub}</div>
                  <button
                    onClick={() => go(PROGRESS_TARGET[prog.key] ?? 'cm-assessments')}
                    className="text-[10px] text-primary font-bold hover:underline mt-2 self-start"
                  >
                    View details
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Lower Grids */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Work Queues */}
            <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-[24px] shadow-sm flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-primary/5 bg-primary/5">
                <h3 className="font-bold text-sm text-foreground">Work Queues</h3>
              </div>
              <div className="flex flex-col p-2">
                {data.work_queues.map((wq) => {
                  const Icon = QUEUE_ICONS[wq.key] ?? ClipboardCheck
                  return (
                    <button
                      key={wq.key}
                      onClick={() => go(QUEUE_TARGET[wq.key] ?? 'cm-assessments')}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-primary/5 transition-colors group text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-foreground">{wq.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn('font-bold text-sm', wq.count > 0 ? 'text-foreground' : 'text-muted-foreground')}>{nf(wq.count)}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="px-5 py-3 border-t border-primary/5 mt-auto">
                <button onClick={() => go('cm-assessments')} className="text-xs text-primary font-bold hover:underline">View all work queues</button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-[24px] shadow-sm flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-primary/5 bg-primary/5">
                <h3 className="font-bold text-sm text-foreground">Recent Activity</h3>
              </div>
              {data.recent_activity.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-8">
                  <EmptyState icon={<Clock className="w-6 h-6" />} title="No recent activity" className="border-0 py-8" />
                </div>
              ) : (
                <div className="flex flex-col p-5 gap-5">
                  {data.recent_activity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0 mt-0.5">
                        {(activity.user || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col flex-1 gap-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-foreground">{activity.user}</span>
                          <span className="text-[10px] font-medium text-muted-foreground">{activity.time}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{activity.action}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="px-5 py-3 border-t border-primary/5 mt-auto">
                <button onClick={() => go('cm-audit')} className="text-xs text-primary font-bold hover:underline">View all activity</button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-[24px] shadow-sm flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-primary/5 bg-primary/5">
                <h3 className="font-bold text-sm text-foreground">Quick Actions</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 p-5">
                {QUICK_ACTIONS.map((qa) => (
                  <button
                    key={qa.label}
                    onClick={() => openCreate(qa.kind)}
                    className="flex flex-col items-center justify-center gap-3 p-4 h-auto rounded-lg border border-primary/10 bg-background/50 hover:bg-primary/5 hover:border-primary/30 transition-all group text-center"
                  >
                    <qa.icon className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-xs font-bold text-foreground">{qa.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Assessment Calendar Bottom Bar */}
          <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm p-4 flex items-center justify-between mt-2">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-foreground">
                  Assessment Calendar (Next 60 Days)
                  {data.assessment_calendar.upcoming_count > 0 && (
                    <span className="ml-2 text-xs font-medium text-muted-foreground">· {nf(data.assessment_calendar.upcoming_count)} upcoming</span>
                  )}
                </span>
                {data.assessment_calendar.cycle ? (
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-xs font-medium text-muted-foreground">{data.assessment_calendar.cycle.name}</span>
                    {data.assessment_calendar.cycle.range_label && (
                      <span className="text-xs text-muted-foreground ml-2">{data.assessment_calendar.cycle.range_label}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground mt-0.5">No active assessment cycle</span>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => go('cm-assessments')}
              className="h-9 rounded-lg font-bold text-xs bg-background"
            >
              <CalendarDays className="w-3.5 h-3.5 mr-2" /> View Calendar
            </Button>
          </div>
        </>
      ) : null}

      <QuickCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialKind={dialogKind}
        departments={filterOptions?.departments ?? []}
        jobroles={filterOptions?.jobroles ?? []}
        creating={creating}
        onSubmit={create}
      />
    </div>
  )
}

/* ---- loading skeleton ---- */

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-[24px]" />)}
      </div>
      <Skeleton className="h-20 rounded-2xl" />
    </div>
  )
}
