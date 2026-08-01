'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  GitBranch,
  Loader2,
  MessageSquare,
  Play,
  Plus,
  Send,
  Trash2,
  Workflow as WorkflowIcon,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useAgentMessages, useAgents, useWorkflowDetail, useWorkflows } from '@/hooks/use-agentic'
import type { StepState, WorkflowMode, WorkflowStepRun } from '@/services/agentic'

import { ToolChip, dash, formatDateTime } from './shared'

const STEP_STYLE: Record<StepState, { border: string; icon: typeof CheckCircle2 | null; tone: string }> = {
  idle: { border: 'border-border', icon: null, tone: 'text-muted-foreground' },
  processing: { border: 'border-primary', icon: Loader2, tone: 'text-primary' },
  completed: { border: 'border-emerald-500', icon: CheckCircle2, tone: 'text-emerald-600' },
  error: { border: 'border-destructive', icon: AlertCircle, tone: 'text-destructive' },
}

const MODE_OPTIONS = [
  { label: 'Sequential — one after another', value: 'sequential' },
  { label: 'Parallel — all at once', value: 'parallel' },
]

/**
 * Multi-Agent Coordination.
 *
 * The screen this replaces animated four fixture agents on a timer and reset
 * every 15 seconds — nothing it showed had happened. These are real workflows
 * over the tenant's own agents, and each step's state is reported and stored.
 */
export function AgMultiAgent() {
  const {
    workflows, loading, error, saving,
    actionMessage, actionError, retry, clearMessages,
    create, remove,
  } = useWorkflows()

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  // Default to the first workflow without an effect, so the diagram is never
  // blank when one exists.
  const activeId = selectedId ?? workflows[0]?.id ?? null

  const detail = useWorkflowDetail(activeId)
  const { messages, retry: reloadMessages } = useAgentMessages(detail.runState?.id)
  const { agents } = useAgents({ per_page: 200, status: 'deployed', sort: 'name', direction: 'asc' })

  const [form, setForm] = useState({ name: '', description: '', mode: 'sequential' as WorkflowMode })
  const [stepAgent, setStepAgent] = useState('')
  const [messageDraft, setMessageDraft] = useState('')

  const agentOptions = useMemo(
    () => [
      { label: agents.length ? 'Select an agent' : 'No deployed agents yet', value: '' },
      ...agents.map((agent) => ({ label: agent.name, value: String(agent.id) })),
    ],
    [agents],
  )

  const steps = detail.runState?.steps ?? []
  const usingRun = steps.length > 0

  // Before a run exists the diagram is drawn from the configured steps, all
  // idle. Once one starts, it is drawn from the live step states.
  const nodes: (WorkflowStepRun | { id: number; sequence: number; status: StepState; agent_name: string; agent_description: string | null; model: string | null; tools: string[] })[] =
    usingRun
      ? steps
      : (detail.detail?.steps ?? []).map((step) => ({
          id: step.id,
          sequence: step.sequence,
          status: 'idle' as StepState,
          agent_name: step.name || step.agent_name,
          agent_description: step.agent_description,
          model: step.model,
          tools: step.tools,
        }))

  const submitCreate = async () => {
    if (!form.name.trim()) return
    const result = await create({ name: form.name.trim(), description: form.description.trim() || undefined, mode: form.mode, status: 'active' })
    if (result.ok) {
      setCreateOpen(false)
      setForm({ name: '', description: '', mode: 'sequential' })
    }
  }

  const confirmDelete = async () => {
    if (deleteTarget === null) return
    const result = await remove(deleteTarget)
    if (result.ok) {
      if (activeId === deleteTarget) setSelectedId(null)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="g2g-scrollbar flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Multi-Agent Coordination</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chain agents into a workflow and watch each hand-off as it happens.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="h-10 gap-2 rounded-xl px-4 font-bold shadow-md shadow-primary/20">
          <Plus className="h-4 w-4 stroke-[3]" /> New Workflow
        </Button>
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

      {error ? (
        <ErrorState title="Couldn't load workflows" description={error} retry={retry} />
      ) : loading ? (
        <div className="space-y-4">
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : workflows.length === 0 ? (
        <EmptyState
          className="border-0"
          icon={<WorkflowIcon className="h-10 w-10" />}
          title="No workflows yet"
          description="A workflow chains deployed agents so one hands off to the next."
          action={
            <Button onClick={() => setCreateOpen(true)} className="gap-2 font-bold">
              <Plus className="h-4 w-4" /> New Workflow
            </Button>
          }
        />
      ) : (
        <>
          {/* Workflow picker */}
          <div className="flex flex-wrap gap-2">
            {workflows.map((workflow) => (
              <button
                key={workflow.id}
                type="button"
                onClick={() => setSelectedId(workflow.id)}
                className={cn(
                  'group flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
                  activeId === workflow.id
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent',
                )}
              >
                {workflow.mode === 'parallel' ? <GitBranch className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                {workflow.name}
                <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
                  {workflow.step_count}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Delete ${workflow.name}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    setDeleteTarget(workflow.id)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.stopPropagation()
                      setDeleteTarget(workflow.id)
                    }
                  }}
                  className="ml-1 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </span>
              </button>
            ))}
          </div>

          {/* Diagram */}
          <div className="rounded-2xl border border-primary/10 bg-card/90 shadow-sm backdrop-blur-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  {detail.detail?.name ?? 'Workflow'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {detail.detail?.mode === 'parallel'
                    ? 'Every step starts at once'
                    : 'Each step starts when the one before it completes'}
                  {detail.runState ? ` · run #${detail.runState.id} ${detail.runState.status}` : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="w-52">
                  <Select
                    value={stepAgent}
                    onChange={setStepAgent}
                    options={agentOptions}
                    disabled={agents.length === 0}
                    className="h-9 rounded-lg border-border bg-background"
                    aria-label="Agent to add"
                  />
                </div>
                <Button
                  variant="outline"
                  disabled={!stepAgent || detail.busy}
                  onClick={async () => {
                    const result = await detail.addStep({ agent_id: Number(stepAgent) })
                    if (result.ok) setStepAgent('')
                  }}
                  className="h-9 gap-2 rounded-lg font-semibold"
                >
                  <Plus className="h-4 w-4" /> Add Step
                </Button>
                <Button
                  onClick={() => detail.startRun()}
                  disabled={detail.busy || nodes.length === 0}
                  className="h-9 gap-2 rounded-lg font-bold"
                >
                  <Play className="h-4 w-4" /> Run Workflow
                </Button>
              </div>
            </div>

            <div className="p-5">
              {detail.loading ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : nodes.length === 0 ? (
                <EmptyState
                  className="border-0 py-8"
                  icon={<Bot className="h-8 w-8" />}
                  title="No steps yet"
                  description={
                    agents.length === 0
                      ? 'Deploy an agent first — only deployed agents can be added to a workflow.'
                      : 'Add a deployed agent above to build the chain.'
                  }
                />
              ) : (
                <div className="g2g-scrollbar flex items-stretch gap-2 overflow-x-auto pb-3">
                  {nodes.map((node, index) => {
                    const style = STEP_STYLE[node.status] ?? STEP_STYLE.idle
                    const Icon = style.icon
                    const live = usingRun && 'workflow_step_id' in node

                    return (
                      <div key={node.id} className="flex items-center">
                        <div
                          className={cn(
                            'flex min-w-[260px] flex-col gap-2 rounded-xl border-2 bg-background p-4 transition-colors',
                            style.border,
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-foreground">{node.agent_name}</p>
                              <p className="text-[11px] text-muted-foreground">Step {node.sequence}</p>
                            </div>
                            <span className={cn('flex items-center gap-1.5 text-xs font-semibold capitalize', style.tone)}>
                              {Icon && <Icon className={cn('h-4 w-4', node.status === 'processing' && 'animate-spin')} />}
                              {node.status}
                            </span>
                          </div>

                          {node.agent_description && (
                            <p className="line-clamp-2 text-xs text-muted-foreground">{node.agent_description}</p>
                          )}

                          <div className="flex flex-wrap gap-1">
                            {node.model && (
                              <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                                {node.model}
                              </span>
                            )}
                            {node.tools.slice(0, 2).map((tool) => (
                              <ToolChip key={tool} tool={tool} />
                            ))}
                          </div>

                          {/* Reporting an outcome is what advances the chain, so
                              the controls sit on the step that is in flight. */}
                          {live && node.status === 'processing' && (
                            <div className="flex gap-2 border-t border-border pt-2">
                              <Button
                                variant="outline"
                                disabled={detail.busy}
                                onClick={() => detail.reportStep(node.id, 'completed', 'Completed')}
                                className="h-8 flex-1 gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/20"
                              >
                                <Check className="h-3.5 w-3.5" /> Complete
                              </Button>
                              <Button
                                variant="outline"
                                disabled={detail.busy}
                                onClick={() => detail.reportStep(node.id, 'error', undefined, 'Reported as failed')}
                                className="h-8 flex-1 gap-1.5 border-destructive/30 bg-destructive/10 text-xs font-semibold text-destructive hover:bg-destructive/20"
                              >
                                <X className="h-3.5 w-3.5" /> Fail
                              </Button>
                            </div>
                          )}

                          {live && node.status === 'error' && node.error && (
                            <p className="border-t border-border pt-2 text-xs text-destructive">{node.error}</p>
                          )}

                          {!usingRun && (
                            <button
                              type="button"
                              onClick={() => detail.removeStep(node.id)}
                              disabled={detail.busy}
                              className="self-start text-xs font-medium text-muted-foreground hover:text-destructive"
                            >
                              Remove step
                            </button>
                          )}
                        </div>

                        {index < nodes.length - 1 && (
                          <div className="flex items-center gap-1 px-2">
                            <div
                              className={cn(
                                'h-0.5 w-8 transition-colors',
                                node.status === 'completed' ? 'bg-primary' : 'bg-border',
                              )}
                            />
                            <ArrowRight
                              className={cn(
                                'h-5 w-5 transition-colors',
                                node.status === 'completed' ? 'text-primary' : 'text-muted-foreground',
                              )}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {detail.error && <p className="mt-3 text-sm font-medium text-destructive">{detail.error}</p>}
            </div>
          </div>

          {/* Messages */}
          <div className="rounded-2xl border border-primary/10 bg-card/90 shadow-sm backdrop-blur-2xl">
            <div className="border-b border-border p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Agent Communication</h2>
              <p className="text-xs text-muted-foreground">Hand-off notes between agents on this run</p>
            </div>

            <div className="space-y-3 p-5">
              <div className="flex flex-wrap gap-2">
                <Input
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  placeholder="Record a hand-off note…"
                  className="h-9 min-w-[240px] flex-1 border-border bg-background"
                />
                <Button
                  variant="outline"
                  disabled={!messageDraft.trim()}
                  onClick={async () => {
                    const { workflowService } = await import('@/services/agentic')
                    const { getLaravelContext } = await import('@/lib/laravel-context')
                    await workflowService.sendMessage(getLaravelContext(), {
                      message: messageDraft.trim(),
                      workflow_run_id: detail.runState?.id,
                    })
                    setMessageDraft('')
                    reloadMessages()
                  }}
                  className="h-9 gap-2 rounded-lg font-semibold"
                >
                  <Send className="h-4 w-4" /> Record
                </Button>
              </div>

              {messages.length === 0 ? (
                <EmptyState
                  className="border-0 py-6"
                  icon={<MessageSquare className="h-7 w-7" />}
                  title="No messages"
                  description="Notes passed between agents on a run appear here."
                />
              ) : (
                <ul className="space-y-2">
                  {messages.map((message) => (
                    <li key={message.id} className="rounded-lg border border-border p-3">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <span className="text-primary">{message.from_agent}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-foreground">{message.to_agent}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(message.created_at)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{dash(message.message)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      {/* Create workflow */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>New Workflow</DialogTitle>
            <DialogDescription>Chain deployed agents so one hands off to the next.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground" htmlFor="workflow-name">
                Name<span className="text-destructive"> *</span>
              </label>
              <Input
                id="workflow-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. Content Pipeline"
                className="border-border bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground" htmlFor="workflow-description">Description</label>
              <Textarea
                id="workflow-description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="What does this chain accomplish?"
                className="min-h-[80px] border-border bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Execution Mode</label>
              <Select
                value={form.mode}
                onChange={(value) => setForm((current) => ({ ...current, mode: value as WorkflowMode }))}
                options={MODE_OPTIONS}
                className="h-9 border-border bg-background"
                aria-label="Execution mode"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving} className="font-bold">Cancel</Button>
            <Button onClick={submitCreate} disabled={saving || !form.name.trim()} className="font-bold">
              {saving ? 'Creating…' : 'Create Workflow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete workflow */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Delete this workflow?</DialogTitle>
            <DialogDescription>
              Its steps are removed. The agents themselves and their run history are untouched.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={saving} className="font-bold">Cancel</Button>
            <Button onClick={confirmDelete} disabled={saving} className="bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90">
              {saving ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
