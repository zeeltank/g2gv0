'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Bot,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LayoutGrid,
  Lock,
  Plus,
  Search,
  Table as TableIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useAgentDetail, useAgentMeta, useAgents } from '@/hooks/use-agentic'
import type { Agent, AgentStatus } from '@/services/agentic'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { AG_CREATE_AGENT_ACCESS_LINK } from '@/lib/gtg-navigation'

import { AgentDetail } from './agent-detail'
import {
  AgentStatusBadge,
  ToolChip,
  dash,
  formatDateTime,
  formatNumber,
  formatRate,
} from './shared'

const ALL = 'all'

const STATUS_OPTIONS = [
  { label: 'All Statuses', value: ALL },
  { label: 'Deployed', value: 'deployed' },
  { label: 'Draft', value: 'draft' },
  { label: 'Paused', value: 'paused' },
  { label: 'Archived', value: 'archived' },
]

/**
 * The library holds two kinds of agent, and conflating them is confusing: the
 * platform catalogue is shared and read-only, tenant agents are yours.
 */
const ORIGIN_TABS: { label: string; value: string; hint: string }[] = [
  { label: 'All Agents', value: ALL, hint: 'Everything available to you' },
  { label: 'Platform', value: 'platform', hint: 'Shared capability catalogue' },
  { label: 'My Agents', value: 'tenant', hint: 'Created by your organisation' },
]

const SORT_OPTIONS = [
  { label: 'Sort: Newest', value: 'created_at' },
  { label: 'Sort: Name', value: 'name' },
  { label: 'Sort: Status', value: 'status' },
  { label: 'Sort: Module', value: 'module' },
]

function pageWindow(current: number, last: number): (number | 'gap')[] {
  if (last <= 7) return Array.from({ length: last }, (_, index) => index + 1)
  const pages: (number | 'gap')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(last - 1, current + 1)
  if (start > 2) pages.push('gap')
  for (let page = start; page <= end; page++) pages.push(page)
  if (end < last - 1) pages.push('gap')
  pages.push(last)
  return pages
}

/**
 * Agent Library — the catalogue of what this organisation's AI can do.
 *
 * The screen this replaces rendered thirteen agents hardcoded in the bundle
 * plus whatever a public endpoint returned, so the catalogue was the same for
 * every customer and could not be curated. These are the tenant's own agents.
 */
export function AgAgentLibrary() {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(ALL)
  const [origin, setOrigin] = useState(ALL)
  const [moduleFilter, setModuleFilter] = useState(ALL)
  const [toolFilter, setToolFilter] = useState(ALL)
  const [sort, setSort] = useState('created_at')
  const [page, setPage] = useState(1)
  const [view, setView] = useState<'grid' | 'table'>('grid')

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const params = useMemo(
    () => ({
      ...(search ? { search } : {}),
      ...(status !== ALL ? { status } : {}),
      ...(origin !== ALL ? { origin } : {}),
      ...(moduleFilter !== ALL ? { module: moduleFilter } : {}),
      ...(toolFilter !== ALL ? { tool: toolFilter } : {}),
      sort: sort as 'created_at' | 'name' | 'status' | 'module',
      direction: (sort === 'created_at' ? 'desc' : 'asc') as 'asc' | 'desc',
      page,
      per_page: 12,
    }),
    [search, status, origin, moduleFilter, toolFilter, sort, page],
  )

  const {
    agents, pagination, loading, error, saving,
    actionMessage, actionError, retry, clearMessages,
    setStatus: setAgentStatus, clone, remove,
  } = useAgents(params)

  const { meta } = useAgentMeta()

  const [selected, setSelected] = useState<Agent | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null)
  const { detail, loading: detailLoading, refresh } = useAgentDetail(selected?.id ?? null)

  // The list reloads after every mutation, so the open panel must re-read from
  // it or it would show the agent as it was before the change.
  const selectedLive = selected ? agents.find((agent) => agent.id === selected.id) ?? selected : null

  const moduleOptions = useMemo(
    () => [
      { label: 'All Modules', value: ALL },
      ...meta.modules.map((value) => ({ label: value, value })),
    ],
    [meta.modules],
  )

  const toolOptions = useMemo(
    () => [
      { label: 'All Tools', value: ALL },
      ...meta.tools.map((tool) => ({ label: tool.label, value: tool.id })),
    ],
    [meta.tools],
  )

  const hasFilters =
    Boolean(search) || status !== ALL || origin !== ALL || moduleFilter !== ALL || toolFilter !== ALL

  const clearAll = () => {
    setSearchInput('')
    setSearch('')
    setStatus(ALL)
    setOrigin(ALL)
    setModuleFilter(ALL)
    setToolFilter(ALL)
    setPage(1)
  }

  /**
   * Follows a catalogue agent's call to action. External links open a tab;
   * internal ones route in-app so the shell keeps its state.
   */
  const followCta = (agent: Agent) => {
    if (!agent.cta_link) return
    if (agent.cta_target === 'external' || /^https?:\/\//i.test(agent.cta_link)) {
      window.open(agent.cta_link, '_blank', 'noopener,noreferrer')
      return
    }
    router.push(agent.cta_link)
  }

  const goCreate = (agentId?: number) => {
    const path = resolveAccessLink(AG_CREATE_AGENT_ACCESS_LINK)
    router.push(agentId ? `${path}?edit=${agentId}` : path)
  }

  const total = pagination?.total ?? 0
  const lastPage = pagination?.last_page ?? 1

  if (pagination && page > pagination.last_page) {
    setPage(pagination.last_page)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const result = await remove(deleteTarget.id)
    if (result.ok) {
      setDeleteTarget(null)
      setSelected(null)
    }
  }

  return (
    <div className="g2g-scrollbar flex h-full flex-col gap-6 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Agent Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every AI agent deployed across your organisation, and what each one is allowed to do.
          </p>
        </div>
        <Button onClick={() => goCreate()} className="h-10 gap-2 rounded-xl px-4 font-bold shadow-md shadow-primary/20">
          <Plus className="h-4 w-4 stroke-[3]" /> Create Agent
        </Button>
      </div>

      {/* Counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Available', value: meta.counts.total, active: origin === ALL && status === ALL, apply: () => { setOrigin(ALL); setStatus(ALL) } },
          { label: 'Platform', value: meta.counts.platform, active: origin === 'platform', apply: () => { setOrigin('platform'); setStatus(ALL) } },
          { label: 'My Agents', value: meta.counts.tenant, active: origin === 'tenant', apply: () => { setOrigin('tenant'); setStatus(ALL) } },
          { label: 'Deployed', value: meta.counts.deployed, active: status === 'deployed', apply: () => setStatus('deployed') },
        ].map((tile) => (
          <button
            key={tile.label}
            type="button"
            onClick={() => {
              tile.apply()
              setPage(1)
            }}
            className={cn(
              'rounded-2xl border bg-card/60 px-4 py-3 text-left shadow-sm backdrop-blur-xl transition-colors',
              tile.active ? 'border-primary/50 bg-primary/5' : 'border-primary/10 hover:bg-accent/40',
            )}
          >
            <p className="text-xl font-bold tabular-nums text-foreground">{tile.value}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tile.label}</p>
          </button>
        ))}
      </div>

      {/* Origin tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border" role="tablist" aria-label="Agent source">
        {ORIGIN_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={origin === tab.value}
            title={tab.hint}
            onClick={() => {
              setOrigin(tab.value)
              setPage(1)
            }}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
              origin === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="relative z-20 flex flex-col gap-4 rounded-2xl border border-primary/10 bg-card/50 p-4 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[240px] max-w-lg flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search agents by name, description or module…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-10 w-full rounded-xl border-input bg-background/50 pl-9 text-sm"
              aria-label="Search agents"
            />
          </div>

          <div className="flex overflow-hidden rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setView('grid')}
              aria-pressed={view === 'grid'}
              aria-label="Card view"
              className={cn(
                'flex h-10 w-10 items-center justify-center transition-colors',
                view === 'grid' ? 'bg-primary/10 text-primary' : 'bg-background text-muted-foreground hover:bg-accent',
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView('table')}
              aria-pressed={view === 'table'}
              aria-label="Table view"
              className={cn(
                'flex h-10 w-10 items-center justify-center border-l border-border transition-colors',
                view === 'table' ? 'bg-primary/10 text-primary' : 'bg-background text-muted-foreground hover:bg-accent',
              )}
            >
              <TableIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-44">
            <Select value={status} onChange={(value) => { setStatus(value); setPage(1) }} options={STATUS_OPTIONS} className="h-9 rounded-lg border-border bg-background/50" aria-label="Status" />
          </div>
          <div className="w-52">
            <Select value={moduleFilter} onChange={(value) => { setModuleFilter(value); setPage(1) }} options={moduleOptions} className="h-9 rounded-lg border-border bg-background/50" aria-label="Module" />
          </div>
          <div className="w-48">
            <Select value={toolFilter} onChange={(value) => { setToolFilter(value); setPage(1) }} options={toolOptions} className="h-9 rounded-lg border-border bg-background/50" aria-label="Tool" />
          </div>
          <div className="w-44">
            <Select value={sort} onChange={(value) => { setSort(value); setPage(1) }} options={SORT_OPTIONS} className="h-9 rounded-lg border-border bg-background/50" aria-label="Sort by" />
          </div>
          {hasFilters && (
            <button onClick={clearAll} className="ml-1 text-sm font-medium text-primary hover:underline">
              Clear All
            </button>
          )}
        </div>
      </div>

      {(actionMessage || actionError) && (
        <div
          className={cn(
            'flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-medium',
            actionError
              ? 'border-destructive/30 bg-destructive/5 text-destructive'
              : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600',
          )}
        >
          <span>{actionError || actionMessage}</span>
          <button onClick={clearMessages} className="text-xs opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 rounded-2xl border border-primary/10 bg-card/90 shadow-sm backdrop-blur-2xl">
        {error ? (
          <ErrorState title="Couldn't load agents" description={error} retry={retry} className="m-6" />
        ) : loading ? (
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <Skeleton key={index} className="h-44 rounded-2xl" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <EmptyState
            className="m-6 border-0"
            icon={<Bot className="h-10 w-10" />}
            title={hasFilters ? 'No agents match those filters' : 'No agents yet'}
            description={
              hasFilters
                ? 'Try widening the search or clearing the filters.'
                : 'Create your first agent to start automating work.'
            }
            action={
              hasFilters ? (
                <Button variant="outline" onClick={clearAll} className="font-semibold">Clear filters</Button>
              ) : (
                <Button onClick={() => goCreate()} className="gap-2 font-bold">
                  <Plus className="h-4 w-4" /> Create Agent
                </Button>
              )
            }
          />
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => setSelected(agent)}
                className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-background/60 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Bot className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-bold text-foreground">{agent.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{dash(agent.module)}</p>
                  </div>
                  <AgentStatusBadge status={agent.status} size="sm" />
                </div>

                <p className="line-clamp-2 flex-1 text-xs text-muted-foreground">{dash(agent.description)}</p>

                {agent.tools.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {agent.tools.slice(0, 3).map((tool) => (
                      <ToolChip key={tool} tool={tool} />
                    ))}
                    {agent.tools.length > 3 && (
                      <span className="rounded-full border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
                        +{agent.tools.length - 3}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    {!agent.editable && <Lock className="h-3 w-3" />}
                    {agent.model}
                  </span>
                  <span>{formatNumber(agent.total_runs)} runs · {formatRate(agent.success_rate)}</span>
                </div>

                {/* The catalogue's own CTA, so a card is one click from the
                    screen the agent actually works in. */}
                {agent.cta_label && agent.cta_link && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation()
                      followCta(agent)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.stopPropagation()
                        followCta(agent)
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-muted/60 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    {agent.cta_label}
                    {agent.cta_target === 'external' ? (
                      <ExternalLink className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5" />
                    )}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="px-4 py-3 text-xs uppercase tracking-wider">Agent</TableHead>
                  <TableHead className="w-28 px-4 py-3 text-xs uppercase tracking-wider">Source</TableHead>
                  <TableHead className="w-44 px-4 py-3 text-xs uppercase tracking-wider">Module</TableHead>
                  <TableHead className="w-32 px-4 py-3 text-xs uppercase tracking-wider">Model</TableHead>
                  <TableHead className="w-28 px-4 py-3 text-xs uppercase tracking-wider">Status</TableHead>
                  <TableHead className="w-24 px-4 py-3 text-right text-xs uppercase tracking-wider">Runs</TableHead>
                  <TableHead className="w-28 px-4 py-3 text-right text-xs uppercase tracking-wider">Success</TableHead>
                  <TableHead className="w-44 px-4 py-3 text-xs uppercase tracking-wider">Last Run</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow
                    key={agent.id}
                    onClick={() => setSelected(agent)}
                    className="cursor-pointer border-border transition-colors hover:bg-accent/40"
                  >
                    <TableCell className="px-4 py-3">
                      <p className="font-semibold text-foreground">{agent.name}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{dash(agent.description)}</p>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize text-muted-foreground">
                        {!agent.editable && <Lock className="h-3 w-3" />}
                        {agent.origin}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">{dash(agent.module)}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">{agent.model}</TableCell>
                    <TableCell className="px-4 py-3"><AgentStatusBadge status={agent.status} size="sm" /></TableCell>
                    <TableCell className="px-4 py-3 text-right tabular-nums text-sm text-muted-foreground">{formatNumber(agent.total_runs)}</TableCell>
                    <TableCell className="px-4 py-3 text-right tabular-nums text-sm text-muted-foreground">{formatRate(agent.success_rate)}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {agent.last_run_at ? formatDateTime(agent.last_run_at) : 'Never'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {!loading && !error && agents.length > 0 && lastPage > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{total}</span> agents
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-accent disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {pageWindow(page, lastPage).map((entry, index) =>
                entry === 'gap' ? (
                  <span key={`gap-${index}`} className="px-1 text-muted-foreground">…</span>
                ) : (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setPage(entry)}
                    aria-current={entry === page ? 'page' : undefined}
                    className={cn(
                      'h-9 min-w-9 rounded-lg border px-2 text-sm font-semibold',
                      entry === page
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {entry}
                  </button>
                ),
              )}
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
                disabled={page >= lastPage}
                aria-label="Next page"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-accent disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail panel */}
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent
          side="right"
          className="flex w-full flex-col border-l border-primary/10 bg-card p-0 shadow-2xl sm:w-[640px] sm:max-w-none lg:w-[760px]"
        >
          {selectedLive && (
            <AgentDetail
              agent={selectedLive}
              detail={detail}
              loading={detailLoading}
              busy={saving}
              onEdit={() => goCreate(selectedLive.id)}
              onClone={() => clone(selectedLive.id)}
              onDelete={() => setDeleteTarget(selectedLive)}
              onSetStatus={(next: AgentStatus) => setAgentStatus(selectedLive.id, next)}
              onRefresh={refresh}
              onFollowCta={() => followCta(selectedLive)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Delete “{deleteTarget?.name}”?</DialogTitle>
            <DialogDescription>
              The agent is removed from the library. Its run history is kept, so the record of what it did stays intact.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={saving} className="font-bold">
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={saving}
              className="bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
