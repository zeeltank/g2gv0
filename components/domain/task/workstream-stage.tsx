'use client'

/**
 * The right-hand pane: EITHER the lifecycle map OR one workstream.
 *
 * ── WHY A TOGGLE AND NOT AN EMPTY STATE ─────────────────────────────────────
 *
 * The obvious build is "show the diagram when nothing is selected". It reads
 * well in a sketch and fails in use: a pane's empty state is transient, so the
 * moment anyone clicks a workstream the diagram is gone and the way back is to
 * *deselect* — an affordance nobody discovers. It also demotes the diagram to
 * a placeholder, the thing you see before the real thing, which contradicts
 * what `workstream-lifecycle-map.tsx` is for: the structural claim that
 * governance spans the flow is the most load-bearing statement on the page.
 * And anyone arriving with a selection already made — the Timeline tab calls
 * `onOpen(id)` directly — would never see it at all.
 *
 * So Flow is a segment, permanently on screen and one click away, and it
 * happens to also be what shows when nothing is selected. The empty state and
 * the control agree instead of competing.
 *
 * ── AND WHY "MANAGE CONNECTIONS" IS HERE ────────────────────────────────────
 *
 * The connections editor used to be an always-open panel at the bottom of the
 * page — its Add button sat ~1,800px down, roughly 1,100px below the "New
 * workstream" button it is the second half of. Editing the graph belongs with
 * the picture of the graph, so it opens from the Flow header.
 */

import { useState } from 'react'
import { Link2, MoreVertical, Pencil, Trash2, Workflow } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { LifecycleConnections } from './workstream-form'
import { WorkstreamLifecycleMap } from './workstream-lifecycle-map'
import { WorkstreamDetailView } from './workstream-detail-view'
import type { WorkstreamLink, WorkstreamLinkType, WorkstreamSummary } from '@/types/task-management'

interface Props {
  workstreams: WorkstreamSummary[]
  links: WorkstreamLink[]
  selectedId: string | null
  projectMembers: Array<{ id: string; name: string }>
  message?: string
  saving: boolean
  linkError: string
  onSelect: (id: string) => void
  onShowMap: () => void
  onEdit: (ws: WorkstreamSummary) => void
  onDelete: (ws: WorkstreamSummary) => void
  onAddLink: (payload: {
    predecessor_workstream_id: string; successor_workstream_id: string
    link_type: WorkstreamLinkType; label?: string
  }) => void
  onRemoveLink: (id: string) => void
  onChanged: () => void
}

export function WorkstreamStage({
  workstreams, links, selectedId, projectMembers, message, saving, linkError,
  onSelect, onShowMap, onEdit, onDelete, onAddLink, onRemoveLink, onChanged,
}: Props) {
  const [connectionsOpen, setConnectionsOpen] = useState(false)
  const selected = workstreams.find((w) => w.id === selectedId) ?? null

  return (
    <section className="@container/stage flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div
          role="group"
          aria-label="Stage view"
          className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5"
        >
          <Segment active={selectedId === null} onClick={onShowMap}>
            <Workflow className="mr-1.5 size-3.5" /> Flow
          </Segment>
          {/* Disabled rather than hidden: a control that appears and vanishes
              teaches nothing about where the workstream went. */}
          <Segment
            active={selectedId !== null}
            disabled={selected === null}
            onClick={() => selected && onSelect(selected.id)}
          >
            {selected ? selected.name : 'Workstream'}
          </Segment>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {message && (
            <span role="status" className="text-xs text-success">{message}</span>
          )}

          {selectedId === null ? (
            <Button size="sm" variant="outline" onClick={() => setConnectionsOpen(true)}>
              <Link2 className="mr-1.5 size-3.5" /> Manage connections
            </Button>
          ) : selected && (
            /* Edit and Delete for the workstream itself — which did not exist
               anywhere on the workstream's own view before. modal={false}
               because these open a Dialog and a confirm; two modal Radix
               layers overlapping their teardowns is the documented
               frozen-screen bug. */
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${selected.name}`}>
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(selected)}>
                  <Pencil className="mr-2 size-3.5" /> Edit workstream
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => onDelete(selected)}>
                  <Trash2 className="mr-2 size-3.5" /> Delete workstream
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <div className="g2g-scrollbar min-h-0 flex-1 overflow-y-auto">
        {selectedId === null ? (
          <div className="p-4">
            <WorkstreamLifecycleMap
              workstreams={workstreams}
              links={links}
              onOpen={onSelect}
            />
          </div>
        ) : (
          <WorkstreamDetailView
            key={selectedId}
            workstreamId={selectedId}
            projectMembers={projectMembers}
            onOpenWorkstream={onSelect}
            onChanged={onChanged}
          />
        )}
      </div>

      <Sheet open={connectionsOpen} onOpenChange={setConnectionsOpen}>
        {/* The default sheet caps at sm:max-w-sm (384px) and the add row is a
            three-column grid — it would wrap into a stack. */}
        <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <SheetHeader className="shrink-0 border-b px-5 py-4 pr-12">
            <SheetTitle>Connections</SheetTitle>
          </SheetHeader>
          <div className="g2g-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <LifecycleConnections
              workstreams={workstreams}
              links={links}
              canManage
              saving={saving}
              error={linkError}
              onAdd={onAddLink}
              onRemove={onRemoveLink}
            />
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}

function Segment({
  active, disabled, onClick, children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 max-w-[16rem] items-center truncate rounded-md px-2.5 text-xs font-medium transition-colors',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-50 hover:text-muted-foreground',
      )}
    >
      {children}
    </button>
  )
}
