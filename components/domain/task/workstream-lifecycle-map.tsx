'use client'

/**
 * The 360° lifecycle, drawn FROM THE LINKS TABLE.
 *
 * ── WHY THIS IS NOT A PICTURE ───────────────────────────────────────────────
 *
 * Every node, every edge and every caption here comes from data. Nothing about
 * the customer's WS01 → WS02 → WS04 shape is hardcoded. Draw it in JSX and it
 * disagrees with the database the first time anyone edits anything — and a
 * diagram that quietly disagrees with the record is worse than no diagram,
 * because people trust pictures.
 *
 * The corollary matters as much: when a project does NOT form this shape — no
 * links yet, seven workstreams, two governance streams — this renders what is
 * actually there rather than forcing the model onto it.
 *
 * ── WHY NOT REACT FLOW ──────────────────────────────────────────────────────
 *
 * `@xyflow/react` is already a dependency (the dependency map uses it) and would
 * be less code. It is deliberately not used: React Flow nodes are draggable, and
 * the whole claim this diagram makes is structural — that governance spans the
 * flow rather than sitting inside it. A user who can drag the governance band
 * into the middle of the chain has been handed a way to make the picture lie.
 *
 * ── HOW THE BAND WORKS ──────────────────────────────────────────────────────
 *
 * The delivery stages are rows in a CSS grid. A GOVERNANCE workstream occupies
 * its own column with `gridRow: 1 / -1`, so it stretches to exactly the height
 * of however many stages there are — no pixel maths, no ResizeObserver, and
 * structurally impossible to render as a stage.
 */

import { useMemo } from 'react'
import { ArrowDown, RotateCcw, Shield } from 'lucide-react'

import { categoricalColor } from '@/lib/chart-colors'
import { cn } from '@/lib/utils'
import { WorkstreamHealthBadge } from './workstream-health'
import type { WorkstreamLink, WorkstreamSummary } from '@/types/task-management'

interface Props {
  workstreams: WorkstreamSummary[]
  links: WorkstreamLink[]
  onOpen?: (id: string) => void
  compact?: boolean
}

export function WorkstreamLifecycleMap({ workstreams, links, onOpen, compact }: Props) {
  const { stages, governance, flow, feedback, governs, orderedIds, unconnected } = useMemo(() => {
    const delivery = workstreams.filter((w) => w.kind === 'DELIVERY' && !w.parent_id)
    const governance = workstreams.filter((w) => w.kind === 'GOVERNANCE' && !w.parent_id)

    const flow = links.filter((l) => l.link_type === 'FLOW')
    const feedback = links.filter((l) => l.link_type === 'FEEDBACK')
    const governs = links.filter((l) => l.link_type === 'GOVERNS')

    /*
     * Stage order comes from the FLOW edges, not from sort_order — the graph is
     * the authority. A topological walk from whatever has no predecessor;
     * anything the walk does not reach keeps its sort_order position at the end,
     * so a project with no links at all still renders a sensible list.
     */
    const byId = new Map(delivery.map((w) => [w.id, w]))
    const hasPredecessor = new Set(flow.map((l) => l.to_id))
    const next = new Map<string, string>(flow.map((l) => [l.from_id, l.to_id]))

    const ordered: WorkstreamSummary[] = []
    const seen = new Set<string>()

    for (const start of delivery.filter((w) => !hasPredecessor.has(w.id))) {
      let cursor: string | undefined = start.id
      while (cursor && byId.has(cursor) && !seen.has(cursor)) {
        seen.add(cursor)
        ordered.push(byId.get(cursor)!)
        cursor = next.get(cursor)
      }
    }

    const unconnected = delivery.filter((w) => !seen.has(w.id))

    return {
      stages: ordered,
      governance,
      flow,
      feedback,
      governs,
      // Colour is keyed on a NAME-SORTED list so filtering or reordering never
      // repaints a workstream — colour follows the entity, not its position.
      orderedIds: [...workstreams].sort((a, b) => a.name.localeCompare(b.name)).map((w) => w.id),
      unconnected,
    }
  }, [workstreams, links])

  if (workstreams.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No workstreams yet. Add one to start building the delivery flow.
      </div>
    )
  }

  const label = (from: string, to: string, type: string) =>
    links.find((l) => l.from_id === from && l.to_id === to && l.link_type === type)?.label ?? null

  const feedbackEdge = feedback[0] ?? null

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'grid gap-4',
          governance.length > 0 ? 'lg:grid-cols-[minmax(0,1fr)_16rem]' : 'grid-cols-1',
        )}
      >
        {/* ── the delivery spine ───────────────────────────────────── */}
        <div className="grid gap-0" style={{ gridTemplateRows: `repeat(${Math.max(stages.length, 1)}, auto)` }}>
          {stages.map((ws, index) => {
            const colour = categoricalColor(ws.id, orderedIds)
            const edgeLabel = index < stages.length - 1 ? label(ws.id, stages[index + 1]?.id ?? '', 'FLOW') : null

            return (
              <div key={ws.id}>
                <StageCard ws={ws} colour={colour} onOpen={onOpen} compact={compact} />

                {index < stages.length - 1 && (
                  <div className="flex items-center justify-center gap-2 py-2" aria-hidden="true">
                    <ArrowDown className="size-4 text-muted-foreground" />
                    {/* The caption is the model's own words, from the link row. */}
                    {edgeLabel && (
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {edgeLabel}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {stages.length === 0 && unconnected.length === 0 && (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No delivery workstreams yet.
            </p>
          )}
        </div>

        {/* ── the governance band ──────────────────────────────────────
            gridRow 1/-1 is what makes this structurally a band rather than a
            stage: it spans every delivery row, whatever their number. */}
        {governance.map((ws) => (
          <div key={ws.id} style={{ gridRow: '1 / -1' }} className="min-h-full">
            <button
              type="button"
              onClick={onOpen ? () => onOpen(ws.id) : undefined}
              className={cn(
                'flex h-full w-full flex-col gap-3 rounded-xl border-2 border-dashed p-4 text-left transition',
                // NEUTRAL, not a categorical hue. A governance workstream is not
                // a peer of the delivery stages, and giving it slot 3 of the
                // identity palette would say that it is.
                'border-muted-foreground/30 bg-muted/30',
                onOpen && 'hover:border-muted-foreground/50 hover:bg-muted/50',
              )}
            >
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-muted-foreground" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Governance
                </span>
              </div>
              <div>
                {ws.code && <p className="text-xs font-mono text-muted-foreground">{ws.code}</p>}
                <p className="font-semibold leading-tight">{ws.name}</p>
              </div>
              {ws.core_question && <p className="text-xs italic text-muted-foreground">{ws.core_question}</p>}
              <WorkstreamHealthBadge state={ws.health.state} className="self-start" />

              {/* What it governs, captioned from the GOVERNS link rows. */}
              <div className="mt-auto space-y-1 border-t pt-3">
                {governs
                  .filter((l) => l.from_id === ws.id)
                  .map((l) => {
                    const target = workstreams.find((w) => w.id === l.to_id)
                    return (
                      <p key={l.id} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{l.label ?? 'Governs'}</span>
                        {target ? ` · ${target.code ?? target.name}` : ''}
                      </p>
                    )
                  })}
                {governs.filter((l) => l.from_id === ws.id).length === 0 && (
                  <p className="text-xs text-muted-foreground">Not yet linked to any workstream.</p>
                )}
              </div>
            </button>
          </div>
        ))}
      </div>

      {/* ── the feedback loop ────────────────────────────────────────
          Rendered as a distinct returning edge, never as another stage: it is
          what makes the model a cycle rather than a pipeline. */}
      {feedbackEdge && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2">
          <RotateCcw className="size-4 shrink-0 text-primary" />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-primary">{feedbackEdge.label ?? 'Feedback'}</span>
            {' — '}
            {workstreams.find((w) => w.id === feedbackEdge.from_id)?.name ?? 'a later workstream'}
            {' feeds back into '}
            {workstreams.find((w) => w.id === feedbackEdge.to_id)?.name ?? 'the first'}
            {', closing the loop.'}
          </p>
        </div>
      )}

      {/* Workstreams the flow does not reach. Named rather than hidden — an
          absent card reads as an absent workstream. */}
      {unconnected.length > 0 && (
        <div className="rounded-lg border border-dashed p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Not in the delivery flow
          </p>
          <div className="flex flex-wrap gap-2">
            {unconnected.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={onOpen ? () => onOpen(ws.id) : undefined}
                className="rounded-full border bg-background px-3 py-1 text-xs hover:border-primary/40"
              >
                {ws.code ? `${ws.code} · ` : ''}{ws.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Link these to a stage to place them in the flow.
          </p>
        </div>
      )}

      {/* A textual reading of the same graph. The diagram is layout; this is the
          part a screen reader and a printout can both use. */}
      {links.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium">How these connect</summary>
          <ul className="mt-2 space-y-1 pl-4">
            {links.map((l) => {
              const from = workstreams.find((w) => w.id === l.from_id)
              const to = workstreams.find((w) => w.id === l.to_id)
              const verb = l.link_type === 'GOVERNS' ? 'governs' : l.link_type === 'FEEDBACK' ? 'feeds back into' : 'feeds'
              return (
                <li key={l.id}>
                  {from?.name ?? 'Unknown'} {verb} {to?.name ?? 'Unknown'}
                  {l.label ? ` (${l.label})` : ''}
                </li>
              )
            })}
          </ul>
        </details>
      )}
    </div>
  )
}

function StageCard({
  ws, colour, onOpen, compact,
}: {
  ws: WorkstreamSummary
  colour: string | null
  onOpen?: (id: string) => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onOpen ? () => onOpen(ws.id) : undefined}
      className={cn(
        'relative w-full overflow-hidden rounded-xl border bg-card p-4 pl-5 text-left transition',
        onOpen && 'hover:border-primary/40 hover:shadow-sm',
      )}
    >
      {/* The identity rail. Null past the palette's five slots — a sixth
          workstream renders with no rail rather than repeating a hue, because a
          repeated colour reads as a claim that two things are the same. */}
      {colour && <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: colour }} aria-hidden="true" />}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {ws.code && <p className="font-mono text-xs text-muted-foreground">{ws.code}</p>}
          <p className="font-semibold leading-tight">{ws.name}</p>
          {ws.core_question && <p className="mt-0.5 text-xs italic text-muted-foreground">{ws.core_question}</p>}
        </div>
        <WorkstreamHealthBadge state={ws.health.state} />
      </div>

      {!compact && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{ws.owner_name ?? 'No owner'}</span>
          {ws.health.deliverables.total > 0 && (
            <span>{ws.health.deliverables.done} of {ws.health.deliverables.total} deliverables</span>
          )}
          {ws.health.risks.open > 0 && (
            <span className={ws.health.risks.regulated_open > 0 ? 'text-danger' : undefined}>
              {ws.health.risks.open} open {ws.health.risks.open === 1 ? 'risk' : 'risks'}
            </span>
          )}
          {ws.children_count > 0 && <span>{ws.children_count} sub-workstream{ws.children_count === 1 ? '' : 's'}</span>}
        </div>
      )}
    </button>
  )
}
