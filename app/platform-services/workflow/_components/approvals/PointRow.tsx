'use client'

/**
 * One approval of a module ("Leave approval, in HRMS"): its name, whether a flow is on, and, opened, the flows set on it with their steps in one sentence.
 *
 * The product has a place for an approval whether or not anything reads it yet, and a list of only the configured ones could not show an absence. So every approval
 * is listed, most of them with no flow, and the gap is the finding rather than the filler (`pointCoverage`).
 */

import { useId } from 'react'
import { ChevronDown, ChevronRight, History, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { WorkflowChain, WorkflowPoint, WorkflowVersion } from '@/lib/platform/workflow'
import { flowNote, flowSentence, pointCoverage } from '@/lib/platform/workflow-approvals'

import { CoverageChip, FlowStatusChip, Notice } from './parts'

export interface HistoryState {
  flowId: number
  versions: WorkflowVersion[] | null
  loading: boolean
  error: string | null
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'Date unknown'
  const date = new Date(iso)

  return Number.isNaN(date.getTime()) ? 'Date unknown' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function PointRow({
  point,
  moduleLabel,
  expanded,
  history,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
  onHistory,
}: {
  point: WorkflowPoint
  moduleLabel: string
  expanded: boolean
  history: HistoryState | null
  onToggle: () => void
  onAdd: () => void
  onEdit: (flow: WorkflowChain) => void
  onDelete: (flow: WorkflowChain) => void
  onHistory: (flow: WorkflowChain) => void
}) {
  const panelId = useId()
  const coverage = pointCoverage(point)
  const Chevron = expanded ? ChevronDown : ChevronRight

  return (
    <article className="rounded-lg border border-border bg-card" data-approval={point.key}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <h3 className="min-w-0 flex-1 basis-56">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={panelId}
            className="flex w-full min-h-8 touch-manipulation items-start gap-2 rounded-md text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Chevron className="mt-0.5 size-4 flex-none text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block break-words text-sm font-medium text-card-foreground">{point.label}</span>
              <span className="block break-words text-xs text-muted-foreground">Approval in {moduleLabel}</span>
            </span>
          </button>
        </h3>

        <CoverageChip coverage={coverage} />

        <Button type="button" variant="outline" size="sm" onClick={onAdd} aria-label={`Add approval flow to ${point.label}`}>
          <Plus aria-hidden="true" />
          Add approval flow
        </Button>
      </div>

      {expanded && (
        <div id={panelId} className="space-y-3 border-t border-border bg-muted px-4 py-3">
          <p className="break-words text-sm text-muted-foreground">{point.description}</p>

          {!point.enforced ? (
            // The honest sentence for an approval the product does not use yet: a flow saved here is a plan, and it cannot be turned on.
            <p className="text-sm text-muted-foreground">
              Nothing in the product waits for a sign-off on {point.subject.toLowerCase()}s yet. A flow saved here is only a plan: it can be kept as a draft, and it starts to
              work when the product starts using this approval.
            </p>
          ) : point.workflows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody signs off {point.subject.toLowerCase()}s here yet. They go ahead without approval.</p>
          ) : (
            <p className="text-xs text-muted-foreground">A change to a flow only applies to new requests. Ones already waiting for a decision keep the flow they started with.</p>
          )}

          {point.workflows.length > 0 && (
            <ul className="space-y-2">
              {point.workflows.map((flow) => {
                const note = flowNote(flow)
                const showing = history?.flowId === flow.id

                return (
                  <li key={flow.id} data-flow={flow.id} className="rounded-lg border border-border bg-card px-3 py-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 basis-56">
                        <p className="break-words text-sm font-medium text-card-foreground">{flow.name}</p>
                        <p className="mt-0.5 break-words text-xs text-muted-foreground">{flowSentence(flow)}</p>
                        {note && <p className="mt-1 break-words text-xs text-muted-foreground">{note}</p>}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <FlowStatusChip status={flow.status} />
                        <Button type="button" variant="outline" size="sm" onClick={() => onHistory(flow)} aria-expanded={showing} aria-label={`History of ${flow.name}`}>
                          <History aria-hidden="true" />
                          History
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => onEdit(flow)} aria-label={`Edit ${flow.name}`}>
                          <Pencil aria-hidden="true" />
                          Edit
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => onDelete(flow)} aria-label={`Delete ${flow.name}`}>
                          <Trash2 aria-hidden="true" />
                          Delete
                        </Button>
                      </div>
                    </div>

                    {showing && history && (
                      <div className="mt-2 rounded-lg border border-border bg-muted p-3">
                        {history.loading && (
                          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                            Loading history…
                          </p>
                        )}
                        {history.error && <Notice tone="error">{history.error}</Notice>}
                        {history.versions && history.versions.length === 0 && <p className="text-sm text-muted-foreground">No changes have been recorded for this flow.</p>}
                        {history.versions && history.versions.length > 0 && (
                          <ul className="space-y-2" aria-label={`Changes to ${flow.name}`}>
                            {history.versions.map((version) => (
                              <li key={version.id} className="text-sm">
                                <span className="block break-words text-xs text-muted-foreground">
                                  {formatWhen(version.created_at)}
                                  {version.changed_by && `, ${version.changed_by}`}
                                </span>
                                <span className="block break-words text-foreground">{version.summary}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </article>
  )
}
