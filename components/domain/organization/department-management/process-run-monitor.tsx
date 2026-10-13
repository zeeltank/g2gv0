'use client'

import { useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'
import { Activity, Ban, CheckCircle2, Hand, SkipForward, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Notice } from './signals-ui'
import type { Department } from '@/lib/gtg-org-data'
import type { LaravelContext } from '@/lib/laravel-context'
import { organizationService } from '@/services/organization'
import type { DepartmentProcessRun, DepartmentProcessRunStep, DepartmentProcessTemplates } from '@/services/organization'
import { useProcessRun } from './use-process-runs'
import { ProcessStepNode, type ProcessStepNodeData } from './process-step-node'

const NODE_W = 200
const NODE_H = 68

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'muted'> = {
  running: 'warning',
  completed: 'success',
  cancelled: 'muted',
}

function humanizeEvent(type: string): string {
  const labels: Record<string, string> = {
    'process.run.started': 'Run started',
    'process.run.completed': 'Run completed',
    'process.run.cancelled': 'Run cancelled',
    'process.step.activated': 'Step activated',
    'process.step.claimed': 'Step claimed',
    'process.step.completed': 'Step completed',
    'process.step.skipped': 'Step skipped',
    'process.step.due_soon': 'Step due soon',
  }
  return labels[type] ?? type
}

function buildRunGraph(
  run: DepartmentProcessRun,
  stepTypes: Record<string, { label: string; color: string }>,
): { nodes: Node[]; edges: Edge[]; runStepsByKey: Map<string, DepartmentProcessRunStep> } {
  const definition = run.definition ?? { steps: [], edges: [] }
  const runStepsByKey = new Map((run.steps ?? []).map((s) => [s.step_node_key, s]))
  const current = new Set<string>((run.steps ?? []).filter((s) => s.status === 'pending' || s.status === 'in_progress').map((s) => s.step_node_key))

  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: 'TB', nodesep: 32, ranksep: 56, marginx: 24, marginy: 24 })
  definition.steps.forEach((s) => graph.setNode(s.node_key, { width: NODE_W, height: NODE_H }))
  const known = new Set(definition.steps.map((s) => s.node_key))
  definition.edges.forEach((e) => {
    if (known.has(e.source_node_key) && known.has(e.target_node_key)) graph.setEdge(e.source_node_key, e.target_node_key)
  })
  dagre.layout(graph)

  const nodes: Node[] = definition.steps.map((step) => {
    const placed = graph.node(step.node_key)
    const runStep = runStepsByKey.get(step.node_key)
    const data: ProcessStepNodeData = {
      node_key: step.node_key,
      step_type: step.step_type,
      title: step.title,
      assignee_type: step.assignee_type,
      assignee_value: runStep?.assignee_name ?? step.assignee_value,
      sla_value: step.sla_value,
      sla_unit: step.sla_unit,
      linked_sop_id: step.linked_sop_id,
      linked_policy_id: step.linked_policy_id,
      linked_rule_id: step.linked_rule_id,
      stepTypes,
      interactive: true,
      isCurrent: current.has(step.node_key),
      isComplete: runStep ? (runStep.status === 'completed' || runStep.status === 'skipped') : false,
    }
    return {
      id: step.node_key,
      type: 'step',
      position: { x: (placed?.x ?? 0) - NODE_W / 2, y: (placed?.y ?? 0) - NODE_H / 2 },
      width: NODE_W,
      height: NODE_H,
      data,
    }
  })

  const edges: Edge[] = definition.edges
    .filter((e) => known.has(e.source_node_key) && known.has(e.target_node_key))
    .map((e, index) => {
      const taken = runStepsByKey.has(e.target_node_key)
      const flowing = taken && current.has(e.target_node_key)
      return {
        id: `e-${index}-${e.source_node_key}-${e.target_node_key}`,
        source: e.source_node_key,
        target: e.target_node_key,
        label: e.label ?? undefined,
        type: 'smoothstep',
        animated: flowing,
        markerEnd: taken ? { type: MarkerType.ArrowClosed, width: 16, height: 16 } : undefined,
        style: taken
          ? { stroke: 'var(--primary)', strokeWidth: 2.5 }
          : { stroke: 'var(--muted-foreground)', strokeWidth: 1.5, strokeDasharray: '4 4', opacity: 0.4 },
        labelStyle: { fontSize: 11, fill: 'var(--muted-foreground)' },
        labelBgStyle: { fill: 'var(--card)' },
      }
    })

  return { nodes, edges, runStepsByKey }
}

/**
 * The live payoff of the builder: a published process's graph, rendered
 * read-only, with whatever step(s) are current pulsing and every edge the
 * run has actually walked drawn solid - the rest of the graph stays dashed
 * and muted, so at a glance you see both where this run has been and where
 * it still could go. Polls while running (see useProcessRun) so a
 * colleague's action elsewhere, or the SLA scan command auto-advancing a
 * wait step, shows up here without a manual refresh.
 */
export function ProcessRunMonitor({
  department,
  runId,
  templates,
  context,
  canManage,
  onClose,
  onChanged,
}: {
  department: Department
  runId: string
  templates: DepartmentProcessTemplates
  context: LaravelContext
  canManage: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const { run, isLoading, error, reload } = useProcessRun(context, runId)
  const nodeTypes = useMemo(() => ({ step: ProcessStepNode }), [])

  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [isActing, setIsActing] = useState(false)
  const [actionError, setActionError] = useState('')
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)

  const { nodes, edges, runStepsByKey } = useMemo(
    () =>
      run
        ? buildRunGraph(run, templates.step_types)
        : { nodes: [] as Node[], edges: [] as Edge[], runStepsByKey: new Map<string, DepartmentProcessRunStep>() },
    [run, templates.step_types],
  )

  const selectedStep = selectedNodeKey ? run?.definition?.steps.find((s) => s.node_key === selectedNodeKey) : null
  const selectedRunStep = selectedNodeKey ? runStepsByKey.get(selectedNodeKey) : undefined
  const isCurrent = selectedRunStep ? (selectedRunStep.status === 'pending' || selectedRunStep.status === 'in_progress') : false

  const outgoingLabels = useMemo(() => {
    if (!selectedNodeKey || !run?.definition) return []
    return Array.from(
      new Set(
        run.definition.edges
          .filter((e) => e.source_node_key === selectedNodeKey && e.label)
          .map((e) => e.label as string),
      ),
    )
  }, [selectedNodeKey, run])

  const canSkip = Boolean(
    selectedStep && selectedStep.is_required === false && !['decision', 'approval'].includes(selectedStep.step_type),
  )

  async function act(action: () => Promise<unknown>) {
    setIsActing(true)
    setActionError('')
    try {
      await action()
      await reload()
      onChanged()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'That action could not be completed.')
    } finally {
      setIsActing(false)
    }
  }

  if (isLoading && !run) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading run...</p>
      </div>
    )
  }

  if (!run) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <Notice tone="error">{error || 'This run could not be found.'}</Notice>
        <Button className="ml-3" variant="outline" onClick={onClose}>Close</Button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{run.name || run.process_name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {department.name} <span>·</span> {run.process_name}
            <Badge variant={STATUS_VARIANT[run.status] ?? 'muted'} className="text-[10px] capitalize">
              {run.status}
            </Badge>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && run.status === 'running' && (
            <Button variant="outline" size="sm" onClick={() => setCancelConfirmOpen(true)}>
              <Ban className="size-4" aria-hidden="true" />
              Cancel Run
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedNodeKey(node.id)}
            onPaneClick={() => setSelectedNodeKey(null)}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            fitView
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.2}
            maxZoom={1.5}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} className="opacity-30" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!bg-card" />
          </ReactFlow>
        </div>

        <div className="w-80 shrink-0 overflow-y-auto border-l border-border">
          {selectedStep && (
            <div className="space-y-4 border-b border-border p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {templates.step_types[selectedStep.step_type]?.label ?? selectedStep.step_type}
                </p>
                <Button variant="ghost" size="icon-sm" onClick={() => setSelectedNodeKey(null)}>
                  <X className="size-4" />
                </Button>
              </div>
              <p className="text-sm font-medium text-foreground">{selectedStep.title}</p>

              {selectedRunStep && (
                <dl className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <dt>Status</dt>
                    <dd className="font-medium text-foreground capitalize">{selectedRunStep.status.replace('_', ' ')}</dd>
                  </div>
                  {selectedRunStep.assignee_name && (
                    <div className="flex justify-between">
                      <dt>Assignee</dt>
                      <dd className="font-medium text-foreground">{selectedRunStep.assignee_name}</dd>
                    </div>
                  )}
                  {selectedRunStep.due_at && (
                    <div className="flex justify-between">
                      <dt>Due</dt>
                      <dd className="font-medium text-foreground">{new Date(selectedRunStep.due_at).toLocaleString()}</dd>
                    </div>
                  )}
                  {selectedRunStep.outcome && (
                    <div className="flex justify-between">
                      <dt>Outcome</dt>
                      <dd className="font-medium text-foreground">{selectedRunStep.outcome}</dd>
                    </div>
                  )}
                </dl>
              )}

              {!selectedRunStep && <p className="text-xs text-muted-foreground">Not yet reached by this run.</p>}

              {actionError && <Notice tone="error">{actionError}</Notice>}

              {isCurrent && run.status === 'running' && (
                <div className="space-y-3 border-t border-border pt-3">
                  {!selectedRunStep?.assignee_name && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-center"
                      disabled={isActing}
                      onClick={() => void act(() => organizationService.claimProcessRunStep(context, runId, selectedNodeKey!))}
                    >
                      <Hand className="size-4" aria-hidden="true" />
                      Claim
                    </Button>
                  )}

                  <Textarea
                    rows={2}
                    placeholder="Notes (optional)"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />

                  {outgoingLabels.length > 1 ? (
                    <div className="space-y-1.5">
                      {outgoingLabels.map((label) => (
                        <Button
                          key={label}
                          size="sm"
                          className="w-full justify-center"
                          disabled={isActing}
                          onClick={() =>
                            void act(() =>
                              organizationService.completeProcessRunStep(context, runId, selectedNodeKey!, { outcome: label, notes }),
                            )
                          }
                        >
                          <CheckCircle2 className="size-4" aria-hidden="true" />
                          {label}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full justify-center"
                      disabled={isActing}
                      onClick={() =>
                        void act(() => organizationService.completeProcessRunStep(context, runId, selectedNodeKey!, { notes }))
                      }
                    >
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                      Complete
                    </Button>
                  )}

                  {canSkip && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-center"
                      disabled={isActing}
                      onClick={() => void act(() => organizationService.skipProcessRunStep(context, runId, selectedNodeKey!))}
                    >
                      <SkipForward className="size-4" aria-hidden="true" />
                      Skip
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="p-4">
            <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Activity className="size-3.5" />
              Activity
            </h4>
            <ul className="space-y-3">
              {(run.events ?? []).map((event) => (
                <li key={event.id} className="text-xs">
                  <p className="text-foreground">
                    {humanizeEvent(event.event_type)}
                    {event.actor_name ? ` · ${event.actor_name}` : ''}
                  </p>
                  <p className="text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p>
                </li>
              ))}
              {(!run.events || run.events.length === 0) && (
                <li className="text-xs text-muted-foreground">No activity recorded yet.</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {cancelConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onClick={() => setCancelConfirmOpen(false)}>
          <div
            className="w-full max-w-sm rounded-lg border border-border bg-background p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm font-semibold text-foreground">Cancel this run?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This stops the process where it is. Already-raised tasks are not removed.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setCancelConfirmOpen(false)}>
                Keep running
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setCancelConfirmOpen(false)
                  void act(() => organizationService.cancelDepartmentProcessRun(context, runId))
                }}
              >
                Cancel run
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
