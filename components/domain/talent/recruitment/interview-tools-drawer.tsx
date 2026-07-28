'use client'

import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, X, Users, CalendarDays, Trash2, Pencil } from 'lucide-react'
import { recruitmentService } from '@/services/talent'
import type { FeedbackApi, FeedbackPayload, InterviewerApi, InterviewPanelApi } from '@/types/recruitment'
import type { Candidate, JobOpening } from './recruitment-data'

interface Props {
  open: boolean
  mode: 'panels' | 'feedback' | 'decision'
  interviewId?: string | null
  candidates: Candidate[]
  jobs: JobOpening[]
  onClose: () => void
  onSaved: () => Promise<void> | void
}

export function InterviewToolsDrawer({ open, mode, interviewId, candidates, jobs, onClose, onSaved }: Props) {
  const [panelTab, setPanelTab] = useState<'create' | 'view'>('create')
  const [feedbackTab, setFeedbackTab] = useState<'submit' | 'view'>('submit')
  const [panels, setPanels] = useState<InterviewPanelApi[]>([])
  const [interviewers, setInterviewers] = useState<InterviewerApi[]>([])
  const [editingPanelId, setEditingPanelId] = useState<string | null>(null)
  const [feedbackRows, setFeedbackRows] = useState<FeedbackApi[]>([])
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null)
  const [feedbackSearch, setFeedbackSearch] = useState('')
  const [feedbackStatus, setFeedbackStatus] = useState('')
  const [expandedFeedbackId, setExpandedFeedbackId] = useState<string | null>(null)
  const [deletingFeedbackId, setDeletingFeedbackId] = useState<string | null>(null)
  const [panelSearch, setPanelSearch] = useState('')
  const [panelStatus, setPanelStatus] = useState('')
  const [selectedPositionIds, setSelectedPositionIds] = useState<string[]>([])
  const [selectedInterviewerIds, setSelectedInterviewerIds] = useState<string[]>([])
  const [expandedPanelId, setExpandedPanelId] = useState<string | null>(null)
  const [deletingPanelId, setDeletingPanelId] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [loadingPanels, setLoadingPanels] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }))

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setLoadingPanels(true)
      void Promise.all([recruitmentService.getPanels(), recruitmentService.getInterviewers(), recruitmentService.getFeedback()]).then(([panelRows, interviewerRows, feedback]) => {
        setPanels(panelRows)
        setInterviewers(interviewerRows)
        setFeedbackRows(feedback)
      }).catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Unable to load interview panels.')
      }).finally(() => setLoadingPanels(false))
    })
  }, [open])

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      if (mode === 'panels') {
        if (!values.panel_name?.trim()) throw new Error('Panel name is required.')
        const payload: Omit<InterviewPanelApi, 'id'> = {
          panel_name: values.panel_name,
          target_positions: selectedPositionIds.join(','),
          description: values.description || null,
          available_interviewers: selectedInterviewerIds,
          status: (values.panel_status || 'available') as InterviewPanelApi['status'],
        }
        if (editingPanelId) await recruitmentService.updatePanel(editingPanelId, payload)
        else await recruitmentService.createPanel(payload)
        setPanels(await recruitmentService.getPanels())
        setEditingPanelId(null)
        setSelectedPositionIds([])
        setSelectedInterviewerIds([])
        setPanelTab('view')
      } else if (mode === 'feedback') {
        const payload: FeedbackPayload = {
          job_id: values.job_id,
          candidate_id: values.candidate_id,
          panel_id: values.panel_id,
          evaluation_criteria: [
            { name: 'Technical competency', score: Number(values.technical_score) },
            { name: 'Communication', score: Number(values.communication_score) },
          ],
          recommendation: values.recommendation,
          key_strengths: values.key_strengths,
          areas_of_concern: values.areas_of_concern,
          additional_comments: values.comments,
          status: 'submitted',
        }
        if (editingFeedbackId) await recruitmentService.updateFeedback(editingFeedbackId, payload)
        else await recruitmentService.createFeedback(payload)
        setEditingFeedbackId(null)
        setFeedbackRows(await recruitmentService.getFeedback())
        setFeedbackTab('view')
        await onSaved()
      } else {
        if (!interviewId || !['hired', 'rejected'].includes(values.decision)) {
          throw new Error('Select a hiring decision.')
        }
        await recruitmentService.recordDecision(interviewId, values.decision as 'hired' | 'rejected', values.notes)
        await onSaved()
        onClose()
      }
      setValues({})
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The operation could not be completed.')
    } finally {
      setSaving(false)
    }
  }

  function parseIds(value: InterviewPanelApi['available_interviewers']) {
    if (Array.isArray(value)) return value.map(String)
    if (!value) return []
    try {
      const parsed = JSON.parse(value) as unknown
      if (Array.isArray(parsed)) return parsed.map(String)
    } catch {
      // The backend also accepts comma-separated strings.
    }
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }

  const visiblePanels = panels.filter((panel) => {
    const term = panelSearch.trim().toLowerCase()
    const matchesSearch = !term || `${panel.panel_name} ${panel.description ?? ''}`.toLowerCase().includes(term)
    const matchesStatus = !panelStatus || panel.status === panelStatus
    return matchesSearch && matchesStatus
  })

  const visibleFeedback = feedbackRows.filter((row) => {
    const term = feedbackSearch.trim().toLowerCase()
    const matchesSearch = !term || `${row.candidate_name ?? ''} ${row.job_title ?? ''} ${row.panel_name ?? ''} ${row.recommendation ?? ''}`.toLowerCase().includes(term)
    return matchesSearch && (!feedbackStatus || row.status === feedbackStatus)
  })

  const interviewerName = (id: string) => {
    const interviewer = interviewers.find((item) => String(item.id) === id)
    return interviewer?.name ?? ([interviewer?.first_name, interviewer?.last_name].filter(Boolean).join(' ') || id)
  }

  const positionName = (id: string) => jobs.find((job) => job.id === id)?.title ?? id

  function closeDrawer() {
    setValues({})
    setEditingPanelId(null)
    setEditingFeedbackId(null)
    setFeedbackTab('submit')
    setExpandedFeedbackId(null)
    setDeletingFeedbackId(null)
    setSelectedPositionIds([])
    setSelectedInterviewerIds([])
    setExpandedPanelId(null)
    setDeletingPanelId(null)
    setPanelTab('create')
    setError(null)
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && closeDrawer()}>
      <SheetContent side="right" className="flex h-full w-full flex-col overflow-hidden p-0 sm:max-w-2xl">
        <SheetHeader className="border-b p-6 pr-12">
          <SheetTitle>{mode === 'panels' ? 'Interview panels' : mode === 'feedback' ? 'Submit interview feedback' : 'Record hiring decision'}</SheetTitle>
          <SheetDescription>{mode === 'panels' ? 'Create and manage the panels available for interview scheduling.' : mode === 'feedback' ? 'Scores must be between 1 and 10.' : 'Record the manager decision and supporting notes.'}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-6">

        {mode === 'panels' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 rounded-lg bg-muted p-1" role="tablist" aria-label="Interview panel sections">
              <button type="button" role="tab" aria-selected={panelTab === 'create'} onClick={() => setPanelTab('create')} className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${panelTab === 'create' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                Create Panel
              </button>
              <button type="button" role="tab" aria-selected={panelTab === 'view'} onClick={() => setPanelTab('view')} className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${panelTab === 'view' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                View Panels
              </button>
            </div>
            {loadingPanels && <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Loading interview panels…</div>}
            {panelTab === 'create' && <div className="rounded-xl border bg-muted/20 p-4">
              <h3 className="mb-4 text-sm font-semibold">{editingPanelId ? 'Edit interview panel' : 'Create interview panel'}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input placeholder="e.g. Senior Engineering Panel" value={values.panel_name ?? ''} onChange={(event) => set('panel_name', event.target.value)} />
                <Select value={values.panel_status ?? 'available'} onChange={(value) => set('panel_status', value)} options={[
                  { label: 'Available', value: 'available' },
                  { label: 'Active', value: 'active' },
                  { label: 'Assigned', value: 'assigned' },
                  { label: 'Inactive', value: 'inactive' },
                ]} />
                <Textarea className="sm:col-span-2" placeholder="Describe the panel's purpose and expertise..." value={values.description ?? ''} onChange={(event) => set('description', event.target.value)} />
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-semibold">Target positions</p>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border bg-card p-2">
                    {jobs.map((job) => {
                      const selected = selectedPositionIds.includes(job.id)
                      return (
                        <button key={job.id} type="button" onClick={() => setSelectedPositionIds((current) => selected ? current.filter((id) => id !== job.id) : [...current, job.id])} className="flex w-full items-center justify-between rounded-md p-2 text-left text-sm hover:bg-muted">
                          <span>{job.title}</span>
                          {selected ? <X className="size-4 text-primary" /> : <Plus className="size-4 text-muted-foreground" />}
                        </button>
                      )
                    })}
                    {!jobs.length && <p className="p-2 text-xs text-muted-foreground">No job positions available.</p>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedPositionIds.map((id) => <Badge key={id} variant="secondary">{positionName(id)}</Badge>)}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold">Panel members</p>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border bg-card p-2">
                    {interviewers.map((interviewer) => {
                      const id = String(interviewer.id)
                      const selected = selectedInterviewerIds.includes(id)
                      return (
                        <button key={id} type="button" onClick={() => setSelectedInterviewerIds((current) => selected ? current.filter((item) => item !== id) : [...current, id])} className="flex w-full items-start justify-between rounded-md p-2 text-left hover:bg-muted">
                          <span>
                            <span className="block text-sm font-medium">{interviewerName(id)}</span>
                            <span className="block text-xs text-muted-foreground">{interviewer.job_role ?? interviewer.jobrole ?? 'Interviewer'}</span>
                            {!!interviewer.skills?.length && <span className="mt-1 block text-[11px] text-muted-foreground">{interviewer.skills.slice(0, 3).join(', ')}</span>}
                          </span>
                          {selected ? <X className="mt-1 size-4 text-primary" /> : <Plus className="mt-1 size-4 text-muted-foreground" />}
                        </button>
                      )
                    })}
                    {!interviewers.length && <p className="p-2 text-xs text-muted-foreground">No interviewers available.</p>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedInterviewerIds.map((id) => <Badge key={id} variant="secondary">{interviewerName(id)}</Badge>)}
                  </div>
                </div>
              </div>
            </div>}

            {panelTab === 'view' && <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search panels..." value={panelSearch} onChange={(event) => setPanelSearch(event.target.value)} />
              </div>
              <Select className="sm:w-40" value={panelStatus} onChange={setPanelStatus} options={[
                { label: 'All panels', value: '' }, { label: 'Available', value: 'available' },
                { label: 'Active', value: 'active' }, { label: 'Assigned', value: 'assigned' },
                { label: 'Inactive', value: 'inactive' },
              ]} />
            </div>

            <div className="space-y-3">
              {visiblePanels.map((panel) => {
                const memberIds = parseIds(panel.available_interviewers)
                const positionIds = (panel.target_positions ?? '').split(',').map((item) => item.trim()).filter(Boolean)
                const expanded = expandedPanelId === String(panel.id)
                const schedules = panel.schedules ?? []
                const upcoming = schedules.filter((schedule) => schedule.interview_date && new Date(schedule.interview_date) >= new Date()).length
                return (
                  <div key={String(panel.id)} className="rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{panel.panel_name}</p>
                        <div className="mt-1 flex gap-1"><Badge variant="secondary">{panel.status}</Badge><Badge variant="outline">{memberIds.length} members</Badge></div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => {
                          setEditingPanelId(String(panel.id))
                          setSelectedPositionIds(positionIds)
                          setSelectedInterviewerIds(memberIds)
                          setValues({ panel_name: panel.panel_name, description: panel.description ?? '', panel_status: panel.status })
                          setPanelTab('create')
                        }}><Pencil className="size-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeletingPanelId(String(panel.id))}><Trash2 className="size-4 text-destructive" /></Button>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{panel.description || 'No description provided.'}</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 text-center">
                      <div><p className="text-lg font-bold text-primary">{upcoming}</p><p className="text-xs text-muted-foreground">Upcoming</p></div>
                      <div><p className="text-lg font-bold text-primary">{schedules.length}</p><p className="text-xs text-muted-foreground">Total</p></div>
                    </div>
                    <Button className="mt-3 w-full" variant="outline" onClick={() => setExpandedPanelId(expanded ? null : String(panel.id))}>{expanded ? 'Hide details' : 'View details'}</Button>
                    {expanded && (
                      <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
                        <div><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Users className="size-3.5" />Members</p><div className="flex flex-wrap gap-1">{memberIds.map((id) => <Badge key={id} variant="outline">{interviewerName(id)}</Badge>)}{!memberIds.length && <span className="text-xs text-muted-foreground">None assigned</span>}</div></div>
                        <div><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><CalendarDays className="size-3.5" />Positions</p><div className="flex flex-wrap gap-1">{positionIds.map((id) => <Badge key={id} variant="outline">{positionName(id)}</Badge>)}{!positionIds.length && <span className="text-xs text-muted-foreground">No positions</span>}</div></div>
                      </div>
                    )}
                  </div>
                )
              })}
              {!visiblePanels.length && <div className="py-10 text-center"><Users className="mx-auto size-10 text-muted-foreground/40" /><p className="mt-3 text-sm font-medium">No panels found</p><p className="text-xs text-muted-foreground">Adjust the search or create the first panel.</p></div>}
            </div>

            {deletingPanelId && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-semibold">Delete this interview panel?</p>
                <p className="mt-1 text-xs text-muted-foreground">This action removes the panel from future scheduling.</p>
                <div className="mt-3 flex justify-end gap-2"><Button variant="outline" onClick={() => setDeletingPanelId(null)}>Cancel</Button><Button variant="destructive" onClick={() => void recruitmentService.deletePanel(deletingPanelId).then(async () => { setPanels(await recruitmentService.getPanels()); setDeletingPanelId(null) })}>Delete panel</Button></div>
              </div>
            )}
            </div>}
          </div>
        ) : mode === 'feedback' ? (
          <div className="space-y-6">
          <div className="grid grid-cols-2 rounded-lg bg-muted p-1" role="tablist" aria-label="Interview feedback sections">
            <button type="button" role="tab" aria-selected={feedbackTab === 'submit'} onClick={() => setFeedbackTab('submit')} className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${feedbackTab === 'submit' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              Submit Feedback
            </button>
            <button type="button" role="tab" aria-selected={feedbackTab === 'view'} onClick={() => setFeedbackTab('view')} className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${feedbackTab === 'view' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              View Feedback
            </button>
          </div>
          {feedbackTab === 'submit' && <div className="grid gap-4 sm:grid-cols-2">
            <Select value={values.candidate_id ?? ''} onChange={(value) => set('candidate_id', value)} options={[
              { label: 'Select candidate', value: '' }, ...candidates.map((candidate) => ({ label: candidate.name, value: candidate.id })),
            ]} />
            <Select value={values.job_id ?? ''} onChange={(value) => set('job_id', value)} options={[
              { label: 'Select job', value: '' }, ...jobs.map((job) => ({ label: job.title, value: job.id })),
            ]} />
            <Select value={values.panel_id ?? ''} onChange={(value) => set('panel_id', value)} options={[
              { label: 'Select panel', value: '' }, ...panels.map((panel) => ({ label: panel.panel_name, value: String(panel.id) })),
            ]} />
            <Select value={values.recommendation ?? ''} onChange={(value) => set('recommendation', value)} options={[
              { label: 'Recommendation', value: '' }, { label: 'Hire', value: 'hire' },
              { label: 'Maybe', value: 'maybe' }, { label: 'No Hire', value: 'no-hire' },
            ]} />
            <Input type="number" min={1} max={10} placeholder="Technical score (1–10)" value={values.technical_score ?? ''} onChange={(event) => set('technical_score', event.target.value)} />
            <Input type="number" min={1} max={10} placeholder="Communication score (1–10)" value={values.communication_score ?? ''} onChange={(event) => set('communication_score', event.target.value)} />
            <Textarea placeholder="Key strengths" value={values.key_strengths ?? ''} onChange={(event) => set('key_strengths', event.target.value)} />
            <Textarea placeholder="Areas of concern" value={values.areas_of_concern ?? ''} onChange={(event) => set('areas_of_concern', event.target.value)} />
            <Textarea className="sm:col-span-2" placeholder="Additional comments" value={values.comments ?? ''} onChange={(event) => set('comments', event.target.value)} />
          </div>}
          {feedbackTab === 'view' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search feedback..." value={feedbackSearch} onChange={(event) => setFeedbackSearch(event.target.value)} />
                </div>
                <Select className="sm:w-40" value={feedbackStatus} onChange={setFeedbackStatus} options={[
                  { label: 'All statuses', value: '' }, { label: 'Submitted', value: 'submitted' },
                  { label: 'Approved', value: 'approved' }, { label: 'Draft', value: 'draft' },
                  { label: 'Rejected', value: 'rejected' },
                ]} />
              </div>
              {visibleFeedback.map((row) => {
                const rowId = String(row.id)
                const expanded = expandedFeedbackId === rowId
                return <div key={rowId} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{row.candidate_name ?? `Candidate ${row.candidate_id}`}</p>
                      <p className="text-xs text-muted-foreground">{row.job_title ?? `Job ${row.job_id}`} · {row.panel_name ?? `Panel ${row.panel_id}`}</p>
                      <div className="mt-2 flex gap-1"><Badge variant="secondary">{row.status ?? 'submitted'}</Badge>{row.recommendation && <Badge variant="outline">{row.recommendation}</Badge>}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" aria-label="Edit feedback" onClick={() => {
                  setEditingFeedbackId(String(row.id))
                  setValues({
                    candidate_id: String(row.candidate_id),
                    job_id: String(row.job_id),
                    panel_id: String(row.panel_id),
                    recommendation: row.recommendation ?? '',
                    technical_score: String(row.evaluation_criteria?.[0]?.score ?? ''),
                    communication_score: String(row.evaluation_criteria?.[1]?.score ?? ''),
                    key_strengths: row.key_strengths ?? '',
                    areas_of_concern: row.areas_of_concern ?? '',
                    comments: row.additional_comments ?? '',
                  })
                        setFeedbackTab('submit')
                      }}><Pencil className="size-4" /></Button>
                      <Button size="icon" variant="ghost" aria-label="Delete feedback" onClick={() => setDeletingFeedbackId(rowId)}><Trash2 className="size-4 text-destructive" /></Button>
                    </div>
                  </div>
                  <Button className="mt-3 w-full" variant="outline" onClick={() => setExpandedFeedbackId(expanded ? null : rowId)}>{expanded ? 'Hide details' : 'View details'}</Button>
                  {expanded && <div className="mt-4 space-y-3 border-t pt-4 text-sm">
                    <div className="grid grid-cols-2 gap-3">{row.evaluation_criteria.map((criterion) => <div key={criterion.name} className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{criterion.name}</p><p className="text-lg font-bold text-primary">{criterion.score}/10</p></div>)}</div>
                    <div><p className="text-xs font-semibold uppercase text-muted-foreground">Key strengths</p><p className="mt-1">{row.key_strengths || 'Not provided'}</p></div>
                    <div><p className="text-xs font-semibold uppercase text-muted-foreground">Areas of concern</p><p className="mt-1">{row.areas_of_concern || 'Not provided'}</p></div>
                    <div><p className="text-xs font-semibold uppercase text-muted-foreground">Comments</p><p className="mt-1">{row.additional_comments || 'Not provided'}</p></div>
                  </div>}
                </div>
              })}
              {!visibleFeedback.length && <div className="py-10 text-center"><Users className="mx-auto size-10 text-muted-foreground/40" /><p className="mt-3 text-sm font-medium">No feedback found</p><p className="text-xs text-muted-foreground">Adjust the search or submit the first feedback.</p></div>}
              {deletingFeedbackId && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-semibold">Delete this interview feedback?</p>
                <p className="mt-1 text-xs text-muted-foreground">This action permanently removes the submitted feedback.</p>
                <div className="mt-3 flex justify-end gap-2"><Button variant="outline" onClick={() => setDeletingFeedbackId(null)}>Cancel</Button><Button variant="destructive" onClick={() => void recruitmentService.deleteFeedback(deletingFeedbackId).then(async () => { setFeedbackRows(await recruitmentService.getFeedback()); setDeletingFeedbackId(null) })}>Delete feedback</Button></div>
              </div>}
            </div>
          )}
          </div>
        ) : (
          <div className="space-y-4">
            <Select value={values.decision ?? ''} onChange={(value) => set('decision', value)} options={[
              { label: 'Select decision', value: '' },
              { label: 'Hire candidate', value: 'hired' },
              { label: 'Reject candidate', value: 'rejected' },
            ]} />
            <Textarea placeholder="Manager notes" value={values.notes ?? ''} onChange={(event) => set('notes', event.target.value)} />
          </div>
        )}

        {error && <p className="mt-4 text-sm font-medium text-destructive">{error}</p>}
        </div>
        <SheetFooter className={`border-t p-6 ${(mode === 'panels' && panelTab === 'view') || (mode === 'feedback' && feedbackTab === 'view') ? '[&>button:last-child]:hidden' : ''}`}>
          <Button variant="outline" onClick={closeDrawer}>Close</Button>
          <Button disabled={saving} onClick={() => void submit()}>{saving ? 'Saving…' : mode === 'panels' ? editingPanelId ? 'Update panel' : 'Create panel' : mode === 'feedback' ? editingFeedbackId ? 'Update feedback' : 'Submit feedback' : 'Save decision'}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
