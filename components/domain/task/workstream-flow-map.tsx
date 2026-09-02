'use client'

/**
 * The lifecycle, as a real graph.
 *
 * ── WHY THE OLD MAP HAD TO GO ───────────────────────────────────────────────
 *
 * `workstream-lifecycle-map.tsx` was a CSS grid, and it was wrong in four ways
 * that no amount of restyling fixes:
 *
 * 1. PARALLEL WORK WAS UNREPRESENTABLE. It walked the chain with
 *    `new Map(flow.map(l => [l.from_id, l.to_id]))`. A Map keyed on the source
 *    keeps only the LAST entry, so a workstream feeding two others silently
 *    lost a branch. Real projects run stages in parallel; the diagram could
 *    only ever draw a single file.
 *
 * 2. THE GOVERNANCE BAND DID NOT ACTUALLY SPAN ANYTHING. `gridRow: '1 / -1'`
 *    is a no-op when no explicit rows are declared — `-1` resolves back to
 *    line 1, so it computed to `grid-row: 1 / span 1`. It only looked
 *    full-height because the row stretched.
 *
 * 3. THE "GOVERNS" RELATIONSHIPS WERE NEVER DRAWN. No lines, no brackets. The
 *    band listed the names it governed at the BOTTOM of a tall box, which put
 *    that text at the same eye level as the LAST stage card — which is exactly
 *    why the customer asked "why is the last workstream under the governance".
 *    It was never under it. Nothing said what it was.
 *
 * 4. Two governance workstreams invented extra grid columns and broke the
 *    layout; unconnected workstreams were computed and never rendered; only
 *    the first feedback link was drawn.
 *
 * ── WHY THIS SHAPE ──────────────────────────────────────────────────────────
 *
 * Same library and the same visual language as the task dependency map on the
 * Dependencies screen, so the module has ONE graph idiom rather than two.
 *
 * READ-ONLY AND AUTO-ARRANGED. Nodes are not draggable: the whole claim a
 * lifecycle diagram makes is structural, and a hand-dragged node lets the
 * picture disagree with the connections it is supposed to be drawing. Dagre
 * decides the geometry; the tenant decides the connections.
 *
 * ── THE ONE LOAD-BEARING LINE IN THE LAYOUT ─────────────────────────────────
 *
 * Only FLOW edges go into dagre. Feeding it the others corrupts the picture:
 * a GOVERNS edge ranks the governance node above whatever it governs and drags
 * the whole chain into an order driven by oversight rather than delivery, and
 * a FEEDBACK edge closes a cycle — which dagre resolves by silently REVERSING
 * an edge, scrambling the stage order with no error. Governance is placed
 * afterwards, by measuring the box it spans.
 */

import { useEffect, useMemo, useRef } from 'react'
import {
  Background, BackgroundVariant, Controls, Handle, MarkerType, Panel, Position, ReactFlow,
  useEdgesState, useNodesState, type Edge, type Node, type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'
import { Shield } from 'lucide-react'

import { categoricalColor } from '@/lib/chart-colors'
import { cn } from '@/lib/utils'
import { healthDot } from './workstream-health'
import { orderWorkstreams } from './workstream-order'
import type { WorkstreamHealthState, WorkstreamLink, WorkstreamSummary } from '@/types/task-management'

const STAGE_W = 232
const STAGE_H = 88
const SUB_W = 196
const SUB_H = 62
const GOV_W = 150
const GOV_MIN_H = 132
const GAP = 40

/*
 * React Flow v12 constrains a node's data to `Record<string, unknown>`.
 * Declaring it explicitly keeps the node components typed — the dependencies
 * map sidesteps this with `Record<string, any>` and gets no type safety at all.
 */
interface StageData extends Record<string, unknown> {
  name: string
  code: string | null
  owner: string | null
  state: WorkstreamHealthState
  colour: string | null
  done: number
  total: number
  note: string | null
  onOpen: (id: string) => void
  id: string
}

interface GovernanceData extends Record<string, unknown> {
  name: string
  code: string | null
  state: WorkstreamHealthState
  governs: number
  onOpen: (id: string) => void
  id: string
}

function StageNode({ data, width, height }: { data: StageData; width?: number; height?: number }) {
  const sub = height === SUB_H
  return (
    <div
      className="relative flex h-full w-full flex-col justify-center overflow-hidden rounded-xl border border-border bg-card pl-3 pr-2 shadow-sm"
      style={{ width, height }}
    >
      <Handle type="target" position={Position.Top} className="!size-1.5 !border-0 !bg-muted-foreground/40" />
      {data.colour && (
        <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: data.colour }} aria-hidden="true" />
      )}

      <div className="relative z-10 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn('size-2 shrink-0 rounded-full', healthDot(data.state))} aria-hidden="true" />
          <span className="sr-only">{data.state}</span>
          {data.code && <span className="font-mono text-[10px] text-muted-foreground">{data.code}</span>}
          {data.note && (
            <span className="rounded-full bg-warning/15 px-1.5 text-[9px] font-semibold uppercase tracking-wider text-warning">
              {data.note}
            </span>
          )}
        </div>

        {/* A real button, not onNodeClick — React Flow renders nodes in DOM
            order, so a button here is reachable by keyboard. onNodeClick is
            neither tabbable nor announced. */}
        <button
          type="button"
          onClick={() => data.onOpen(data.id)}
          className="nodrag mt-0.5 block w-full truncate text-left text-[13px] font-semibold leading-tight text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          {data.name}
        </button>

        {!sub && (
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {data.owner ?? 'No owner'}
            {data.total > 0 && <span className="tabular-nums"> · {data.done} of {data.total} done</span>}
          </p>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!size-1.5 !border-0 !bg-muted-foreground/40" />
      <Handle id="gov" type="target" position={Position.Right} className="!size-1.5 !border-0 !bg-transparent" />
    </div>
  )
}

/**
 * The band. Its HEIGHT IS DATA — it is measured to the vertical extent of the
 * stages it governs, which is the claim the old `gridRow: 1 / -1` was trying
 * and failing to make.
 */
function GovernanceNode({ data, width, height }: { data: GovernanceData; width?: number; height?: number }) {
  return (
    <div
      className="flex h-full w-full flex-col gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-3"
      style={{ width, height }}
    >
      <Handle id="gov" type="source" position={Position.Left} className="!size-1.5 !border-0 !bg-transparent" />

      <div className="flex items-center gap-1.5">
        <Shield className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Governance</span>
      </div>

      <div className="min-w-0">
        {data.code && <p className="font-mono text-[10px] text-muted-foreground">{data.code}</p>}
        <button
          type="button"
          onClick={() => data.onOpen(data.id)}
          className="nodrag block w-full text-left text-[13px] font-semibold leading-tight text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          {data.name}
        </button>
      </div>

      <p className="mt-auto text-[10px] leading-snug text-muted-foreground">
        {data.governs > 0
          ? `Spans ${data.governs} stage${data.governs === 1 ? '' : 's'} — it runs across the flow rather than inside it.`
          : 'Not yet linked to any stage.'}
      </p>
    </div>
  )
}

export function WorkstreamFlowMap({
  workstreams, links, onOpen,
}: {
  workstreams: WorkstreamSummary[]
  links: WorkstreamLink[]
  onOpen: (id: string) => void
}) {
  const nodeTypes = useMemo(() => ({ stage: StageNode, governance: GovernanceNode }), [])
  const flowRef = useRef<ReactFlowInstance | null>(null)

  const { built, builtEdges } = useMemo(
    () => buildGraph(workstreams, links, onOpen),
    [workstreams, links, onOpen],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(built)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(builtEdges)

  useEffect(() => { setNodes(built); setEdges(builtEdges) }, [built, builtEdges, setNodes, setEdges])

  /*
   * Re-fit when the graph changes. `fitView` on the initial render runs while
   * the node set is still empty and does nothing; the payload arrives after.
   * maxZoom caps the single-node case, which would otherwise zoom to fill the
   * canvas and read as broken rather than as a project with one workstream.
   */
  useEffect(() => {
    if (nodes.length === 0) return
    const frame = requestAnimationFrame(() => {
      flowRef.current?.fitView({ padding: 0.18, duration: 250, maxZoom: 1.1 })
    })
    return () => cancelAnimationFrame(frame)
  }, [nodes])

  if (workstreams.length === 0) {
    return (
      <div className="m-4 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No workstreams yet. Add one to start building the delivery flow.
      </div>
    )
  }

  return (
    <div className="relative h-full min-h-[22rem] w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={(instance) => { flowRef.current = instance }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        /* The canvas must never eat the page's wheel — it lives inside a
           bounded pane, and a scroll trap reads as "the page is stuck".
           Zoom lives on the Controls. */
        zoomOnScroll={false}
        preventScrolling={false}
        minZoom={0.3}
        maxZoom={1.5}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={2} color="var(--primary)" className="opacity-20" />
        <Controls showInteractive={false} className="overflow-hidden rounded-xl border border-primary/20 bg-card/95 fill-primary text-primary shadow-2xl backdrop-blur-xl" />

        {/* The legend is not optional. Three line styles carry three different
            relationships, and the customer had to ask what the edge captions
            meant — so the diagram answers it rather than a tooltip. */}
        <Panel position="top-left" className="rounded-md border bg-card/85 px-2 py-1.5 backdrop-blur">
          <ul className="space-y-1 text-[10px] text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <Swatch className="border-t-2 border-solid border-primary" /> Feeds into — the delivery chain
            </li>
            <li className="flex items-center gap-1.5">
              <Swatch className="border-t-2 border-dashed border-warning" /> Feeds back into — closes the loop
            </li>
            <li className="flex items-center gap-1.5">
              <Swatch className="border-t-2 border-dotted border-muted-foreground" /> Governs — spans the stages
            </li>
            <li className="pt-0.5 italic">A label on a line is what passes between the two.</li>
          </ul>
        </Panel>
      </ReactFlow>
    </div>
  )
}

function Swatch({ className }: { className: string }) {
  return <span className={cn('inline-block h-0 w-5 shrink-0', className)} aria-hidden="true" />
}

/* ------------------------------------------------------------------ */

function buildGraph(
  workstreams: WorkstreamSummary[],
  links: WorkstreamLink[],
  onOpen: (id: string) => void,
): { built: Node[]; builtEdges: Edge[] } {
  const { stages, governance, unconnected, children, orphans, colorOrder } =
    orderWorkstreams(workstreams, links)

  const stageLike = [...stages, ...unconnected, ...orphans]
  const nodes: Node[] = []

  const stageData = (w: WorkstreamSummary, note: string | null): StageData => ({
    id: w.id,
    name: w.name,
    code: w.code,
    owner: w.owner_name,
    state: w.health.state,
    colour: categoricalColor(w.id, colorOrder),
    done: w.health.deliverables.done + w.health.tasks.completed,
    total: w.health.deliverables.total + w.health.tasks.total,
    note,
    onOpen,
  })

  const unconnectedIds = new Set(unconnected.map((w) => w.id))
  const orphanIds = new Set(orphans.map((w) => w.id))

  for (const w of stageLike) {
    nodes.push({
      id: w.id,
      type: 'stage',
      position: { x: 0, y: 0 },
      width: STAGE_W,
      height: STAGE_H,
      data: stageData(
        w,
        orphanIds.has(w.id) ? 'Parent missing' : unconnectedIds.has(w.id) ? 'Not in the flow' : null,
      ),
    })
  }

  // Children are nodes too. The old diagram filtered `parent_id` out entirely,
  // which left the deleted tile grid as the ONLY place a sub-workstream was
  // visible anywhere in the product.
  const containsEdges: Edge[] = []
  for (const [parentId, kids] of children) {
    for (const kid of kids) {
      nodes.push({
        id: kid.id,
        type: 'stage',
        position: { x: 0, y: 0 },
        width: SUB_W,
        height: SUB_H,
        data: stageData(kid, null),
      })
      containsEdges.push({
        id: `contains-${parentId}-${kid.id}`,
        source: parentId,
        target: kid.id,
        style: { stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '2 3' },
      })
    }
  }

  const flow = links.filter((l) => l.link_type === 'FLOW')
  const feedback = links.filter((l) => l.link_type === 'FEEDBACK')
  const governs = links.filter((l) => l.link_type === 'GOVERNS')
  const onCanvas = new Set(nodes.map((n) => n.id))

  const flowEdges: Edge[] = flow
    .filter((l) => onCanvas.has(l.from_id) && onCanvas.has(l.to_id))
    .map((l) => ({
      id: `flow-${l.id}`,
      source: l.from_id,
      target: l.to_id,
      type: 'smoothstep',
      label: l.label ?? undefined,
      labelStyle: { fontSize: 10, fill: 'var(--muted-foreground)' },
      labelBgStyle: { fill: 'var(--card)' },
      labelBgPadding: [4, 2] as [number, number],
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: 'var(--primary)' },
      style: { stroke: 'var(--primary)', strokeWidth: 2 },
    }))

  // ── layout: FLOW and containment only ──────────────────────────────────
  const positioned = layout(nodes, [...flowEdges, ...containsEdges])

  // ── the band, measured against what it actually governs ────────────────
  const box = positioned.reduce(
    (acc, n) => ({
      maxX: Math.max(acc.maxX, n.position.x + (n.width ?? STAGE_W)),
      minY: Math.min(acc.minY, n.position.y),
    }),
    { maxX: 0, minY: Number.POSITIVE_INFINITY },
  )
  const byId = new Map(positioned.map((n) => [n.id, n]))

  governance.forEach((g, index) => {
    const targets = governs
      .filter((l) => l.from_id === g.id)
      .map((l) => byId.get(l.to_id))
      .filter(Boolean) as Node[]

    const top = targets.length
      ? Math.min(...targets.map((t) => t.position.y))
      : (Number.isFinite(box.minY) ? box.minY : 0)
    const bottom = targets.length
      ? Math.max(...targets.map((t) => t.position.y + (t.height ?? STAGE_H)))
      : top + GOV_MIN_H

    positioned.push({
      id: g.id,
      type: 'governance',
      position: { x: box.maxX + GAP + index * (GOV_W + GAP), y: top },
      width: GOV_W,
      height: Math.max(bottom - top, GOV_MIN_H),
      data: {
        id: g.id, name: g.name, code: g.code, state: g.health.state,
        governs: targets.length, onOpen,
      } satisfies GovernanceData,
    })
  })

  const governsEdges: Edge[] = governs
    .filter((l) => byId.has(l.to_id) && governance.some((g) => g.id === l.from_id))
    .map((l) => ({
      id: `governs-${l.id}`,
      source: l.from_id,
      target: l.to_id,
      sourceHandle: 'gov',
      targetHandle: 'gov',
      type: 'smoothstep',
      // No arrowhead: governance does not flow INTO a stage, it brackets it.
      style: { stroke: 'var(--muted-foreground)', strokeWidth: 1.5, strokeDasharray: '2 4', opacity: 0.6 },
    }))

  const feedbackEdges: Edge[] = feedback
    .filter((l) => onCanvas.has(l.from_id) && onCanvas.has(l.to_id))
    .map((l) => ({
      id: `feedback-${l.id}`,
      source: l.from_id,
      target: l.to_id,
      type: 'smoothstep',
      animated: true,
      label: l.label ?? undefined,
      labelStyle: { fontSize: 10, fill: 'var(--muted-foreground)' },
      labelBgStyle: { fill: 'var(--card)' },
      labelBgPadding: [4, 2] as [number, number],
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: 'var(--chart-orange)' },
      style: { stroke: 'var(--chart-orange)', strokeWidth: 2, strokeDasharray: '6 4' },
    }))

  return { built: positioned, builtEdges: [...flowEdges, ...containsEdges, ...feedbackEdges, ...governsEdges] }
}

function layout(nodes: Node[], edges: Edge[]): Node[] {
  if (!nodes.length) return nodes

  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: 'TB', nodesep: 44, ranksep: 76, marginx: 24, marginy: 24 })

  const known = new Set(nodes.map((n) => n.id))
  nodes.forEach((n) => graph.setNode(n.id, { width: n.width ?? STAGE_W, height: n.height ?? STAGE_H }))
  edges.forEach((e) => {
    // An edge to a node that is not on the canvas would make dagre invent one.
    if (known.has(e.source) && known.has(e.target)) graph.setEdge(e.source, e.target)
  })

  dagre.layout(graph)

  return nodes.map((n) => {
    const placed = graph.node(n.id)
    if (!placed) return n
    const w = n.width ?? STAGE_W
    const h = n.height ?? STAGE_H
    // dagre returns the CENTRE; React Flow positions by the top-left corner.
    return { ...n, position: { x: placed.x - w / 2, y: placed.y - h / 2 } }
  })
}
