'use client'

/**
 * Opportunity pipeline board. Same hand-rolled HTML5 drag-and-drop mechanics
 * as Recruitment's `candidate-kanban.tsx` (no DnD library anywhere in this
 * repo) - a fresh, opportunity-typed pair of components rather than a
 * literal import, since that file's CandidateCard/KanbanColumn are typed
 * directly to `Candidate`, not generic. `text/crm-opportunity-id` is a
 * distinct dataTransfer key so a drag can never be misread by the other
 * board on an unrelated page.
 *
 * Stage columns are picklist-driven (crm_picklist_values, module=
 * 'opportunities', field_key='sales_stage') via the pipeline endpoint, not
 * a hardcoded array - an admin can add/reorder/recolor stages from the
 * existing Picklist Admin screen and this board picks it up automatically.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { cn } from '@/lib/utils'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmOpportunity, CrmOpportunityPipelineResponse } from '@/types/crm'

type PipelineStage = CrmOpportunityPipelineResponse['data']['stages'][number]

const STAGE_DOT_CLASS: Record<string, string> = {
  success: 'bg-success', warning: 'bg-warning', destructive: 'bg-destructive',
  primary: 'bg-primary', muted: 'bg-muted-foreground/40',
}

function formatAmount(amount: number | null, currency: string | null): string | null {
  if (amount === null) return null
  return `${currency ?? ''} ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`.trim()
}

function OpportunityCard({ opportunity, busy, onClick }: { opportunity: CrmOpportunity; busy: boolean; onClick: () => void }) {
  return (
    <div
      draggable={!busy}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/crm-opportunity-id', opportunity.id)
      }}
      onClick={onClick}
      className={cn(
        'group flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3 shadow-sm transition-all duration-200',
        busy ? 'cursor-wait opacity-60' : 'cursor-pointer hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5',
      )}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="truncate text-sm font-semibold text-foreground">{opportunity.name}</span>
        <span className="truncate text-xs text-muted-foreground">{opportunity.organizationName || 'No organization'}</span>
      </div>
      {opportunity.amount !== null && (
        <span className="text-[11px] font-medium text-foreground">{formatAmount(opportunity.amount, opportunity.currency)}</span>
      )}
    </div>
  )
}

function KanbanColumn({ stage, opportunities, movingId, onCardClick, onMove }: {
  stage: PipelineStage
  opportunities: CrmOpportunity[]
  movingId: string | null
  onCardClick: (opportunity: CrmOpportunity) => void
  onMove: (opportunityId: string, stage: string) => void
}) {
  return (
    <div
      className="flex min-w-[220px] w-[220px] shrink-0 flex-col"
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }}
      onDrop={(event) => {
        event.preventDefault()
        const opportunityId = event.dataTransfer.getData('text/crm-opportunity-id')
        if (opportunityId) onMove(opportunityId, stage.stage)
      }}
    >
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className={cn('size-2 rounded-full', STAGE_DOT_CLASS[stage.color ?? ''] ?? 'bg-muted-foreground/40')} aria-hidden="true" />
        <span className="text-sm font-semibold text-foreground">{stage.label}</span>
        <span className="ml-auto text-xs font-bold tabular-nums text-muted-foreground">{opportunities.length}</span>
      </div>
      <div className="scrollbar-thin flex max-h-[520px] flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {opportunities.map((opportunity) => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={opportunity}
            busy={movingId === opportunity.id}
            onClick={() => onCardClick(opportunity)}
          />
        ))}
        {opportunities.length === 0 && (
          <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
            No opportunities
          </div>
        )}
      </div>
    </div>
  )
}

export function OpportunityKanbanView() {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])

  const [stages, setStages] = useState<PipelineStage[]>([])
  const [opportunities, setOpportunities] = useState<CrmOpportunity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [movingId, setMovingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    try {
      const [pipelineResponse, listResponse] = await Promise.all([
        crmService.getOpportunityPipeline(context),
        crmService.getOpportunities(context, { perPage: 200, sortBy: 'created_at', sortDir: 'desc' }),
      ])
      setStages(pipelineResponse.data.stages)
      setOpportunities(listResponse.data.items)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load the pipeline.')
    } finally {
      setIsLoading(false)
    }
  }, [context])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  const byStage = useMemo(() => {
    const map: Record<string, CrmOpportunity[]> = {}
    for (const stage of stages) map[stage.stage] = []
    for (const opportunity of opportunities) {
      const key = opportunity.salesStage ?? ''
      if (!map[key]) map[key] = []
      map[key].push(opportunity)
    }
    return map
  }, [stages, opportunities])

  /**
   * A safety net, not a real column an admin configured: new Opportunities
   * are seeded with a real stage by the create form, but a stage-less row
   * can still exist (a CSV import row that skipped it, direct API/import
   * use, or the picklist fetch simply not having resolved yet when someone
   * raced the create form). Every known real stage key is already in
   * `byStage` from the loop above, so anything left over here has no real
   * column to land in - shown explicitly rather than silently vanishing
   * from the board the way it did before this was added.
   */
  const unstaged = useMemo(
    () => opportunities.filter((o) => !o.salesStage || !stages.some((s) => s.stage === o.salesStage)),
    [opportunities, stages],
  )

  const openOpportunity = (opportunity: CrmOpportunity) => {
    router.push(resolveAccessLink('/module/crm/sales/opportunities') + `/${opportunity.id}`)
  }

  const moveOpportunity = async (opportunityId: string, stage: string) => {
    const current = opportunities.find((o) => o.id === opportunityId)
    if (!current || current.salesStage === stage || movingId) return

    setMovingId(opportunityId)
    // Optimistic - the board feels instant, and a failure below reverts it.
    setOpportunities((prev) => prev.map((o) => (o.id === opportunityId ? { ...o, salesStage: stage } : o)))

    try {
      await crmService.changeOpportunityStage(context, opportunityId, { salesStage: stage })
      void load()
    } catch (reason) {
      setOpportunities((prev) => prev.map((o) => (o.id === opportunityId ? { ...o, salesStage: current.salesStage } : o)))
      setError(reason instanceof Error ? reason.message : 'Unable to move that opportunity.')
    } finally {
      setMovingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading pipeline…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      <div className="overflow-x-auto pb-4">
        <div className="flex min-w-max gap-4">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.stage}
              stage={stage}
              opportunities={byStage[stage.stage] ?? []}
              movingId={movingId}
              onCardClick={openOpportunity}
              onMove={(id, newStage) => void moveOpportunity(id, newStage)}
            />
          ))}
          {unstaged.length > 0 && (
            <KanbanColumn
              stage={{ stage: '', label: 'No Stage', color: 'muted', count: unstaged.length, totalAmount: 0 }}
              opportunities={unstaged}
              movingId={movingId}
              onCardClick={openOpportunity}
              onMove={() => { /* not a real stage - nothing to drag a card into here */ }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
