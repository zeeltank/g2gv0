/**
 * ONE ordering, used by both the diagram and the list.
 *
 * This walk used to live only inside `workstream-lifecycle-map.tsx`. Once a
 * list sits beside the diagram showing the same workstreams, two independent
 * orderings is two answers to "what order are these in?" — and the one the
 * user would trust is whichever they happened to look at first.
 *
 * ── AND THE PART THAT WAS ABOUT TO BE LOST ──────────────────────────────────
 *
 * The diagram filters to `!w.parent_id` — sub-workstreams are deliberately not
 * stages, because a stage is a phase of delivery and a lane inside a phase is
 * not. That was safe only while the tile grid below it rendered EVERY
 * workstream, children included. The grid is going, so this module is now the
 * thing that guarantees a child is still reachable: `children` groups them
 * under their parent, and the list pane indents them there.
 *
 * Anything with a `parent_id` pointing at a workstream that no longer exists
 * is surfaced as a root rather than silently dropped — an orphan you can see
 * is a data problem someone can fix; an orphan you cannot see is a support
 * ticket about a workstream that "disappeared".
 */

import type { WorkstreamLink, WorkstreamSummary } from '@/types/task-management'

export interface OrderedWorkstreams {
  /** DELIVERY, no parent, walked along the FLOW edges. */
  stages: WorkstreamSummary[]
  /** GOVERNANCE, no parent. Spans the flow rather than sitting in it. */
  governance: WorkstreamSummary[]
  /** Delivery roots the FLOW walk never reached, in `sort_order`. */
  unconnected: WorkstreamSummary[]
  /** parent id → its children, in `sort_order`. */
  children: Map<string, WorkstreamSummary[]>
  /** Children whose parent is missing from the payload. Never hidden. */
  orphans: WorkstreamSummary[]
  /** Stable identity order for `categoricalColor`, name-sorted so filtering
   *  or reordering never repaints a workstream. */
  colorOrder: string[]
}

export function orderWorkstreams(
  workstreams: WorkstreamSummary[],
  links: WorkstreamLink[],
): OrderedWorkstreams {
  const byId = new Map(workstreams.map((w) => [w.id, w]))
  const bySort = (a: WorkstreamSummary, b: WorkstreamSummary) => a.sort_order - b.sort_order

  const children = new Map<string, WorkstreamSummary[]>()
  const orphans: WorkstreamSummary[] = []

  for (const w of workstreams) {
    if (!w.parent_id) continue
    if (!byId.has(w.parent_id)) { orphans.push(w); continue }
    const bucket = children.get(w.parent_id)
    if (bucket) bucket.push(w)
    else children.set(w.parent_id, [w])
  }
  for (const bucket of children.values()) bucket.sort(bySort)
  orphans.sort(bySort)

  const roots = workstreams.filter((w) => !w.parent_id || !byId.has(w.parent_id!))
  const delivery = roots.filter((w) => w.kind === 'DELIVERY' && !w.parent_id)
  const governance = roots.filter((w) => w.kind === 'GOVERNANCE' && !w.parent_id).sort(bySort)

  /*
   * Stage order comes from the FLOW edges, not from `sort_order` — the graph
   * is the authority. A topological walk from whatever has no predecessor;
   * anything the walk does not reach keeps its sort_order position, so a
   * project with no links at all still renders a sensible list.
   */
  const flow = links.filter((l) => l.link_type === 'FLOW')
  const hasPredecessor = new Set(flow.map((l) => l.to_id))
  const deliveryById = new Map(delivery.map((w) => [w.id, w]))

  /*
   * ── PARALLEL BRANCHES WERE BEING SILENTLY DROPPED ────────────────────────
   *
   * This was `new Map<string, string>(flow.map(l => [l.from_id, l.to_id]))`.
   * A Map keyed on the source keeps only the LAST entry for that key — so a
   * workstream feeding two others lost one of them, with no error and nothing
   * on screen to suggest anything was missing. Real projects run stages in
   * parallel; the walk could only ever follow a single file.
   *
   * Now every successor is kept, and the walk is a depth-first traversal over
   * the `seen` set that already existed. Each bucket is sorted by `sort_order`
   * so a branching graph still produces a stable, repeatable order.
   */
  const next = new Map<string, string[]>()
  for (const l of flow) {
    const bucket = next.get(l.from_id)
    if (bucket) bucket.push(l.to_id)
    else next.set(l.from_id, [l.to_id])
  }
  for (const bucket of next.values()) {
    bucket.sort((a, b) => (deliveryById.get(a)?.sort_order ?? 0) - (deliveryById.get(b)?.sort_order ?? 0))
  }

  const stages: WorkstreamSummary[] = []
  const seen = new Set<string>()

  for (const start of delivery.filter((w) => !hasPredecessor.has(w.id)).sort(bySort)) {
    const stack = [start.id]
    while (stack.length > 0) {
      const cursor = stack.pop()!
      if (seen.has(cursor) || !deliveryById.has(cursor)) continue
      seen.add(cursor)
      stages.push(deliveryById.get(cursor)!)
      // Reversed so the lowest sort_order is visited first out of the stack.
      const successors = next.get(cursor) ?? []
      for (let i = successors.length - 1; i >= 0; i--) stack.push(successors[i])
    }
  }

  return {
    stages,
    governance,
    unconnected: delivery.filter((w) => !seen.has(w.id)).sort(bySort),
    children,
    orphans,
    colorOrder: [...workstreams].sort((a, b) => a.name.localeCompare(b.name)).map((w) => w.id),
  }
}
