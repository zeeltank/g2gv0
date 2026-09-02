'use client'

/**
 * The project's identity, status and vitals in ONE band.
 *
 * ── WHAT THIS REPLACES, AND WHY ─────────────────────────────────────────────
 *
 * The page used to open with five stacked bordered surfaces — a `dl` slab of
 * eight fields plus department and regulatory chips, then four stat Cards —
 * spending ~450px (and ~600px below `md`) before the tab bar. Measured, that
 * chrome contained **zero interactive controls**: the slab and all four tiles
 * were non-clickable. It was 450px of reading material sitting between the
 * user and the thing they came to do.
 *
 * The vitals are now one inline row of figures, and the eight fields moved
 * behind a Details disclosure. Nothing was deleted — every field the slab
 * showed is still one click away, on every tab, including the tabs that never
 * had room for a rail.
 *
 * ── WHY THE FACTS ARE A DISCLOSURE AND NOT ALWAYS A RAIL ────────────────────
 *
 * The rail exists on Team / Tasks / Timeline. It cannot exist on the
 * Workstreams tab, because that tab's two columns are already the workstream
 * list and the workstream detail. Measured against the real shell (the app
 * sidebar is 260px expanded, the page has p-6), a third column leaves 352px of
 * detail at 1280px — unusable. So the facts live in a control that costs no
 * horizontal space and is present everywhere, and the rail is the convenience
 * on the tabs that can afford it.
 */

import { useState } from 'react'
import {
  AlertTriangle, ArrowLeft, Briefcase, ChevronDown, Layers, MoreVertical, Pencil, Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ProgressBar } from '@/components/ui/progress-bar'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { PriorityBadge } from './priority-badge'
import { projectStatusVariant } from './workstream-health'
import type { ProjectRecord } from '@/types/task-management'

interface RiskLoad { regulated: number; high: number; open: number }

export function ProjectCommandBar({
  project, workstreamCount, riskLoad, onBack, onEdit,
}: {
  project: ProjectRecord
  workstreamCount: number
  riskLoad: RiskLoad
  onBack: () => void
  onEdit?: () => void
}) {
  const [factsOpen, setFactsOpen] = useState(false)

  const riskTone = riskLoad.regulated > 0
    ? 'text-destructive'
    : riskLoad.high > 0 ? 'text-warning' : 'text-foreground'

  return (
    <div className="space-y-3">
      {/* ── identity ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
            <Briefcase className="size-6 shrink-0 text-primary" />
            {project.name}
            <span className="font-mono text-sm font-medium text-muted-foreground">{project.code}</span>
          </h1>
          {project.description && (
            <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <PriorityBadge priority={project.priority} />
          {/* variant passed explicitly — 'IN PROGRESS' is missing from the
              shared status map, so four statuses colour and one does not. */}
          <StatusBadge status={project.status} variant={projectStatusVariant(project.status)}>
            {project.status}
          </StatusBadge>
          {project.archived_at && <StatusBadge status="Archived" size="sm">Archived</StatusBadge>}

          {/* Wide: a popover that costs no layout. Narrow: the same content in
              a sheet, because a popover at 400px is a modal that lies. */}
          <div className="hidden xl:block">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  Details <ChevronDown className="ml-1.5 size-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[26rem]">
                <ProjectFacts project={project} />
              </PopoverContent>
            </Popover>
          </div>
          <Button variant="outline" size="sm" className="xl:hidden" onClick={() => setFactsOpen(true)}>
            Details <ChevronDown className="ml-1.5 size-3.5" />
          </Button>

          {/* modal={false} IS THE FIX FOR THE FROZEN SCREEN and is not
              cosmetic — this menu can open a Dialog, and two modal Radix
              layers overlapping their teardowns writes pointer-events:none
              back onto <body>. Same reason projects-list-view carries it. */}
          {onEdit && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Project actions">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 size-3.5" /> Edit project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1.5 size-3.5" /> Back
          </Button>
        </div>
      </div>

      {/* ── vitals: one row of figures, not four bordered tiles ──── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border bg-muted/30 px-3.5 py-2.5">
        <div className="flex min-w-[10rem] flex-1 items-center gap-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Progress
          </span>
          <ProgressBar value={project.progress} size="sm" className="min-w-[6rem] flex-1" />
          <span className="text-sm font-semibold tabular-nums text-foreground">{project.progress}%</span>
        </div>

        <Vital icon={Layers} label="Tasks">
          <span className="tabular-nums">{project.tasks_completed}</span>
          <span className="text-muted-foreground"> of </span>
          <span className="tabular-nums">{project.tasks_total}</span>
        </Vital>

        <Vital icon={Users} label="Workstreams">
          <span className="tabular-nums">{workstreamCount}</span>
        </Vital>

        <Vital icon={AlertTriangle} label="Open risks" tone={riskTone}>
          <span className="tabular-nums">{riskLoad.open}</span>
          {riskLoad.regulated > 0 && (
            <span className="ml-1.5 text-[11px] font-semibold uppercase tracking-wider">
              {riskLoad.regulated} regulated
            </span>
          )}
        </Vital>
      </div>

      <Sheet open={factsOpen} onOpenChange={setFactsOpen}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Project details</SheetTitle>
          </SheetHeader>
          <ProjectFacts project={project} />
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Vital({
  icon: Icon, label, tone, children,
}: {
  icon: React.ElementType
  label: string
  tone?: string
  children: React.ReactNode
}) {
  return (
    <span className="flex items-center gap-1.5 text-sm font-semibold">
      <Icon className={cn('size-3.5', tone ?? 'text-muted-foreground')} aria-hidden="true" />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={tone ?? 'text-foreground'}>{children}</span>
    </span>
  )
}

/**
 * Every field the old metadata slab showed, unchanged — it moved, it did not
 * shrink. Rendered into a popover on wide screens and a sheet on narrow ones.
 */
export function ProjectFacts({ project }: { project: ProjectRecord }) {
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Meta label="Manager" value={project.manager} />
        <Meta label="Sponsor" value={project.sponsor} />
        <Meta label="Timeline" value={`${project.start_date ?? '—'} → ${project.due_date ?? '—'}`} />
        <Meta label="Category" value={project.category} />
        <Meta label="Client" value={project.client_name} />
        <Meta label="Budget" value={project.budget_estimate ? Number(project.budget_estimate).toLocaleString() : null} />
        <Meta label="Team size" value={project.team_size} />
        <Meta label="Members" value={String(project.members_count)} />
      </dl>

      {/* Multi-department projects rendered as single-department in the
          drawer; the API has always returned the whole list. */}
      {(project.departments?.length ?? 0) > 0 && (
        <div className="border-t pt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Departments</p>
          <div className="flex flex-wrap gap-1.5">
            {project.departments!.map((d) => (
              <span key={d.id} className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs',
                d.is_primary ? 'border-primary/30 bg-primary/10 font-medium text-primary' : 'bg-muted/40',
              )}>
                {d.name ?? 'Unnamed'}{d.is_primary && ' · primary'}
              </span>
            ))}
          </div>
        </div>
      )}

      {project.regulatory_flags?.length > 0 && (
        <div className="border-t pt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Regulatory</p>
          <div className="flex flex-wrap gap-1.5">
            {project.regulatory_flags.map((flag) => (
              <span key={flag} className="rounded-full border border-warning/30 bg-warning/10 px-2.5 py-0.5 text-xs text-warning">
                {flag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums text-foreground">{value || '—'}</dd>
    </div>
  )
}
