'use client'

import { useMemo, useRef, useState } from 'react'
import {
  Check,
  FileText,
  Loader2,
  Shield,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { SelectInput } from '../components'
import { Notice } from './signals-ui'
import { organizationService } from '@/services/organization'
import type { LaravelContext } from '@/lib/laravel-context'
import type {
  DepartmentProcessCategory,
  ProcessConversionSpec,
  ProcessConversionStep,
} from '@/services/organization'

/**
 * The K12-style left panel: paste a procedure, read it into structure, and
 * push the result onto the React Flow canvas on the right.
 *
 * Mirrors LMS K12's actual `add_process` screen (checked directly against
 * its source, not our denser in-house approximation of it under Platform
 * Services): a sticky step rail that scroll-jumps down one column of
 * stacked cards (Source → Process → Workflow → Tasks), and - the one piece
 * K12 shows that nothing in this codebase had yet - a dual "lane strip"
 * (one row per actor, a numbered chip wherever their step falls) above a
 * plain data table, for the Workflow section.
 *
 * This panel only ever reads text into a `ProcessConversionSpec` and hands
 * a plain step list up to the canvas builder via `onApply` - it does not
 * construct React Flow nodes/edges itself. The builder already owns node
 * styling, id generation, and the Tidy Layout auto-arrange, so applying a
 * conversion is just another way of adding steps, not a second code path
 * for building a graph.
 */

const SECTIONS = [
  { id: 'source', label: 'Source' },
  { id: 'process', label: 'Process' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'tasks', label: 'Tasks' },
]

export interface ConvertedStepForCanvas {
  title: string
  actor: string | null
  isApproval: boolean
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value || '—'}</dd>
    </div>
  )
}

/** One actor's row in the lane strip - a chip under every step column that actor owns. */
function LaneRow({ actor, steps }: { actor: string; steps: ProcessConversionStep[] }) {
  return (
    <>
      <div className="truncate pr-2 text-xs font-medium text-foreground">{actor}</div>
      {steps.map((step) => {
        const mine = (step.actor ?? 'Unassigned') === actor
        return (
          <div key={step.order} className="flex items-center justify-center py-0.5">
            {mine && (
              <span
                title={step.text}
                className={cn(
                  'relative flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white',
                  step.is_approval ? 'bg-warning' : 'bg-primary',
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
  context,
  categories,
  hasExistingSteps,
  onApply,
}: {
  context: LaravelContext
  categories: DepartmentProcessCategory[]
  /** Whether the canvas already has nodes - gates the replace confirmation. */
  hasExistingSteps: boolean
  onApply: (steps: ConvertedStepForCanvas[]) => void
}) {
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const [group, setGroup] = useState('')
  const [category, setCategory] = useState('')
  const [name, setName] = useState('')
  const [sourceText, setSourceText] = useState('')
  const [spec, setSpec] = useState<ProcessConversionSpec | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [error, setError] = useState('')
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false)

  const groups = useMemo(() => Array.from(new Set(categories.map((c) => c.group))), [categories])
  const categoryOptions = useMemo(
    () => categories.filter((c) => !group || c.group === group),
    [categories, group],
  )

  const actors = useMemo(() => {
    if (!spec) return []
    const seen: string[] = []
    for (const step of spec.steps) {
      const label = step.actor ?? 'Unassigned'
      if (!seen.includes(label)) seen.push(label)
    }
    return seen
  }, [spec])

  function jumpTo(id: string) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function convert() {
    if (!sourceText.trim()) {
      setError('Paste the procedure first.')
      return
    }
    setIsConverting(true)
    setError('')
    try {
      const response = await organizationService.convertDepartmentProcessSource(context, {
        name: name.trim() || undefined,
        source_text: sourceText,
      })
      setSpec(response.data?.spec ?? null)
      requestAnimationFrame(() => jumpTo('process'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That procedure could not be read.')
    } finally {
      setIsConverting(false)
    }
  }

  function applyNow() {
    if (!spec) return
    onApply(spec.steps.map((step) => ({ title: step.text, actor: step.actor, isApproval: step.is_approval })))
    setConfirmReplaceOpen(false)
  }

  function handleApplyClick() {
    if (!spec) return
    if (hasExistingSteps) {
      setConfirmReplaceOpen(true)
    } else {
      applyNow()
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-3 py-2 backdrop-blur">
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="size-3.5" aria-hidden="true" />
          Process Builder
        </p>
        <nav aria-label="Process builder steps" className="flex gap-1 overflow-x-auto">
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
      </div>

      <div className="g2g-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <div
          ref={(el) => {
            sectionRefs.current.source = el
          }}
          className="space-y-3 rounded-lg border border-border bg-card p-3"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">1. Source</h3>

          <div className="grid grid-cols-2 gap-2">
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
          </div>

          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Process name" />

          <Textarea
            rows={8}
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            placeholder={'1. Screen resumes (HR)\n2. Phone screening (HR)\n3. [approval] Approve the offer (Manager)\n4. Send offer letter (HR)'}
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted-foreground">
            Number the steps, add <code>(Role)</code> to name who does one, and tag a sign-off with{' '}
            <code>[approval]</code>.
          </p>

          {error && <Notice tone="error">{error}</Notice>}

          <Button size="sm" className="w-full justify-center" disabled={isConverting} onClick={() => void convert()}>
            {isConverting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileText className="size-4" aria-hidden="true" />
            )}
            {isConverting ? 'Reading...' : 'Convert to process'}
          </Button>
        </div>

        {spec && (
          <>
            <div
              ref={(el) => {
                sectionRefs.current.process = el
              }}
              className="space-y-3 rounded-lg border border-border bg-card p-3"
            >
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">2. Process</h3>
              <dl className="space-y-2">
                <Fact label="Objective" value={spec.objective} />
                <Fact label="Trigger" value={spec.trigger} />
                <Fact label="Completion" value={spec.completion} />
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
            </div>

            <div
              ref={(el) => {
                sectionRefs.current.workflow = el
              }}
              className="space-y-3 rounded-lg border border-border bg-card p-3"
            >
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">3. Workflow</h3>

              <div className="g2g-scrollbar overflow-x-auto pb-1">
                <div
                  className="inline-grid items-center gap-x-1"
                  style={{ gridTemplateColumns: `88px repeat(${spec.steps.length}, 28px)` }}
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

              <div className="max-h-56 overflow-y-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Step</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {spec.steps.map((step) => (
                      <TableRow key={step.order}>
                        <TableCell className="text-xs text-muted-foreground">{step.order}</TableCell>
                        <TableCell className="text-sm">{step.text}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{step.actor ?? '—'}</TableCell>
                        <TableCell>
                          {step.is_approval ? (
                            <Badge variant="warning" className="gap-1 text-[10px]">
                              <Shield className="size-3" aria-hidden="true" />
                              Approval
                            </Badge>
                          ) : (
                            <Badge variant="muted" className="text-[10px]">
                              Task
                            </Badge>
                          )}
                        </TableCell>
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
              className="space-y-3 rounded-lg border border-border bg-card p-3"
            >
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">4. Tasks</h3>

              <ul className="space-y-1.5">
                {spec.tasks.map((task) => (
                  <li
                    key={task.ref}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm"
                  >
                    <span className="min-w-0 truncate">{task.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{task.actor}</span>
                  </li>
                ))}
                {spec.tasks.length === 0 && (
                  <li className="text-sm text-muted-foreground">
                    No step names an actor, so nothing here would become a real task yet.
                  </li>
                )}
              </ul>
              {spec.steps.some((step) => !step.actor) && (
                <p className="text-[11px] text-warning">
                  Some steps have no actor - they will need an assignee set in the canvas after applying.
                </p>
              )}

              <Button
                className="w-full justify-center"
                disabled={spec.steps.length === 0}
                onClick={handleApplyClick}
              >
                <Check className="size-4" aria-hidden="true" />
                Apply to Canvas
              </Button>
              {spec.steps.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  No steps were read from that text, so there is nothing to apply yet.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <Dialog open={confirmReplaceOpen} onOpenChange={setConfirmReplaceOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Replace the current canvas?</DialogTitle>
            <DialogDescription>
              The canvas already has steps on it. Applying this conversion replaces them with the{' '}
              {spec?.steps.length ?? 0} step(s) just parsed - this can&apos;t be undone from here, though the
              version history can still recover whatever was last published.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReplaceOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={applyNow}>
              Replace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
