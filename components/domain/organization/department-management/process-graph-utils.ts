import dagre from '@dagrejs/dagre'
import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { ProcessStepNodeData } from './process-step-node'
import { stepLabel } from './process-step-node'
import type { ProcessConversionStep } from '@/services/organization'

/**
 * Shared between the canvas builder (ProcessCanvasBuilder - drag/drop, Tidy
 * Layout) and the K12-style converter panel (ProcessSourcePanel, via
 * ProcessCanvasBuilder.handleApplyFromSource - real-time fills the canvas
 * from parsed steps). Kept in one place so
 * the two never drift into two slightly different ideas of "a step
 * becomes a node."
 */

export function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'n-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const TIDY_NODE_W = 200
const TIDY_NODE_H = 70

/** Re-arranges a graph top-to-bottom with dagre. */
export function tidyLayout(nodes: Node[], edges: Edge[]): Node[] {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: 'TB', nodesep: 48, ranksep: 80, marginx: 40, marginy: 40 })

  nodes.forEach((n) => graph.setNode(n.id, { width: TIDY_NODE_W, height: TIDY_NODE_H }))
  const known = new Set(nodes.map((n) => n.id))
  edges.forEach((e) => {
    if (known.has(e.source) && known.has(e.target)) graph.setEdge(e.source, e.target)
  })

  dagre.layout(graph)

  return nodes.map((n) => {
    const placed = graph.node(n.id)
    if (!placed) return n
    return { ...n, position: { x: placed.x - TIDY_NODE_W / 2, y: placed.y - TIDY_NODE_H / 2 } }
  })
}

function makeNode(
  id: string,
  stepType: string,
  title: string,
  stepTypes: Record<string, { label: string; color: string }>,
  extra: Partial<ProcessStepNodeData> = {},
): Node {
  return {
    id,
    type: 'step',
    position: { x: 0, y: 0 },
    data: {
      node_key: id,
      step_type: stepType,
      title,
      is_required: true,
      stepTypes,
      interactive: true,
      ...extra,
    } satisfies ProcessStepNodeData,
  }
}

/**
 * A converted procedure's steps, turned into a linear Start -> ... -> End
 * graph, auto-arranged - what both "Apply to Canvas" (inside the canvas
 * builder) and "Save the process" (the converter panel) call. A step whose
 * actor is an "ai"/"person_ai" type still becomes a task/approval node (the
 * canvas has no separate "automated step" node type); only the assignee is
 * left unset for an AI-only step, consistent with the panel's own "will
 * need an assignee after applying" note.
 */
export function buildLinearGraph(
  steps: Array<Pick<ProcessConversionStep, 'actor' | 'actor_type' | 'is_approval'> & { title: string }>,
  stepTypes: Record<string, { label: string; color: string }>,
): { nodes: Node[]; edges: Edge[] } {
  const startKey = genId()
  const endKey = genId()
  const stepKeys = steps.map(() => genId())
  const chain = [startKey, ...stepKeys, endKey]

  const nodes: Node[] = [
    makeNode(startKey, 'start', stepLabel('start', stepTypes), stepTypes),
    ...steps.map((step, index) =>
      makeNode(stepKeys[index], step.is_approval ? 'approval' : 'task', step.title, stepTypes, {
        ...(step.actor_type !== 'ai' && step.actor ? { assignee_type: 'role', assignee_value: step.actor } : {}),
      }),
    ),
    makeNode(endKey, 'end', stepLabel('end', stepTypes), stepTypes),
  ]

  const edges: Edge[] = chain.slice(0, -1).map((source, index) => ({
    id: genId(),
    source,
    target: chain[index + 1],
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    style: { stroke: 'var(--primary)', strokeWidth: 2 },
  }))

  return { nodes: tidyLayout(nodes, edges), edges }
}
