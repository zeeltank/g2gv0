'use client'

/**
 * The workstream list — one column, and the ONLY list of workstreams.
 *
 * ── WHAT THIS REPLACES ──────────────────────────────────────────────────────
 *
 * The Workstreams tab used to render the same set twice: as stage cards inside
 * the lifecycle diagram (code, name, core question, health, owner, deliverable
 * and risk counts), and then again immediately below as a grid of tiles (name,
 * code, health, owner, reason, progress). A governance workstream appeared in
 * the diagram's band AND as a tile; an unconnected one appeared as a chip AND
 * as a tile. Four workstreams produced eight cards saying nearly the same
 * thing, ~400px apart.
 *
 * Now the diagram draws the structure and this draws the list. Neither repeats
 * the other.
 *
 * ── THE THING THAT WOULD OTHERWISE HAVE BEEN LOST ───────────────────────────
 *
 * `workstream-lifecycle-map.tsx` filters to `!w.parent_id`, so a sub-workstream
 * is deliberately not a stage. That meant the deleted tile grid was the ONLY
 * place in the product a child workstream was visible. This list indents them
 * under their parent so they stay reachable — and surfaces orphans (a child
 * whose parent is gone) rather than dropping them.
 *
 * ── ONE DOM INSTANCE, TWO SHAPES ────────────────────────────────────────────
 *
 * Below `@3xl` of page container the same markup flips to a horizontal snap
 * scroller instead of rendering a second component. Two components would drift;
 * a class flip cannot.
 */

import { Plus, Shield, Workflow } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { orderWorkstreams } from './workstream-order'
import { healthDot } from './workstream-health'
import type { WorkstreamHealthState, WorkstreamLink, WorkstreamSummary } from '@/types/task-management'

interface Props {
  workstreams: WorkstreamSummary[]
  links: WorkstreamLink[]
  /** null = the lifecycle map is showing. */
  selectedId: string | null
  onSelect: (id: string) => void
  onShowMap: () => void
  onNew?: () => void
}

export function WorkstreamListPane({
  workstreams, links, selectedId, onSelect, onShowMap, onNew,
}: Props) {
  const { stages, governance, unconnected, children, orphans } = orderWorkstreams(workstreams, links)

  const groups: Array<{ label: string | null; rows: WorkstreamSummary[] }> = [
    { label: null, rows: stages },
    { label: 'Not in the flow', rows: unconnected },
    { label: 'Governance', rows: governance },
    // Never silently dropped — a workstream you cannot see is a support
    // ticket about one that "disappeared".
    { label: 'Parent missing', rows: orphans },
  ].filter((g) => g.rows.length > 0)

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Workstreams
          <span className="ml-1.5 tabular-nums">{workstreams.length}</span>
        </span>
        {onNew && (
          <Button size="sm" variant="ghost" onClick={onNew}>
            <Plus className="mr-1 size-3.5" /> New
          </Button>
        )}
      </div>

      <div
        className={cn(
          // narrow: a horizontal snap rail above the stage
          'g2g-scrollbar flex shrink-0 snap-x gap-2 overflow-x-auto p-2',
          // wide: the vertical list column
          '@3xl/page:min-h-0 @3xl/page:flex-1 @3xl/page:snap-none @3xl/page:flex-col',
          '@3xl/page:gap-0 @3xl/page:overflow-x-hidden @3xl/page:overflow-y-auto @3xl/page:p-0',
        )}
      >
        {/* The map is a peer of the workstreams, permanently on screen — not
            an empty state you lose the moment you click something. */}
        <Row
          selected={selectedId === null}
          onClick={onShowMap}
          icon={<Workflow className="size-3.5 shrink-0 text-muted-foreground" />}
          title="Lifecycle map"
          meta={`${links.length} connection${links.length === 1 ? '' : 's'}`}
        />

        {groups.map((group) => (
          <div key={group.label ?? 'flow'} className="contents @3xl/page:block">
            {group.label && (
              <p className="hidden px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground @3xl/page:block">
                {group.label}
              </p>
            )}
            {group.rows.map((w) => (
              <div key={w.id} className="contents @3xl/page:block">
                <Row
                  selected={selectedId === w.id}
                  onClick={() => onSelect(w.id)}
                  icon={<HealthDot state={w.health.state} />}
                  title={w.name}
                  meta={[w.code, w.owner_name].filter(Boolean).join(' · ') || 'No owner'}
                  governance={w.kind === 'GOVERNANCE'}
                />
                {(children.get(w.id) ?? []).map((child) => (
                  <Row
                    key={child.id}
                    selected={selectedId === child.id}
                    onClick={() => onSelect(child.id)}
                    icon={<HealthDot state={child.health.state} />}
                    title={child.name}
                    meta={[child.code, child.owner_name].filter(Boolean).join(' · ') || 'No owner'}
                    nested
                  />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function Row({
  selected, onClick, icon, title, meta, nested, governance,
}: {
  selected: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  meta: string
  nested?: boolean
  governance?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        // narrow: a fixed-width snap card
        'w-44 shrink-0 snap-start rounded-lg border border-border p-2 text-left',
        // wide: a flush row with a selection rail on the left edge
        '@3xl/page:w-auto @3xl/page:shrink @3xl/page:rounded-none @3xl/page:border-0',
        '@3xl/page:border-b @3xl/page:border-l-2 @3xl/page:border-b-border @3xl/page:px-3 @3xl/page:py-2',
        'outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40',
        selected
          ? 'border-primary bg-primary/5 @3xl/page:border-l-primary'
          : 'hover:bg-muted/50 @3xl/page:border-l-transparent',
        nested && '@3xl/page:pl-7',
      )}
    >
      <span className="flex items-start gap-2">
        <span className="mt-0.5 flex shrink-0 items-center gap-1">
          {icon}
          {governance && <Shield className="size-3 text-muted-foreground" aria-label="Governance layer" />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium leading-tight text-foreground">{title}</span>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{meta}</span>
        </span>
      </span>
    </button>
  )
}

/**
 * A dot, not a badge.
 *
 * `WorkstreamHealthBadge` is a pill with a word in it — at a 240px row it
 * either wraps or eats the name. The state still reaches a screen reader
 * through the `sr-only` text, so nothing is encoded in colour alone.
 */
function HealthDot({ state }: { state: WorkstreamHealthState }) {
  return (
    <span className="flex items-center">
      <span className={cn('size-2 shrink-0 rounded-full', healthDot(state))} aria-hidden="true" />
      <span className="sr-only">{state}</span>
    </span>
  )
}
