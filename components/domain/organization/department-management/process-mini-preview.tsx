'use client'

import { useMemo } from 'react'
import { Background, BackgroundVariant, ReactFlow, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'
import type { DepartmentProcessEdge, DepartmentProcessStep } from '@/services/organization'
import { ProcessStepNode, type ProcessStepNodeData } from './process-step-node'

const NODE_W = 150
const NODE_H = 52

/**
 * The library card's animated thumbnail - a glance at a process's shape
 * without opening the builder.
 *
 * Read-only and auto-arranged, the same choice workstream-flow-map.tsx made
 * for the same reason: this is showing structure, not a hand-placed layout,
 * and a saved position_x/position_y that made sense at builder zoom can be
 * tiny or off-screen at thumbnail scale.
 */
export function ProcessMiniPreview({
  steps,
  edges,
  stepTypes,
  active,
}: {
  steps: DepartmentProcessStep[]
  edges: DepartmentProcessEdge[]
  stepTypes: Record<string, { label: string; color: string }>
  /** Published processes get flowing edges - a small, constant reminder this one is live. */
  active?: boolean
}) {
  const nodeTypes = useMemo(() => ({ step: ProcessStepNode }), [])

  const { laidOutNodes, laidOutEdges } = useMemo(
    () => buildPreviewGraph(steps, edges, stepTypes, Boolean(active)),
    [steps, edges, stepTypes, active],
  )

  if (steps.length === 0) {
    return (
      <div className="flex h-28 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
        No steps yet
      </div>
    )
  }

  return (
    <div className="h-28 overflow-hidden rounded-md border border-border bg-muted/20">
      <ReactFlow
        nodes={laidOutNodes}
        edges={laidOutEdges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="opacity-20" />
      </ReactFlow>
    </div>
  )
}

function buildPreviewGraph(
  steps: DepartmentProcessStep[],
  edges: DepartmentProcessEdge[],
  stepTypes: Record<string, { label: string; color: string }>,
  active: boolean,
): { laidOutNodes: Node[]; laidOutEdges: Edge[] } {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: 'TB', nodesep: 20, ranksep: 32, marginx: 8, marginy: 8 })

  steps.forEach((step) => graph.setNode(step.node_key, { width: NODE_W, height: NODE_H }))
  const known = new Set(steps.map((s) => s.node_key))
  edges.forEach((edge) => {
    if (known.has(edge.source_node_key) && known.has(edge.target_node_key)) {
      graph.setEdge(edge.source_node_key, edge.target_node_key)
    }
  })

  dagre.layout(graph)

  const laidOutNodes: Node[] = steps.map((step) => {
    const placed = graph.node(step.node_key)
    const data: ProcessStepNodeData = {
      node_key: step.node_key,
      step_type: step.step_type,
      title: step.title,
      assignee_type: step.assignee_type,
      assignee_value: step.assignee_value,
      sla_value: step.sla_value,
      sla_unit: step.sla_unit,
      linked_sop_id: step.linked_sop_id,
      linked_policy_id: step.linked_policy_id,
      linked_rule_id: step.linked_rule_id,
      stepTypes,
      interactive: false,
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

  const laidOutEdges: Edge[] = edges
    .filter((edge) => known.has(edge.source_node_key) && known.has(edge.target_node_key))
    .map((edge, index) => ({
      id: `e-${index}-${edge.source_node_key}-${edge.target_node_key}`,
      source: edge.source_node_key,
      target: edge.target_node_key,
      type: 'smoothstep',
      animated: active,
      style: { stroke: 'var(--primary)', strokeWidth: 1.5, opacity: 0.6 },
    }))

  return { laidOutNodes, laidOutEdges }
}
