'use client'

/**
 * A full working screen for one agent, reached from its card.
 *
 * This is what replaced the five agents that used to send the user out to the
 * old app. Those screens each had their own Create / History / View tabs
 * backed by whichever external service produced them, which meant their
 * history vanished whenever that service was asleep.
 *
 * Here the shape is the same for every agent, because the pieces are the same:
 *   Launch   - the agent's own input schema as a form
 *   History  - this agent's runs, from our run log
 *   Result   - the stored output of a run, rendered as a report
 *
 * The per-agent differences live in data (input_schema) and in presentation
 * (agent-results), not in thirteen screens.
 */

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Clock3, ExternalLink, History, Rocket, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAgentDetail, useRuns } from '@/hooks/use-agentic'
import type { AgentRun } from '@/services/agentic'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { AG_AGENT_LIBRARY_ACCESS_LINK } from '@/lib/gtg-navigation'
import { AgentLaunchPanel } from './agent-launch-panel'
import { AgentResult } from './agent-results'
import { RunStatusBadge, formatDateTime, formatDuration } from './shared'

type WorkspaceTab = 'launch' | 'history'

export function AgAgentWorkspace() {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const searchParams = useSearchParams()
  const agentId = Number(searchParams.get('agent'))

  const { detail, loading, error, refresh } = useAgentDetail(Number.isFinite(agentId) && agentId > 0 ? agentId : null)

  const [tab, setTab] = useState<WorkspaceTab>('launch')
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null)

  // Scoped to this agent, so History is genuinely this agent's history.
  const runParams = useMemo(
    () => ({ agent_id: String(agentId), per_page: 25, sort: 'created_at' as const, direction: 'desc' as const }),
    [agentId],
  )
  const { runs, loading: runsLoading, retry: reloadRuns } = useRuns(runParams, agentId > 0)

  const reload = () => {
    refresh()
    reloadRuns()
  }

  if (!agentId) {
    return (
      <EmptyState
        icon={<Sparkles className="h-8 w-8" />}
        title="No agent selected"
        description="Open an agent from the library to work with it."
        action={<Button onClick={() => router.push(resolveAccessLink(AG_AGENT_LIBRARY_ACCESS_LINK))}>Go to Agent Library</Button>}
      />
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (error || !detail) {
    return <ErrorState title="Could not load this agent" description={error ?? 'It may have been deleted.'} retry={refresh} />
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-card/50 p-5 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <Button
              variant="outline"
              onClick={() => router.push(resolveAccessLink(AG_AGENT_LIBRARY_ACCESS_LINK))}
              aria-label="Back to Agent Library"
              className="h-9 w-9 shrink-0 rounded-xl p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight text-foreground">{detail.name}</h1>
              {detail.description && (
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{detail.description}</p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {detail.module && (
                  <span className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {detail.module}
                  </span>
                )}
                <span className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {detail.total_runs} runs
                </span>
                {detail.success_rate !== null && (
                  <span className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {detail.success_rate}% success
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Only genuinely third-party destinations keep an outward link. */}
          {detail.cta_target === 'external' && detail.cta_link && (
            <Button
              variant="outline"
              onClick={() => window.open(detail.cta_link!, '_blank', 'noopener,noreferrer')}
              className="h-9 gap-2 rounded-lg font-semibold"
            >
              <ExternalLink className="h-4 w-4" /> {detail.cta_label ?? 'Open'}
            </Button>
          )}
        </div>
      </div>

      {/* What it does */}
      {(detail.function_text || detail.workflow.length > 0 || detail.outputs.length > 0) && (
        <details className="group rounded-2xl border border-border bg-card/40 p-4">
          <summary className="cursor-pointer list-none text-sm font-bold text-foreground">
            How this agent works
            <span className="ml-2 text-xs font-medium text-muted-foreground group-open:hidden">Show</span>
            <span className="ml-2 hidden text-xs font-medium text-muted-foreground group-open:inline">Hide</span>
          </summary>

          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
            {detail.function_text && (
              <div className="md:col-span-3">
                <p className="text-sm leading-relaxed text-muted-foreground">{detail.function_text}</p>
              </div>
            )}

            {detail.workflow.length > 0 && (
              <div className="md:col-span-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workflow</p>
                <ol className="space-y-1.5">
                  {detail.workflow.map((step, index) => (
                    <li key={index} className="flex gap-2.5 text-sm text-foreground">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {detail.outputs.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outputs</p>
                <ul className="space-y-1">
                  {detail.outputs.map((output, index) => (
                    <li key={index} className="flex gap-2 text-sm text-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{output}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border" role="tablist" aria-label="Agent workspace">
        {(
          [
            { id: 'launch', label: 'Launch', icon: Rocket },
            { id: 'history', label: `History${runs.length ? ` (${runs.length})` : ''}`, icon: History },
          ] as const
        ).map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => setTab(entry.id)}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
              tab === entry.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <entry.icon className="h-4 w-4" />
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'launch' &&
        (detail.status === 'deployed' ? (
          <AgentLaunchPanel agent={detail} onRefresh={reload} />
        ) : (
          <EmptyState
            icon={<Rocket className="h-8 w-8" />}
            title={`This agent is ${detail.status}`}
            description="Deploy it from the Agent Library before it can accept runs."
            action={<Button onClick={() => router.push(resolveAccessLink(AG_AGENT_LIBRARY_ACCESS_LINK))}>Go to Agent Library</Button>}
          />
        ))}

      {tab === 'history' && (
        <RunHistory
          runs={runs}
          loading={runsLoading}
          selected={selectedRun}
          onSelect={setSelectedRun}
          onLaunch={() => setTab('launch')}
        />
      )}
    </div>
  )
}

function RunHistory({
  runs,
  loading,
  selected,
  onSelect,
  onLaunch,
}: {
  runs: AgentRun[]
  loading: boolean
  selected: AgentRun | null
  onSelect: (run: AgentRun | null) => void
  onLaunch: () => void
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <EmptyState
        icon={<History className="h-8 w-8" />}
        title="Nothing run yet"
        description="Results appear here after the first launch, and stay available even if the service behind the agent is offline."
        action={<Button onClick={onLaunch}>Launch this agent</Button>}
      />
    )
  }

  // A selected run takes over the pane; the list is one click away.
  if (selected) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" onClick={() => onSelect(null)} className="h-9 gap-2 rounded-lg font-semibold">
            <ArrowLeft className="h-4 w-4" /> Back to history
          </Button>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RunStatusBadge status={selected.status} />
            <Clock3 className="h-3.5 w-3.5" />
            {formatDateTime(selected.created_at)}
            {selected.duration_ms !== null && <span>· {formatDuration(selected.duration_ms)}</span>}
          </div>
        </div>

        {selected.input && (
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Requested</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{selected.input}</p>
          </div>
        )}

        {selected.error_message ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm font-semibold text-destructive">{selected.error_message}</p>
          </div>
        ) : (
          <AgentResult output={selected.output} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {runs.map((run) => (
        <button
          key={run.id}
          type="button"
          onClick={() => onSelect(run)}
          className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/40 px-4 py-3 text-left transition-colors hover:bg-accent/40"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {run.input || `Run #${run.id}`}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDateTime(run.created_at)}
              {run.duration_ms !== null && ` · ${formatDuration(run.duration_ms)}`}
            </p>
          </div>

          <RunStatusBadge status={run.status} />
        </button>
      ))}
    </div>
  )
}
