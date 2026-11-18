'use client'

import * as React from 'react'
import { Minus, Plus, Maximize2 } from 'lucide-react'
import type { Employee } from '@/types/employee'

type Props = {
  employees: Employee[]
  onOpen: (employee: Employee) => void
}

type Placed = { employee: Employee; x: number; y: number }
type Blob = { key: string; name: string; hue: number }

/** A node while the simulation runs: position, velocity, and whether the user is holding it. */
type Body = { x: number; y: number; vx: number; vy: number; fixed: boolean }

const NODE_R = 16
const CENTER_R = 22
const BLOB_PAD = 30

// Simulation tuning. Springs hold the shape the layout started with, so a
// drag stretches the graph and the rest of it follows, then settles.
const LINK_K = 0.02
const LINK_SLACK = 1.5
const COHESION_K = 0.012
const REPULSE = 600
const REPULSE_RANGE = 220
const MIN_GAP = 70
const DAMPING = 0.75

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}

function shorten(name: string, max = 14) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name
}

function deptKey(e: Employee) {
  return e.department_name || 'Unassigned'
}

/**
 * Lays the organisation out as a hub-and-cluster graph: the head of the
 * hierarchy in the middle, one cluster per department around it, and a line
 * from each person to their reporting manager (or to the hub when their
 * manager is not in the loaded set). This is only the starting position; the
 * simulation moves things from here.
 */
function buildLayout(employees: Employee[]) {
  const ids = new Set(employees.map((e) => String(e.id)))
  const managerOf = (e: Employee) => {
    const m = e.reporting_manager_id != null ? String(e.reporting_manager_id) : ''
    return m && m !== String(e.id) && ids.has(m) ? m : ''
  }

  const roots = employees.filter((e) => !managerOf(e))
  let center: Employee | null = null
  if (roots.length === 1) {
    center = roots[0]
  } else if (roots.length > 1) {
    // Most direct reports wins; ties fall to the first listed.
    const counts = new Map<string, number>()
    for (const e of employees) {
      const m = managerOf(e)
      if (m) counts.set(m, (counts.get(m) ?? 0) + 1)
    }
    center = [...roots].sort((a, b) => (counts.get(String(b.id)) ?? 0) - (counts.get(String(a.id)) ?? 0))[0]
  }

  const groups = new Map<string, Employee[]>()
  for (const e of employees) {
    if (center && e.id === center.id) continue
    const key = deptKey(e)
    groups.set(key, [...(groups.get(key) ?? []), e])
  }

  const entries = [...groups.entries()]
  const radii = entries.map(([, members]) => (members.length === 1 ? 34 : 40 + members.length * 14))
  // How far from its centre a department may stretch before cohesion pulls it back.
  const clusterRadius = new Map<string, number>()
  const ring = Math.max(230, radii.reduce((sum, r) => sum + 2 * r + 40, 0) / (2 * Math.PI))

  const placed = new Map<string, Placed>()
  const blobs: Blob[] = []
  if (center) placed.set(String(center.id), { employee: center, x: 0, y: 0 })

  entries.forEach(([name, members], i) => {
    const angle = (2 * Math.PI * i) / Math.max(entries.length, 1) - Math.PI / 2
    const cx = Math.cos(angle) * ring
    const cy = Math.sin(angle) * ring
    const r = radii[i]
    blobs.push({ key: name, name, hue: (i * 67 + 210) % 360 })
    clusterRadius.set(name, members.length === 1 ? 0 : r * 0.7 * 1.25)

    members.forEach((e, j) => {
      if (members.length === 1) {
        placed.set(String(e.id), { employee: e, x: cx, y: cy })
        return
      }
      const a = (2 * Math.PI * j) / members.length + angle
      placed.set(String(e.id), { employee: e, x: cx + Math.cos(a) * r * 0.7, y: cy + Math.sin(a) * r * 0.7 })
    })
  })

  const links: { from: string; to: string; key: string; rest: number }[] = []
  const hub = center ? placed.get(String(center.id)) : undefined
  for (const p of placed.values()) {
    if (center && p.employee.id === center.id) continue
    const m = managerOf(p.employee)
    const target = (m && placed.get(m)) || hub
    if (target && target !== p) {
      links.push({
        from: String(target.employee.id),
        to: String(p.employee.id),
        key: `${target.employee.id}-${p.employee.id}`,
        rest: Math.max(40, Math.hypot(target.x - p.x, target.y - p.y)),
      })
    }
  }

  const extent = ring + Math.max(0, ...radii) + 70
  return { placed: [...placed.values()], blobs, links, center: hub, extent, clusterRadius }
}

/**
 * Manager view: no department clusters, only reporting lines, drawn as a
 * radial tree with the head of the hierarchy in the middle. Anyone who has no
 * manager in the loaded set hangs off the hub so nobody floats alone.
 */
function buildManagerLayout(employees: Employee[]): ReturnType<typeof buildLayout> {
  const ids = new Set(employees.map((e) => String(e.id)))
  const managerOf = (e: Employee) => {
    const m = e.reporting_manager_id != null ? String(e.reporting_manager_id) : ''
    return m && m !== String(e.id) && ids.has(m) ? m : ''
  }

  const childrenOf = new Map<string, Employee[]>()
  for (const e of employees) {
    const m = managerOf(e)
    if (m) childrenOf.set(m, [...(childrenOf.get(m) ?? []), e])
  }

  const roots = employees.filter((e) => !managerOf(e))
  const hub = [...(roots.length ? roots : employees)].sort(
    (a, b) => (childrenOf.get(String(b.id))?.length ?? 0) - (childrenOf.get(String(a.id))?.length ?? 0),
  )[0]

  // Tree under the hub. Other roots become its children; `seen` also breaks reporting loops.
  const seen = new Set<string>([String(hub.id)])
  type TreeNode = { employee: Employee; children: TreeNode[]; leaves: number; depth: number }
  const grow = (e: Employee, depth: number): TreeNode => {
    const kids = (childrenOf.get(String(e.id)) ?? []).filter((c) => !seen.has(String(c.id)))
    kids.forEach((c) => seen.add(String(c.id)))
    const children = kids.map((c) => grow(c, depth + 1))
    return { employee: e, children, depth, leaves: children.length ? children.reduce((s, c) => s + c.leaves, 0) : 1 }
  }
  const tree = grow(hub, 0)
  for (const e of employees) {
    if (seen.has(String(e.id))) continue
    seen.add(String(e.id))
    const node = grow(e, 1)
    tree.children.push(node)
    tree.leaves += node.leaves
  }

  // Radius per depth: wide enough that the nodes on a ring do not touch.
  const perDepth = new Map<number, number>()
  const count = (n: TreeNode) => {
    perDepth.set(n.depth, (perDepth.get(n.depth) ?? 0) + 1)
    n.children.forEach(count)
  }
  count(tree)
  const radiusAt = new Map<number, number>([[0, 0]])
  const maxDepth = Math.max(...perDepth.keys())
  for (let d = 1; d <= maxDepth; d++) {
    const needed = ((perDepth.get(d) ?? 0) * 85) / (2 * Math.PI)
    radiusAt.set(d, Math.max((radiusAt.get(d - 1) ?? 0) + 140, needed))
  }

  const placed = new Map<string, Placed>()
  const links: { from: string; to: string; key: string; rest: number }[] = []
  const lay = (n: TreeNode, a0: number, a1: number, parent?: Placed) => {
    const angle = (a0 + a1) / 2
    const r = radiusAt.get(n.depth) ?? 0
    const p: Placed = { employee: n.employee, x: Math.cos(angle) * r, y: Math.sin(angle) * r }
    placed.set(String(n.employee.id), p)
    if (parent) {
      links.push({
        from: String(parent.employee.id),
        to: String(n.employee.id),
        key: `${parent.employee.id}-${n.employee.id}`,
        rest: Math.max(40, Math.hypot(parent.x - p.x, parent.y - p.y)),
      })
    }
    let cursor = a0
    for (const c of n.children) {
      const span = ((a1 - a0) * c.leaves) / n.leaves
      lay(c, cursor, cursor + span, p)
      cursor += span
    }
  }
  lay(tree, -Math.PI / 2, (3 * Math.PI) / 2)

  return {
    placed: [...placed.values()],
    blobs: [],
    links,
    center: placed.get(String(hub.id)),
    extent: (radiusAt.get(maxDepth) ?? 0) + 90,
    clusterRadius: new Map<string, number>(),
  }
}

/** Convex hull (monotone chain). */
function convexHull(points: { x: number; y: number }[]) {
  if (points.length < 3) return points
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (o: typeof pts[0], a: typeof pts[0], b: typeof pts[0]) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower: typeof pts = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: typeof pts = []
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

function Node({
  p,
  r,
  onGrab,
  isCenter,
  label,
}: {
  p: Placed
  r: number
  onGrab: (event: React.PointerEvent, e: Employee) => void
  isCenter?: boolean
  label: string
}) {
  const e = p.employee
  const clipId = `clip-${e.id}`
  const inactive = e.status_code !== 1
  return (
    <g
      transform={`translate(${p.x} ${p.y})`}
      onPointerDown={(event) => onGrab(event, e)}
      className="cursor-move"
      opacity={inactive ? 0.55 : 1}
    >
      <title>{`${e.full_name}${e.jobRole ? ` · ${e.jobRole}` : ''}${e.department_name ? ` · ${e.department_name}` : ''}`}</title>
      <defs>
        <clipPath id={clipId}>
          <circle r={r} />
        </clipPath>
      </defs>
      <circle r={r + 2} fill="var(--background, #fff)" stroke="currentColor" strokeOpacity={isCenter ? 0.7 : 0.35} strokeWidth={isCenter ? 2 : 1} />
      <circle r={r} fill="var(--muted, #eef)" />
      <text textAnchor="middle" dy="0.35em" fontSize={r * 0.7} fontWeight={600} fill="currentColor" opacity={0.7}>
        {initials(e.full_name)}
      </text>
      {e.image ? (
        <image
          href={e.image}
          x={-r}
          y={-r}
          width={r * 2}
          height={r * 2}
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid slice"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
      ) : null}
      <text y={r + 12} textAnchor="middle" fontSize={10} fill="currentColor">
        {shorten(label, 16)}
      </text>
    </g>
  )
}

type Drag =
  | { kind: 'pan'; x: number; y: number; vx: number; vy: number }
  | {
      kind: 'bodies'
      x: number
      y: number
      origins: Record<string, { x: number; y: number }>
      employee: Employee | null
      dragged: boolean
    }

export function EmployeeNetworkView({ employees, onOpen }: Props) {
  // Inactive people are left out of the graph. Anyone who reported to them
  // falls back to the hub, since their manager is no longer in the set.
  const active = React.useMemo(() => employees.filter((e) => e.status_code === 1), [employees])
  // Controls panel, as in the reference: Titles (what the label under a node
  // says) and Connections (what the lines and shaded groups represent).
  const [panelTab, setPanelTab] = React.useState<'titles' | 'connections'>('titles')
  const [labelMode, setLabelMode] = React.useState<'name' | 'title'>('name')
  const [connection, setConnection] = React.useState<'department' | 'manager'>('department')

  const layout = React.useMemo(
    () => (connection === 'manager' && active.length > 0 ? buildManagerLayout(active) : buildLayout(active)),
    [active, connection],
  )

  const [view, setView] = React.useState({ x: 0, y: 0, k: 1 })
  const [, setFrame] = React.useState(0)
  const drag = React.useRef<Drag | null>(null)
  const svgRef = React.useRef<SVGSVGElement | null>(null)
  const bodies = React.useRef<Map<string, Body>>(new Map())
  const raf = React.useRef<number | null>(null)

  const reset = React.useCallback(() => {
    const map = new Map<string, Body>()
    for (const p of layout.placed) map.set(String(p.employee.id), { x: p.x, y: p.y, vx: 0, vy: 0, fixed: false })
    bodies.current = map
    setFrame((n) => n + 1)
  }, [layout])

  // Re-seed from the computed layout when the data changes. Done during the
  // first render of a new layout so the old positions never paint against it.
  React.useMemo(() => {
    const map = new Map<string, Body>()
    for (const p of layout.placed) map.set(String(p.employee.id), { x: p.x, y: p.y, vx: 0, vy: 0, fixed: false })
    bodies.current = map
  }, [layout])

  React.useEffect(() => {
    setView({ x: 0, y: 0, k: 1 })
  }, [layout])

  const memberIds = React.useMemo(() => {
    const byDept = new Map<string, string[]>()
    for (const p of layout.placed) {
      if (layout.center && p.employee.id === layout.center.employee.id) continue
      const key = deptKey(p.employee)
      byDept.set(key, [...(byDept.get(key) ?? []), String(p.employee.id)])
    }
    return byDept
  }, [layout])

  const step = React.useCallback(() => {
    const map = bodies.current
    const list = [...map.entries()]
    const force = new Map<string, { x: number; y: number }>()
    for (const [id] of list) force.set(id, { x: 0, y: 0 })

    // Nodes push each other apart so clusters do not pile onto one another.
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i][1]
        const b = list[j][1]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d2 = dx * dx + dy * dy
        if (d2 > REPULSE_RANGE * REPULSE_RANGE) continue
        const d = Math.sqrt(Math.max(d2, 1))
        // Inverse-square push, plus a firm shove once two nodes (and their
        // name labels) would touch, so a crowded department stays readable.
        const f = Math.min(REPULSE / Math.max(d2, 100), 3) + (d < MIN_GAP ? (MIN_GAP - d) * 0.12 : 0)
        const fa = force.get(list[i][0])!
        const fb = force.get(list[j][0])!
        fa.x -= (dx / d) * f
        fa.y -= (dy / d) * f
        fb.x += (dx / d) * f
        fb.y += (dy / d) * f
      }
    }

    // Reporting lines act as springs.
    for (const l of layout.links) {
      const a = map.get(l.from)
      const b = map.get(l.to)
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.max(Math.hypot(dx, dy), 1)
      // A slack rope, not a rigid spring: it only pulls once stretched well
      // past its natural length, so moving one node tugs its neighbours when
      // dragged far, instead of dragging the whole graph along.
      const slack = l.rest * LINK_SLACK + 30
      if (d <= slack) continue
      const f = LINK_K * (d - slack)
      const fa = force.get(l.from)!
      const fb = force.get(l.to)!
      fa.x += (dx / d) * f
      fa.y += (dy / d) * f
      fb.x -= (dx / d) * f
      fb.y -= (dy / d) * f
    }

    // Each department is pulled toward its own centre, which keeps it a cluster.
    // Only beyond its natural radius, so cohesion never squeezes members together.
    for (const [key, ids] of memberIds.entries()) {
      const members = ids.map((id) => map.get(id)).filter(Boolean) as Body[]
      if (members.length < 2) continue
      const limit = layout.clusterRadius.get(key) ?? 100
      const cx = members.reduce((s, m) => s + m.x, 0) / members.length
      const cy = members.reduce((s, m) => s + m.y, 0) / members.length
      for (const id of ids) {
        const m = map.get(id)
        const f = force.get(id)
        if (!m || !f) continue
        const dx = cx - m.x
        const dy = cy - m.y
        const d = Math.hypot(dx, dy)
        if (d <= limit) continue
        f.x += (dx / d) * (d - limit) * COHESION_K
        f.y += (dy / d) * (d - limit) * COHESION_K
      }
    }

    let energy = 0
    for (const [id, b] of list) {
      if (b.fixed) {
        b.vx = 0
        b.vy = 0
        continue
      }
      const f = force.get(id)!
      b.vx = (b.vx + f.x) * DAMPING
      b.vy = (b.vy + f.y) * DAMPING
      b.x += b.vx
      b.y += b.vy
      energy += Math.abs(b.vx) + Math.abs(b.vy)
    }
    return energy
  }, [layout, memberIds])

  const run = React.useCallback(() => {
    if (raf.current != null) return
    const tick = () => {
      const energy = step()
      setFrame((n) => n + 1)
      const holding = drag.current?.kind === 'bodies'
      if (holding || energy > 0.05 * Math.max(bodies.current.size, 1)) {
        raf.current = requestAnimationFrame(tick)
      } else {
        raf.current = null
      }
    }
    raf.current = requestAnimationFrame(tick)
  }, [step])

  React.useEffect(
    () => () => {
      if (raf.current != null) cancelAnimationFrame(raf.current)
      raf.current = null
    },
    [],
  )

  // Wheel zoom needs a non-passive listener to stop the page scrolling.
  React.useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1
      setView((v) => ({ ...v, k: Math.min(4, Math.max(0.4, v.k * factor)) }))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  /** Start dragging a node, an edge's two ends, or every member of a department. */
  function grab(event: React.PointerEvent, ids: string[], employee: Employee | null) {
    event.stopPropagation()
    const origins: Record<string, { x: number; y: number }> = {}
    for (const id of ids) {
      const b = bodies.current.get(id)
      if (b) {
        origins[id] = { x: b.x, y: b.y }
        b.fixed = true
      }
    }
    drag.current = { kind: 'bodies', x: event.clientX, y: event.clientY, origins, employee, dragged: false }
    svgRef.current?.setPointerCapture(event.pointerId)
    run()
  }

  function release() {
    const d = drag.current
    drag.current = null
    if (d?.kind === 'bodies') {
      for (const id of Object.keys(d.origins)) {
        const b = bodies.current.get(id)
        if (b) b.fixed = false
      }
      if (!d.dragged && d.employee) onOpen(d.employee)
      run()
    }
  }

  if (active.length === 0) {
    return <div className="py-10 text-center text-sm text-muted-foreground">No active employees to show.</div>
  }

  const E = layout.extent
  const zoom = (factor: number) => setView((v) => ({ ...v, k: Math.min(4, Math.max(0.4, v.k * factor)) }))
  const pos = (id: string) => bodies.current.get(id) ?? { x: 0, y: 0 }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`${-E} ${-E} ${E * 2} ${E * 2}`}
        className="h-[640px] w-full cursor-grab touch-none select-none text-foreground active:cursor-grabbing"
        onPointerDown={(event) => {
          drag.current = { kind: 'pan', x: event.clientX, y: event.clientY, vx: view.x, vy: view.y }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          const d = drag.current
          if (!d) return
          const rect = event.currentTarget.getBoundingClientRect()
          const scale = (E * 2) / Math.min(rect.width, rect.height)
          const dx = event.clientX - d.x
          const dy = event.clientY - d.y
          if (d.kind === 'pan') {
            setView((v) => ({ ...v, x: d.vx + dx * scale, y: d.vy + dy * scale }))
            return
          }
          // Under 4px is still a click, not a drag.
          if (!d.dragged && Math.hypot(dx, dy) < 4) return
          d.dragged = true
          for (const [id, o] of Object.entries(d.origins)) {
            const b = bodies.current.get(id)
            if (!b) continue
            b.x = o.x + (dx * scale) / view.k
            b.y = o.y + (dy * scale) / view.k
            b.vx = 0
            b.vy = 0
          }
          run()
        }}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {layout.blobs.map((b) => {
            const ids = memberIds.get(b.key) ?? []
            const pts = ids.map((id) => pos(id))
            if (pts.length === 0) return null
            const hull = convexHull(pts)
            const path =
              hull.length === 1
                ? `M ${hull[0].x} ${hull[0].y} l 0.01 0`
                : `M ${hull.map((p) => `${p.x} ${p.y}`).join(' L ')}${hull.length > 2 ? ' Z' : ''}`
            const top = Math.min(...pts.map((p) => p.y)) - BLOB_PAD - 8
            const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
            const color = `hsl(${b.hue} 70% 55%)`
            return (
              <g key={b.key} className="cursor-move" onPointerDown={(event) => grab(event, ids, null)}>
                {/* Group opacity so the fill and its thick rounded stroke read as one soft shape. */}
                <g opacity={0.16}>
                  <path d={path} fill={color} stroke={color} strokeWidth={BLOB_PAD * 2} strokeLinejoin="round" strokeLinecap="round" />
                </g>
                <text x={cx} y={top} textAnchor="middle" fontSize={13} fontWeight={600} fill="currentColor" pointerEvents="none">
                  {b.name}
                </text>
              </g>
            )
          })}

          {layout.links.map((l) => {
            const a = pos(l.from)
            const b = pos(l.to)
            return (
              <g key={l.key} className="cursor-move" onPointerDown={(event) => grab(event, [l.from, l.to], null)}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor" strokeOpacity={0.3} />
                {/* Wide invisible stroke so a thin line is easy to catch. */}
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={12} />
              </g>
            )
          })}

          {layout.placed.map((p) => {
            const b = pos(String(p.employee.id))
            const isCenter = layout.center?.employee.id === p.employee.id
            return (
              <Node
                key={p.employee.id}
                p={{ employee: p.employee, x: b.x, y: b.y }}
                r={isCenter ? CENTER_R : NODE_R}
                onGrab={(event, e) => grab(event, [String(e.id)], e)}
                isCenter={isCenter}
                label={labelMode === 'title' ? p.employee.jobRole || 'No role' : p.employee.full_name}
              />
            )
          })}
        </g>
      </svg>

      <div className="absolute left-3 top-3 w-72 rounded-lg border border-border bg-card p-3 shadow-md">
        <div className="mb-2 flex gap-4 border-b border-border text-sm">
          {(['titles', 'connections'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setPanelTab(tab)}
              className={`cursor-pointer pb-1 capitalize ${panelTab === tab ? 'border-b-2 border-foreground font-medium' : 'text-muted-foreground'}`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex justify-around py-1 text-[11px] font-medium uppercase">
          {(panelTab === 'titles'
            ? ([['name', 'Name'], ['title', 'Title']] as const)
            : ([['manager', 'Manager'], ['department', 'Department']] as const)
          ).map(([value, text]) => {
            const selected = panelTab === 'titles' ? labelMode === value : connection === value
            return (
              <button
                key={value}
                type="button"
                onClick={() =>
                  panelTab === 'titles'
                    ? setLabelMode(value as 'name' | 'title')
                    : setConnection(value as 'department' | 'manager')
                }
                className="flex cursor-pointer flex-col items-center gap-1"
                aria-pressed={selected}
              >
                <span className={`flex size-5 items-center justify-center rounded-full border ${selected ? 'border-primary bg-primary/20' : 'border-border'}`}>
                  {selected && <span className="size-2.5 rounded-full bg-primary" />}
                </span>
                {text}
              </button>
            )
          })}
        </div>
      </div>

      <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm">
        <button type="button" onClick={() => zoom(1.2)} className="cursor-pointer p-2 hover:bg-muted" aria-label="Zoom in">
          <Plus className="size-4" />
        </button>
        <button type="button" onClick={() => zoom(1 / 1.2)} className="cursor-pointer border-t border-border p-2 hover:bg-muted" aria-label="Zoom out">
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setView({ x: 0, y: 0, k: 1 })
            reset()
          }}
          className="cursor-pointer border-t border-border p-2 hover:bg-muted"
          aria-label="Reset view"
        >
          <Maximize2 className="size-4" />
        </button>
      </div>
    </div>
  )
}
