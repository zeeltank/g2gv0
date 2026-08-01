'use client'

import { useState } from 'react'
import {
  Archive,
  ArrowRight,
  Bot,
  CircleAlert,
  CircleCheck,
  MoreHorizontal,
  Copy,
  Edit2,
  ExternalLink,
  Lock,
  Pause,
  Play,
  Rocket,
  Trash2,
  Wrench,
  Zap,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { SheetTitle } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { useTools } from '@/hooks/use-agentic'
import type { Agent, AgentDetail as AgentDetailData, AgentStatus, ToolKey } from '@/services/agentic'

import { AgentLaunchPanel } from './agent-launch-panel'
import {
  AgentStatusBadge,
  RunStatusBadge,
  ToolChip,
  dash,
  formatCost,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatRate,
} from './shared'
import { ToolForm, toolEndpointFor, toolLabelFor } from './tool-forms'

type DetailTab = 'overview' | 'configuration' | 'tools' | 'runs'

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'tools', label: 'Tools' },
  { id: 'runs', label: 'Runs' },
]

function Field({ label, value, mono }: { label: string; value: unknown; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('whitespace-pre-line break-words text-sm text-foreground', mono && 'font-mono text-xs')}>
        {dash(value)}
      </p>
    </div>
  )
}

interface AgentDetailProps {
  agent: Agent
  detail: AgentDetailData | null
  loading: boolean
  busy: boolean
  onEdit: () => void
  onClone: () => void
  onDelete: () => void
  onSetStatus: (status: AgentStatus) => void
  onRefresh: () => void
  /** Follows the catalogue card's call-to-action. */
  onFollowCta: () => void
}

/**
 * The agent side panel.
 *
 * Replaces a full-page detail route: the library keeps its filters and scroll
 * position while an agent is inspected, and the tool forms sit next to the
 * configuration that enables them rather than on a separate screen.
 */
export function AgentDetail({
  agent,
  detail,
  loading,
  busy,
  onEdit,
  onClone,
  onDelete,
  onSetStatus,
  onRefresh,
  onFollowCta,
}: AgentDetailProps) {
  const [tab, setTab] = useState<DetailTab>('overview')
  const [activeTool, setActiveTool] = useState<ToolKey | null>(null)

  const { invoke, invoking } = useTools()

  const data = detail ?? null
  const tools = data?.tools ?? agent.tools
  const deployed = agent.status === 'deployed'

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="space-y-3 border-b border-border p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <SheetTitle className="break-words text-xl font-bold text-foreground">{agent.name}</SheetTitle>
            <div className="flex flex-wrap items-center gap-2">
              <AgentStatusBadge status={agent.status} size="sm" />
              {agent.module && (
                <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {agent.module}
                </span>
              )}
              <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {agent.model}
              </span>
              {!agent.editable && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Platform agent
                </span>
              )}

              {/* Only meaningful for agents that ask for setup at all. */}
              {agent.config_schema.length > 0 && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                    agent.configured
                      ? 'border-border bg-muted/40 text-muted-foreground'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
                  )}
                >
                  {agent.configured ? <CircleCheck className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}
                  {agent.configured ? 'Connected' : 'Needs setup'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* At a glance, so the numbers are not buried in a tab. */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>
            <span className="font-bold tabular-nums text-foreground">{formatNumber(agent.total_runs)}</span> runs
          </span>
          <span>
            <span className="font-bold tabular-nums text-foreground">{formatRate(agent.success_rate)}</span> success
          </span>
          <span>
            Last run{' '}
            <span className="font-medium text-foreground">
              {agent.last_run_at ? formatDateTime(agent.last_run_at) : 'never'}
            </span>
          </span>
        </div>

        {/* One primary action, one state control, everything else behind a
            menu. Seven equally-weighted buttons made the important one -
            actually using the agent - impossible to find. */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {agent.cta_label && agent.cta_link && (
            <Button onClick={onFollowCta} className="h-9 gap-2 rounded-lg font-bold">
              {agent.cta_target === 'external' ? <ExternalLink className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              {agent.cta_label}
            </Button>
          )}

          {agent.editable &&
            (agent.status === 'deployed' ? (
              <Button
                variant="outline"
                onClick={() => onSetStatus('paused')}
                disabled={busy}
                className="h-9 gap-2 rounded-lg font-semibold"
              >
                <Pause className="h-4 w-4" /> Pause
              </Button>
            ) : agent.status !== 'archived' ? (
              <Button onClick={() => onSetStatus('deployed')} disabled={busy} className="h-9 gap-2 rounded-lg font-bold">
                <Rocket className="h-4 w-4" /> Deploy
              </Button>
            ) : null)}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={busy}
                aria-label="More actions"
                className="h-9 w-9 rounded-lg p-0"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-52">
              {/* Duplicate stays available to everyone: it is how a shared
                  agent becomes one you can edit. */}
              <DropdownMenuItem onSelect={onClone}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>

              {agent.editable && (
                <DropdownMenuItem onSelect={onEdit}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}

              {agent.editable && agent.status !== 'archived' && (
                <DropdownMenuItem onSelect={() => onSetStatus('archived')}>
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </DropdownMenuItem>
              )}

              {agent.editable && (
                <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {!agent.editable && (
          <p className="text-xs text-muted-foreground">
            Maintained centrally for every organisation. Duplicate it to get an editable copy you can point at
            your own endpoint.
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border px-6">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            className={cn(
              '-mb-px border-b-2 px-3 py-3 text-sm font-semibold transition-colors',
              tab === entry.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {entry.label}
            {entry.id === 'tools' && tools.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{tools.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="g2g-scrollbar flex-1 space-y-6 overflow-y-auto p-6">
        {tab === 'overview' && (
          <>
            <Field label="Description" value={agent.description} />

            {/* The catalogue copy: what the agent does, how it works, what it
                produces. Rendered from data, so an operator can edit it. */}
            {agent.function_text && <Field label="Function" value={agent.function_text} />}

            {agent.workflow.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workflow</p>
                <ol className="space-y-1.5">
                  {agent.workflow.map((step, index) => (
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

            {agent.outputs.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outputs</p>
                <ul className="space-y-1">
                  {agent.outputs.map((output, index) => (
                    <li key={index} className="flex gap-2 text-sm text-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{output}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {agent.tools.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {agent.tools.map((tool) => (
                  <ToolChip key={tool} tool={tool} />
                ))}
              </div>
            )}

            {/* Launch: the form comes from the agent's own input_schema, so
                each agent asks for what it actually needs instead of sharing
                one free-text box. */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-foreground">Launch</p>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <Zap className="h-3 w-3" />
                  {agent.execution_mode === 'http' ? 'Calls endpoint' : 'Records only'}
                </span>
              </div>

              {agent.execution_mode === 'http' && agent.endpoint_url && (
                <p className="break-all font-mono text-[11px] text-muted-foreground">{agent.endpoint_url}</p>
              )}

              {deployed ? (
                <AgentLaunchPanel agent={agent} onRefresh={onRefresh} />
              ) : (
                <div className="rounded-xl border border-border p-4">
                  <p className="text-sm text-muted-foreground">
                    Deploy the agent first — a {agent.status} agent cannot accept runs.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'configuration' && (
          <>
            <Field label="System Prompt" value={agent.system_prompt} mono />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Model" value={agent.model} />
              <Field label="Temperature" value={agent.temperature} />
              <Field label="Max Tokens" value={formatNumber(agent.max_tokens)} />
              <Field label="Role" value={agent.role} />
              <Field label="Module" value={agent.module} />
              <Field label="Sub Module" value={agent.sub_module} />
            </div>
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Execution</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Mode" value={agent.execution_mode === 'http' ? 'HTTP endpoint' : 'Recorded only'} />
                <Field label="Method" value={agent.endpoint_method} />
              </div>
              <Field label="Endpoint URL" value={agent.endpoint_url} mono />
              <p className="text-xs text-muted-foreground">
                {agent.has_endpoint_headers
                  ? 'Custom request headers are set. They are stored write-only and never returned by the API.'
                  : 'No custom request headers. Add an Authorization header here if the endpoint needs one.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
              <Field label="Created" value={formatDateTime(agent.created_at)} />
              <Field label="Last Updated" value={formatDateTime(agent.updated_at)} />
            </div>
          </>
        )}

        {tab === 'tools' && (
          <>
            {tools.length === 0 ? (
              <EmptyState
                className="border-0"
                icon={<Wrench className="h-8 w-8" />}
                title="No tools enabled"
                description="Edit the agent to give it capabilities it can invoke."
              />
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {tools.map((tool) => {
                    const endpoint = toolEndpointFor(tool)
                    const selected = endpoint !== null && activeTool === endpoint

                    return (
                      <button
                        key={tool}
                        type="button"
                        // n8n has no form of its own — it is triggered externally.
                        disabled={endpoint === null}
                        onClick={() => setActiveTool(selected ? null : endpoint)}
                        title={endpoint === null ? 'Triggered from the external workflow, no form here' : undefined}
                        className={cn(
                          'rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors',
                          selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background text-muted-foreground hover:bg-accent',
                          endpoint === null && 'cursor-default opacity-60',
                        )}
                      >
                        {toolLabelFor(tool)}
                      </button>
                    )
                  })}
                </div>

                {activeTool ? (
                  <div className="rounded-xl border border-border p-4">
                    <ToolForm
                      key={activeTool}
                      tool={activeTool}
                      agentId={agent.id}
                      invoking={invoking}
                      onInvoke={async (values) => {
                        const result = await invoke(activeTool, values as never)
                        if (result.ok) onRefresh()
                        return result
                      }}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Pick a tool to run it against this agent.</p>
                )}

                {(data?.tool_invocations?.length ?? 0) > 0 && (
                  <div className="space-y-2 border-t border-border pt-4">
                    <p className="text-sm font-bold text-foreground">Recent tool calls</p>
                    {data!.tool_invocations.map((invocation) => (
                      <div
                        key={invocation.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-foreground">{invocation.tool}</span>
                        <span className="flex items-center gap-2">
                          <RunStatusBadge status={invocation.status} size="sm" />
                          <span className="text-xs text-muted-foreground">{formatDateTime(invocation.created_at)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === 'runs' && (
          <>
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : (data?.recent_runs?.length ?? 0) === 0 ? (
              <EmptyState
                className="border-0"
                icon={<Play className="h-8 w-8" />}
                title="No runs yet"
                description="Start a run from the Overview tab to see it here."
              />
            ) : (
              <div className="space-y-2">
                {data!.recent_runs.map((run) => (
                  <div key={run.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <RunStatusBadge status={run.status} size="sm" />
                      <span className="text-xs text-muted-foreground">{formatDateTime(run.created_at)}</span>
                    </div>
                    {run.input && <p className="mt-2 line-clamp-2 text-sm text-foreground">{run.input}</p>}
                    {run.output && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{run.output}</p>}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{formatDuration(run.duration_ms)}</span>
                      <span>{formatNumber(run.tokens_used)} tokens</span>
                      <span>{formatCost(run.cost)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
