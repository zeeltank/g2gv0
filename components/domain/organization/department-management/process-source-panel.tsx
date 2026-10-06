'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRightCircle,
  Check,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Loader2,
  ListChecks,
  Shield,
  ShieldCheck,
  Sparkles,
  Upload,
  Workflow as WorkflowIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'
import { cn } from '@/lib/utils'
import { SelectInput } from '../components'
import { Notice } from './signals-ui'
import { organizationService } from '@/services/organization'
import type { Department } from '@/lib/gtg-org-data'
import type { LaravelContext } from '@/lib/laravel-context'
import type {
  DepartmentProcessCategory,
  DepartmentSop,
  ProcessConversionResult,
  ProcessConversionSpec,
  ProcessConversionTask,
  ProcessConversionTaskCategory,
} from '@/services/organization'
import { buildLinearGraph, toApiGraph } from './process-graph-utils'

/**
 * The K12-parity converter: paste (or load) a department SOP procedure, read
 * it into a full standardized record - Process/Workflow/Tasks - then Save it
 * as a real department process and Assign & Publish its tasks. Lives full
 * width on the Process tab itself (ProcessLibrary), ABOVE the process card
 * grid - not inside the canvas builder overlay, which stays exactly as it
 * was for drag-and-drop graph editing. "Saved processes" is simply that
 * existing card grid: a converted process is just another process once
 * saved, nothing parallel invented for it.
 */

const SECTIONS = [
  { id: 'source', label: 'Source' },
  { id: 'process', label: 'Process' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'tasks', label: 'Tasks' },
]

const TASK_GROUPS: Array<{ key: ProcessConversionTaskCategory; label: string; icon: typeof ClipboardCheck; blurb: string }> = [
  {
    key: 'readiness',
    label: 'Readiness',
    icon: ClipboardCheck,
    blurb: "Master data and configuration the procedure depends on. Until these hold, the process can't run at all.",
  },
  {
    key: 'human_gate',
    label: 'Human gate',
    icon: ShieldCheck,
    blurb: 'The engine performs these steps unattended - a named person verifies the output before anything relies on it.',
  },
  {
    key: 'workflow_step',
    label: 'Workflow step',
    icon: ListChecks,
    blurb: 'Steps a person performs (alone, or reviewing what the system drafted). Directly assignable work.',
  },
  {
    key: 'handover',
    label: 'Handover',
    icon: ArrowRightCircle,
    blurb: 'Where this procedure hands off. Raised so nothing it produces is left unactioned.',
  },
]

const PRIORITY_VARIANT: Record<ProcessConversionTask['priority'], 'destructive' | 'warning' | 'muted'> = {
  High: 'destructive',
  Medium: 'warning',
  Low: 'muted',
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value || '—'}</dd>
    </div>
  )
}

function FactList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) {
    return <Fact label={label} value={null} />
  }
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd>
        <ul className="list-disc space-y-0.5 pl-4 text-sm text-foreground">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </dd>
    </div>
  )
}

/** One actor's row in the lane strip - a chip under every step column that actor owns. AI/Person+AI get their own lanes same as a person. */
function LaneRow({ actor, steps }: { actor: string; steps: ProcessConversionSpec['steps'] }) {
  return (
    <>
      <div className="truncate pr-2 text-xs font-medium text-foreground">{actor}</div>
      {steps.map((step) => {
        const mine = (step.actor ?? 'Unassigned') === actor
        return (
          <div key={step.order} className="flex items-center justify-center py-0.5">
            {mine && (
              <span
                title={step.system_action}
                className={cn(
                  'relative flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white',
                  step.is_approval ? 'bg-warning' : step.actor_type === 'ai' ? 'bg-primary/70' : 'bg-primary',
                )}
              >
                {step.order}
                {step.is_approval && (
                  <Shield
                    className="absolute -right-1 -top-1 size-3 rounded-full bg-background p-0.5 text-warning"
                    aria-hidden="true"
                  />
                )}
              </span>
            )}
          </div>
        )
      })}
    </>
  )
}

export function ProcessSourcePanel({
  department,
  context,
  categories,
  stepTypes,
  canManage,
  onProcessSaved,
}: {
  department: Department
  context: LaravelContext
  categories: DepartmentProcessCategory[]
  stepTypes: Record<string, { label: string; color: string }>
  canManage: boolean
  onProcessSaved: () => void
}) {
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const [group, setGroup] = useState('')
  const [category, setCategory] = useState('')
  const [name, setName] = useState('')
  const [sourceText, setSourceText] = useState('')
  const [sops, setSops] = useState<DepartmentSop[]>([])
  const [selectedSopId, setSelectedSopId] = useState('')

  const [result, setResult] = useState<ProcessConversionResult | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [convertError, setConvertError] = useState('')

  const [savedProcessId, setSavedProcessId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [selectedRefs, setSelectedRefs] = useState<Set<string>>(new Set())
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [candidates, setCandidates] = useState<SearchableOption[]>([])
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [publishedRefs, setPublishedRefs] = useState<Set<string>>(new Set())

  const groups = useMemo(() => Array.from(new Set(categories.map((c) => c.group))), [categories])
  const categoryOptions = useMemo(
    () => categories.filter((c) => !group || c.group === group),
    [categories, group],
  )

  const spec = result?.spec ?? null

  const actors = useMemo(() => {
    if (!spec) return []
    const seen: string[] = []
    for (const step of spec.steps) {
      const label = step.actor ?? 'Unassigned'
      if (!seen.includes(label)) seen.push(label)
    }
    return seen
  }, [spec])

  const tasksByCategory = useMemo(() => {
    const map = new Map<ProcessConversionTaskCategory, ProcessConversionTask[]>()
    for (const task of spec?.tasks ?? []) {
      if (!map.has(task.category)) map.set(task.category, [])
      map.get(task.category)!.push(task)
    }
    return map
  }, [spec])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      organizationService.getDepartmentSops(context, String(department.id)),
      organizationService.getDepartmentCandidates(context, { departmentId: department.id }),
    ])
      .then(([sopResponse, employeeResponse]) => {
        if (cancelled) return
        setSops(sopResponse?.data ?? [])
        setCandidates(
          (employeeResponse?.data ?? []).map((e) => ({
            value: String(e.id),
            label: e.name || e.full_name || [e.first_name, e.last_name].filter(Boolean).join(' ') || `#${e.id}`,
            hint: e.employee_no,
          })),
        )
      })
      .catch(() => {
        /* the Load/assignee pickers just stay empty - not fatal to the panel */
      })
    return () => {
      cancelled = true
    }
  }, [context, department.id])

  function jumpTo(id: string) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function loadSop(sopId: string) {
    setSelectedSopId(sopId)
    const sop = sops.find((s) => String(s.id) === sopId)
    if (!sop) return
    if (!name.trim()) setName(sop.title)
    const body = [sop.description].filter(Boolean).join('\n\n')
    if (body) setSourceText(body)
  }

  async function convert(useAi: boolean) {
    if (!sourceText.trim()) {
      setConvertError('Paste the procedure first.')
      return
    }
    setIsConverting(true)
    setConvertError('')
    try {
      const response = await organizationService.convertDepartmentProcessSource(context, {
        department_id: String(department.id),
        name: name.trim() || undefined,
        category: category || undefined,
        source_text: sourceText,
        use_ai: useAi,
      })
      setResult(response.data ?? null)
      setSavedProcessId(null)
      setPublishedRefs(new Set())
      if (response.data?.spec.tasks) {
        setSelectedRefs(new Set(response.data.spec.tasks.map((t) => t.ref)))
      }
      requestAnimationFrame(() => jumpTo('process'))
    } catch (cause) {
      setConvertError(cause instanceof Error ? cause.message : 'That procedure could not be read.')
    } finally {
      setIsConverting(false)
    }
  }

  async function saveProcess() {
    if (!spec) return
    setIsSaving(true)
    setSaveError('')
    try {
      const graph = buildLinearGraph(
        spec.steps.map((step) => ({
          actor: step.actor,
          actor_type: step.actor_type,
          is_approval: step.is_approval,
          title: step.user_action || step.system_action,
        })),
        stepTypes,
      )

      const created = await organizationService.saveDepartmentProcess(context, {
        department_id: department.id,
        name: name.trim() || spec.name,
        category: category || undefined,
        description: spec.objective ?? undefined,
        canvas_meta: {
          preconditions: spec.preconditions,
          inputs: spec.inputs,
          outputs: spec.outputs,
          handoffs: spec.handoffs,
          business_rules: spec.business_rules,
          tasks: spec.tasks,
        },
      })
      if (!created.data?.id) throw new Error('The process was not created.')

      const apiGraph = toApiGraph(graph.nodes, graph.edges)
      await organizationService.updateDepartmentProcessCanvas(context, String(created.data.id), apiGraph)

      setSavedProcessId(String(created.data.id))
      onProcessSaved()
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Failed to save the process.')
    } finally {
      setIsSaving(false)
    }
  }

  async function publishTasks() {
    if (!savedProcessId) return
    const toPublish: Record<string, number> = {}
    for (const ref of selectedRefs) {
      if (publishedRefs.has(ref)) continue
      const userId = Number(assignments[ref])
      if (userId > 0) toPublish[ref] = userId
    }
    if (Object.keys(toPublish).length === 0) {
      setPublishError('Choose an assignee for at least one selected task.')
      return
    }

    setIsPublishing(true)
    setPublishError('')
    try {
      const response = await organizationService.publishDepartmentProcessTasks(context, savedProcessId, toPublish)
      const data = response.data
      if (data) {
        setPublishedRefs((prev) => {
          const next = new Set(prev)
          data.created.forEach((c) => next.add(c.ref))
          data.already_published.forEach((ref) => next.add(ref))
          return next
        })
        if (data.problems.length > 0) setPublishError(data.problems.join(' '))
      }
    } catch (cause) {
      setPublishError(cause instanceof Error ? cause.message : 'Failed to publish the selected tasks.')
    } finally {
      setIsPublishing(false)
    }
  }

  if (!canManage) return null

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            Turn a written SOP procedure into something the ERP can run
          </h3>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Pick a procedure from this department&apos;s SOPs (or paste one), and the converter reads its own
            anatomy - its attribute list, its numbered steps, its outputs - and produces three linked records.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
          <ClipboardList className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">A Process</p>
            <p className="text-xs text-muted-foreground">
              Objective, trigger, preconditions, completion criteria and the business rules that govern it.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
          <WorkflowIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">A Workflow</p>
            <p className="text-xs text-muted-foreground">
              Every step with its actor, what the system does, what is validated, and where a human must confirm.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
          <ListChecks className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">Tasks</p>
            <p className="text-xs text-muted-foreground">
              The work that actually falls to a person, ready to assign and publish.
            </p>
          </div>
        </div>
      </div>

      <nav aria-label="Process builder steps" className="sticky top-0 z-10 flex gap-1 overflow-x-auto bg-card py-1">
        {SECTIONS.map((section, index) => (
          <button
            key={section.id}
            type="button"
            onClick={() => jumpTo(section.id)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
              {index + 1}
            </span>
            {section.label}
          </button>
        ))}
      </nav>

      <div
        ref={(el) => {
          sectionRefs.current.source = el
        }}
        className="space-y-3 rounded-lg border border-border p-3"
      >
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">1. Source</h4>
        <p className="text-xs text-muted-foreground">Pick the category and, optionally, load one of this department&apos;s SOPs, then paste the procedure text.</p>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <SelectInput
            value={group}
            onChange={(value) => {
              setGroup(value)
              setCategory('')
            }}
            options={[{ value: '', label: 'Group...' }, ...groups.map((g) => ({ value: g, label: g }))]}
          />
          <SelectInput
            value={category}
            onChange={setCategory}
            options={[
              { value: '', label: 'Category...' },
              ...categoryOptions.map((c) => ({ value: c.key, label: c.label })),
            ]}
          />
          <SelectInput
            value={selectedSopId}
            onChange={loadSop}
            options={[
              { value: '', label: sops.length === 0 ? 'No SOPs in this department' : 'Load from an SOP...' },
              ...sops.map((s) => ({ value: String(s.id), label: s.title })),
            ]}
          />
        </div>

        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Process name" />

        <Textarea
          rows={10}
          value={sourceText}
          onChange={(event) => setSourceText(event.target.value)}
          placeholder={
            'Objective: ...\nPreconditions:\n- ...\n1. Fees officer | Opens the ledger | Loads the balance | BR-10: ... | Ledger opens\n2. AI | - | Allocates the payment | BR-04: ... | Allocation proposed\nHands over to: 6.8 Reconciliation'
          }
          className="font-mono text-xs"
        />
        <p className="text-[11px] text-muted-foreground">
          Number the steps. Either <code>Action (Role) [approval]</code>, or the full{' '}
          <code>Actor | User action | System action | Decision | Result</code> form - an actor of literally{' '}
          <code>AI</code> marks an unattended step, <code>Role + AI</code> a reviewed one. Cite a rule inline as{' '}
          <code>BR-xx</code>.
        </p>

        {convertError && <Notice tone="error">{convertError}</Notice>}
        {result?.ai_status && (
          <Notice tone="warning">AI couldn&apos;t help either: {result.ai_status.detail || result.ai_status.reason}</Notice>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={isConverting} onClick={() => void convert(false)}>
            {isConverting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileText className="size-4" aria-hidden="true" />}
            {isConverting ? 'Reading...' : 'Convert to process'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isConverting || !spec || spec.issues.length === 0}
            onClick={() => void convert(true)}
            title={spec && spec.issues.length === 0 ? 'Only needed once the deterministic read reports issues' : undefined}
          >
            <Sparkles className="size-4" aria-hidden="true" />
            Use AI to normalise unstructured text
          </Button>
        </div>
      </div>

      {spec && (
        <>
          <div
            ref={(el) => {
              sectionRefs.current.process = el
            }}
            className="space-y-3 rounded-lg border border-border p-3"
          >
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">2. Process</h4>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Fact label="Objective" value={spec.objective} />
              <Fact label="Trigger" value={spec.trigger} />
              <FactList label="Preconditions" items={spec.preconditions.map((p) => p.text)} />
              <FactList label="Inputs" items={spec.inputs} />
              <Fact label="Completion criteria" value={spec.completion} />
              <FactList label="Outputs" items={spec.outputs} />
              <FactList label="Hands over to" items={spec.handoffs} />
            </dl>

            {spec.issues.length > 0 && (
              <Notice tone="warning">
                <p className="mb-1 font-medium">{spec.issues.length} line(s) could not be read:</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  {spec.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </Notice>
            )}

            {Object.keys(spec.business_rules).length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Governing business rules
                </p>
                <div className="overflow-x-auto rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Rule</TableHead>
                        <TableHead>Validation</TableHead>
                        <TableHead>Applies at</TableHead>
                        <TableHead>On failure</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.values(spec.business_rules).map((rule) => (
                        <TableRow key={rule.code}>
                          <TableCell className="text-xs font-semibold text-foreground">{rule.code}</TableCell>
                          <TableCell className="text-sm">{rule.validation || rule.rule_definition || '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{rule.applies_at || '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{rule.on_failure || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <div
            ref={(el) => {
              sectionRefs.current.workflow = el
            }}
            className="space-y-3 rounded-lg border border-border p-3"
          >
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">3. Workflow</h4>

            <div className="g2g-scrollbar overflow-x-auto pb-1">
              <div
                className="inline-grid items-center gap-x-1"
                style={{ gridTemplateColumns: `110px repeat(${spec.steps.length}, 28px)` }}
              >
                <div />
                {spec.steps.map((step) => (
                  <div key={step.order} className="text-center text-[10px] text-muted-foreground">
                    {step.order}
                  </div>
                ))}
                {actors.map((actor) => (
                  <LaneRow key={actor} actor={actor} steps={spec.steps} />
                ))}
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>User action</TableHead>
                    <TableHead>System action</TableHead>
                    <TableHead>Decision / validation</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {spec.steps.map((step) => (
                    <TableRow key={step.order}>
                      <TableCell className="text-xs text-muted-foreground">{step.order}</TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1.5">
                          {step.actor ?? '—'}
                          {step.is_approval && (
                            <Badge variant="warning" className="gap-1 text-[10px]">
                              <Shield className="size-3" aria-hidden="true" />
                              Approval
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{step.user_action ?? '—'}</TableCell>
                      <TableCell className="text-sm">{step.system_action}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{step.decision ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{step.result ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div
            ref={(el) => {
              sectionRefs.current.tasks = el
            }}
            className="space-y-3 rounded-lg border border-border p-3"
          >
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              4. Tasks ({spec.tasks.length})
            </h4>

            {TASK_GROUPS.map((group) => {
              const groupTasks = tasksByCategory.get(group.key) ?? []
              if (groupTasks.length === 0) return null
              const Icon = group.icon
              return (
                <div key={group.key} className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                      {group.label} · {groupTasks.length}
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{group.blurb}</p>
                  <div className="space-y-1.5">
                    {groupTasks.map((task) => {
                      const published = publishedRefs.has(task.ref)
                      return (
                        <div key={task.ref} className="rounded-md border border-border p-2.5">
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={selectedRefs.has(task.ref)}
                              disabled={published}
                              onChange={(event) => {
                                setSelectedRefs((prev) => {
                                  const next = new Set(prev)
                                  if (event.target.checked) next.add(task.ref)
                                  else next.delete(task.ref)
                                  return next
                                })
                              }}
                            />
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-medium text-foreground">{task.title}</p>
                                <div className="flex items-center gap-1.5">
                                  <Badge variant={PRIORITY_VARIANT[task.priority]} className="text-[10px]">
                                    {task.priority}
                                  </Badge>
                                  <Badge variant="muted" className="text-[10px]">
                                    Due in {task.due_in_days}d
                                  </Badge>
                                  {published && (
                                    <Badge variant="success" className="gap-1 text-[10px]">
                                      <Check className="size-3" aria-hidden="true" />
                                      Published
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                KRA: {task.kra} · KPA: {task.kpa}
                              </p>
                              {task.observed && <p className="text-xs text-muted-foreground">Observed: {task.observed}</p>}
                              {!published && (
                                <div className="max-w-xs pt-1">
                                  <SearchableSelect
                                    options={candidates}
                                    value={assignments[task.ref] ?? ''}
                                    onChange={(value) => setAssignments((prev) => ({ ...prev, [task.ref]: value }))}
                                    placeholder="Assign to..."
                                    aria-label={`Assignee for ${task.title}`}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {spec.tasks.length === 0 && (
              <p className="text-sm text-muted-foreground">No tasks were derived from this procedure.</p>
            )}

            {saveError && <Notice tone="error">{saveError}</Notice>}
            {publishError && <Notice tone="error">{publishError}</Notice>}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <div className="text-xs text-muted-foreground">
                {savedProcessId ? (
                  <>
                    Stored as <span className="font-medium text-foreground">{name.trim() || spec.name}</span> · Status{' '}
                    <span className="font-medium text-foreground">Draft</span> · Workflow steps{' '}
                    <span className="font-medium text-foreground">{spec.steps.length}</span> · Task drafts{' '}
                    <span className="font-medium text-foreground">{spec.tasks.length}</span>
                  </>
                ) : (
                  'Saving records the process, its workflow and its task drafts. It does not raise any task.'
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={isSaving || !!savedProcessId} onClick={() => void saveProcess()}>
                  {isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
                  {savedProcessId ? 'Saved' : isSaving ? 'Saving...' : 'Save the process'}
                </Button>
                <Button
                  size="sm"
                  disabled={!savedProcessId || isPublishing || selectedRefs.size === 0}
                  onClick={() => void publishTasks()}
                >
                  {isPublishing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
                  {isPublishing ? 'Publishing...' : 'Assign and Publish'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
