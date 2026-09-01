'use client'

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  Users,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Flag,
  GitMerge,
  Filter,
  Plus,
  Layout,
  Calendar,
  AlertCircle,
  CalendarDays,
  Columns,
  Target,
  Pencil,
  Trash2,
  CalendarClock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  BackgroundVariant,
  MarkerType,
  Edge,
  Node,
  Connection,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'
import { taskChartColors, categoricalColor, categoricalColors } from '@/lib/chart-colors'
import { fromDateOnly } from '@/lib/date-only'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { taskService } from '@/services/task'
import type { DependenciesResponse, DependencyNode, DependencyType, TaskDependency, TaskMilestone, Workstream } from '@/types/task-management'

// Custom Premium Node Component
const TaskNode = ({ data }: { id: string; data: Record<string, any> }) => {
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed': return 'from-emerald-500/20 to-emerald-500/5 text-emerald-500 border-emerald-500/30 ring-emerald-500/20'
      case 'in_progress': return 'from-blue-500/20 to-blue-500/5 text-primary border-blue-500/30 ring-blue-500/20'
      case 'at_risk': return 'from-amber-500/20 to-amber-500/5 text-amber-500 border-amber-500/30 ring-amber-500/20'
      case 'blocked': return 'from-rose-500/20 to-rose-500/5 text-rose-500 border-rose-500/30 ring-rose-500/20'
      default:return 'from-slate-500/20 to-slate-500/5 text-slate-500 border-slate-500/30 ring-slate-500/20'
    }
  }

  const getStatusIconColor = (status: string) => {
    switch(status) {
      case 'completed': return 'text-emerald-500 bg-success/10'
      case 'in_progress': return 'text-primary bg-primary/10'
      case 'at_risk': return 'text-amber-500 bg-warning/10'
      case 'blocked': return 'text-rose-500 bg-rose-500/10'
      default: return 'text-slate-500 bg-slate-500/10'
    }
  }

  const getIcon = (status: string) => {
    switch(status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4" />
      case 'in_progress': return <Clock className="h-4 w-4" />
      case 'at_risk': return <AlertCircle className="h-4 w-4" />
      case 'blocked': return <AlertTriangle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const formatStatus = (status: string) => status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())

  // The handles must face the way the graph flows, or a top-to-bottom layout
  // draws every edge looping out of a node's right side and back into the left
  // of the node beneath it.
  const vertical = data.direction === 'TB'

  return (
    <div className={cn(
      "group relative w-[280px] overflow-hidden rounded-2xl border bg-card/90 backdrop-blur-2xl p-4 shadow-xl transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:z-50 ring-0",
      getStatusColor(data.status),
      data.status === 'blocked' ? 'animate-pulse shadow-rose-500/20' : ''
    )}>
      {/* ── WHICH PROJECT THIS BELONGS TO ──────────────────────────────────
          A rail, not a fill. The card's own colour already encodes STATUS, and
          overwriting it with project identity would trade one useful signal for
          another. Two encodings answering two different questions: the body
          says how the task is doing, the rail says whose work it is.

          Colour is never the only cue — the project name is printed on the card
          and repeated in the legend, which is also what satisfies the contrast
          floor for the lighter hues in this palette. */}
      {data.projectColor && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1.5"
          style={{ background: data.projectColor }}
        />
      )}
      {/* Handles with custom styling to ensure connection points are visible */}
      <Handle
        type="target"
        position={vertical ? Position.Top : Position.Left}
        className={cn(
          "w-5 h-5 border-2 transition-all duration-300 group-hover:scale-125 !bg-background cursor-crosshair z-20",
          getStatusColor(data.status).split(' ')[1] // Uses text color class as border
        )}
      />
      <Handle
        type="source"
        position={vertical ? Position.Bottom : Position.Right}
        className={cn(
          "w-5 h-5 border-2 transition-all duration-300 group-hover:scale-125 !bg-background cursor-crosshair z-20",
          getStatusColor(data.status).split(' ')[1]
        )}
      />

      {/* Glossy gradient overlay */}
      <div className={cn(
        "absolute inset-0 rounded-2xl bg-gradient-to-br opacity-50 pointer-events-none",
        getStatusColor(data.status).split(' ').slice(0,2).join(' ')
      )} />

      {/* Content wrapper */}
      <div className="relative z-10 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className={cn("px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5", getStatusIconColor(data.status))}>
            {getIcon(data.status)}
            {formatStatus(data.status)}
          </div>
          <span className="text-xs font-bold text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">{data.id}</span>
        </div>

        {/* Title */}
        <h3 className="font-bold text-base text-foreground leading-tight line-clamp-2">{data.title}</h3>

        {/* Footer */}
        <div className="flex items-center justify-between mt-2 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">{data.duration}</span>
          </div>
          
          {data.assignee && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">{data.assignee}</span>
              <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold border border-primary/30" title={data.assignee}>
                {data.assignee.charAt(0)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const initialNodes: Node[] = []
const initialEdges: Edge[] = []
const emptyData: DependenciesResponse['data'] = {
  dependencies: [], tasks: [], milestones: [],
  summary: { total: 0, blocking: 0, at_risk: 0, on_track: 0, milestones: 0, critical_path: 0 },
  options: { types: ['FS', 'SS', 'FF', 'SF'], projects: [], tasks: [], users: [] },
}

/**
 * WHAT THE FOUR TYPES MEAN, in the words the form needs.
 *
 * `dependency_type` was stored and echoed back and branched nothing, so the
 * four letters were interchangeable. The server now anchors on the right date
 * per type; this is the same rule stated for the person choosing it.
 */
const DEPENDENCY_TYPE_LABELS: Record<string, string> = {
  FS: 'Finish → Start', SS: 'Start → Start', FF: 'Finish → Finish', SF: 'Start → Finish',
}
const DEPENDENCY_TYPE_HELP: Record<string, string> = {
  FS: 'The successor starts after the predecessor finishes — the day after its due date.',
  SS: 'The two start together: the successor starts when the predecessor starts.',
  FF: 'The two finish together: the successor is due when the predecessor is due.',
  SF: 'The successor is due once the predecessor starts.',
}
/** The server's own list, mirrored for the create form's dropdown. */
/**
 * A project as two lines: its name, and a hint carrying the code and manager.
 *
 * SearchableSelect matches on BOTH, so typing "PRJ-00007" finds G2G — which the
 * old single-line Select could not do. The transport now carries these fields;
 * it used to be `{ id, name }` and there was nothing else to show.
 *
 * `String(project.id)` is gone: the API casts ids server-side now, and the
 * wrapper was masking an integer arriving where the type promised a string.
 */
function projectPickerOptions(projects: DependenciesResponse['data']['options']['projects']) {
  return projects.map((project) => ({
    value: project.id,
    label: project.name,
    hint: [project.code, project.manager ?? 'No manager'].filter(Boolean).join(' · '),
  }))
}

const MILESTONE_STATUSES: Array<TaskMilestone['status']> = ['UPCOMING', 'AT RISK', 'COMPLETED']

/** The node card is w-[280px]; the height is measured from a rendered card. */
const NODE_WIDTH = 280
const NODE_HEIGHT = 170

/**
 * A GENUINE HIERARCHICAL LAYOUT.
 *
 * "Left to Right (Dagre)" named a library that was not installed. The handler
 * behind it restored the original grid, and "Top to Bottom" multiplied the grid
 * coordinates by 3 and 0.8 — a comment in the file called it a mock. Neither
 * consulted a single edge, so nodes were placed in insert order and arrows ran
 * in every direction.
 *
 * Dagre ranks nodes by their dependency edges, which is what makes a dependency
 * graph readable: predecessors on one side, successors on the other.
 */
function layoutGraph(nodes: Node[], edges: Edge[], direction: 'LR' | 'TB'): Node[] {
  if (!nodes.length) return nodes
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 140, marginx: 40, marginy: 40 })

  const known = new Set(nodes.map((node) => node.id))
  nodes.forEach((node) => graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
  edges.forEach((edge) => {
    // An edge to a node that is not on the canvas would make dagre invent one.
    if (known.has(edge.source) && known.has(edge.target)) graph.setEdge(edge.source, edge.target)
  })
  dagre.layout(graph)

  return nodes.map((node) => {
    const placed = graph.node(node.id)
    if (!placed) return node
    return {
      ...node,
      // dagre returns the CENTRE; React Flow positions by the top-left corner.
      position: { x: placed.x - NODE_WIDTH / 2, y: placed.y - NODE_HEIGHT / 2 },
      data: { ...node.data, direction },
      targetPosition: direction === 'LR' ? Position.Left : Position.Top,
      sourcePosition: direction === 'LR' ? Position.Right : Position.Bottom,
    }
  })
}

/** `2026-03-13` -> `13 Mar 2026`, parsed as a local date-only value. */
function formatDate(value: string | null | undefined) {
  if (!value) return null
  const date = fromDateOnly(value)
  if (!date || Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function normalizeStatus(status: string, atRisk = false) {
  if (atRisk) return 'at_risk'
  const value = status.toUpperCase()
  if (value === 'COMPLETED') return 'completed'
  if (value === 'IN-PROGRESS' || value === 'IN PROGRESS') return 'in_progress'
  if (value === 'ON HOLD') return 'blocked'
  return 'not_started'
}

function graphNodes(tasks: DependencyNode[], projectOrder: readonly string[] = []): Node[] {
  return Array.from(new Map(tasks.map((task) => [task.id, task])).values()).map((task, index) => ({
    id: task.id, type: 'taskNode',
    // A holding grid only. layoutGraph() replaces these the moment data lands.
    position: { x: (index % 4) * 390 + 50, y: Math.floor(index / 4) * 230 + 80 },
    data: {
      id: `T-${task.id}`, title: task.title, status: normalizeStatus(task.status, task.at_risk),
      assignee: task.assignee, duration: formatDate(task.due_date) ?? 'No due date', project: task.project,
      // IDS, not display names - the filters compare on these.
      assigneeId: task.assignee_id ?? '', projectId: task.project_id ?? '', direction: 'LR',
      // Null past the palette's five slots, and the rail simply does not render.
      // Cycling would give two projects the same colour, which reads as a claim
      // that they are the same one.
      projectColor: task.project_id ? categoricalColor(task.project_id, projectOrder) : null,
      // Workstream travels with the node so the map can filter on it. It was
      // already in the payload (DependencyNode.workstream_id) and already
      // loaded in this component for the create form - it simply never
      // reached the graph, which is why the Workstream tab filtered nothing.
      workstreamId: task.workstream_id ?? '', workstreamName: task.workstream ?? '',
      // Department travels with the node for the same reason workstream does:
      // the map filters on the id and the menu is built from what is actually
      // on the canvas. It was already in the payload and never reached here.
      departmentId: task.department_id ?? '', departmentName: task.department ?? '',
    },
  }))
}

function graphEdges(dependencies: TaskDependency[]): Edge[] {
  return dependencies.map((dependency) => {
    const completed = dependency.predecessor.status?.toUpperCase() === 'COMPLETED'
    const color = dependency.blocking ? taskChartColors.blocked : completed ? taskChartColors.completed : taskChartColors.inProgress
    return {
      id: dependency.id, source: dependency.predecessor.id, target: dependency.successor.id,
      type: 'smoothstep', animated: dependency.blocking || !completed,
      markerEnd: { type: MarkerType.ArrowClosed, color },
      style: { stroke: color, strokeWidth: dependency.blocking ? 4 : 3 },
      data: { dependency },
    }
  })
}

export function DependenciesView() {
  const nodeTypes = useMemo(() => ({ taskNode: TaskNode }), [])
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [baseNodes, setBaseNodes] = useState<Node[]>([])
  const [data, setData] = useState<DependenciesResponse['data']>(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reload, setReload] = useState(0)
  const [activeTab, setActiveTab] = useState<'map' | 'timeline' | 'workstream' | 'milestone'>('map')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [predecessor, setPredecessor] = useState('')
  const [successor, setSuccessor] = useState('')
  const [dependencyType, setDependencyType] = useState<DependencyType>('FS')
  const [lagDays, setLagDays] = useState('0')
  const [notes, setNotes] = useState('')
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedWorkstream, setSelectedWorkstream] = useState('')
  const [workstreams, setWorkstreams] = useState<Workstream[]>([])
  const [workstreamsLoading, setWorkstreamsLoading] = useState(false)
  const [workstreamsError, setWorkstreamsError] = useState('')
  // The create dialog reports its own failures. A 422 rendered behind the
  // overlay is a 422 nobody sees.
  const [formError, setFormError] = useState('')
  const [direction, setDirection] = useState<'LR' | 'TB'>('LR')
  const flowRef = useRef<ReactFlowInstance | null>(null)
  const [applyingId, setApplyingId] = useState('')
  // Milestone CRUD. POST/PUT/DELETE existed on the server with nothing calling
  // them, so a milestone could only be created by writing to the database.
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<TaskMilestone | null>(null)
  const [milestoneForm, setMilestoneForm] = useState({
    project_id: '', workstream_id: '', name: '', description: '',
    target_date: '', status: 'UPCOMING' as TaskMilestone['status'],
  })
  const [milestoneWorkstreams, setMilestoneWorkstreams] = useState<Workstream[]>([])
  const [milestoneError, setMilestoneError] = useState('')
  const [milestoneSaving, setMilestoneSaving] = useState(false)

  // Candidates for predecessor/successor: this project's tasks when one is
  // chosen, otherwise everything. A dependency needs two tasks from ONE
  // project, so narrowing here is what removes the confusing 422.
  const eligibleTasks = selectedProject
    ? (data?.options.tasks ?? []).filter((task) => String(task.project_id ?? '') === selectedProject)
    : (data?.options.tasks ?? [])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    // WITHOUT A SESSION THERE IS NO TENANT, and the request would come back as
    // an authentication failure dressed up as an empty graph.
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) {
      setError('Your session is not ready yet. Reload the page to continue.')
      setLoading(false)
      return
    }
    try {
      const response = await taskService.getDependencies(context)
      const uniqueTasks = Array.from(new Map(response.data.tasks.map((task) => [task.id, task])).values())
      const uniqueDependencies = Array.from(new Map(response.data.dependencies.map((dependency) => [dependency.id, dependency])).values())
      const nextData = { ...response.data, tasks: uniqueTasks, dependencies: uniqueDependencies }
      const nextEdges = graphEdges(uniqueDependencies)
      // Laid out by the dependency edges, not by insert order.
      /*
       * The project colour order, derived HERE from the freshly loaded set
       * rather than from the projectOrder memo — that memo is computed from
       * `data`, which this call is about to set, so reading it would colour the
       * graph from the PREVIOUS load.
       *
       * Sorted by name so the mapping is stable across reloads: the same project
       * keeps the same colour whether or not other projects came back this time.
       */
      const projectIdsByName = Array.from(
        new Map(uniqueTasks.filter((task) => task.project_id).map((task) => [task.project_id as string, task.project])).entries(),
      ).sort((a, b) => String(a[1]).localeCompare(String(b[1]))).map(([id]) => id)

      const nextNodes = layoutGraph(graphNodes(uniqueTasks, projectIdsByName), nextEdges, direction)
      setData(nextData); setBaseNodes(nextNodes); setNodes(nextNodes); setEdges(nextEdges)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load dependencies.')
    } finally { setLoading(false) }
    // `direction` is read, not tracked: re-laying out on a direction change is
    // handleLayout's job and must not trigger a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setEdges, setNodes])

useEffect(() => {
  // Deferred so the load's first setState lands after this render. `reload`
  // is the manual refetch trigger the mutation handlers bump.
  queueMicrotask(() => { void load() })
}, [load, reload])

  useEffect(() => {
    // Deferred so every setState (including the resets) lands after this
    // render rather than cascading out of the effect body.
    let active = true
    queueMicrotask(() => {
      if (!active) return
      // CHANGING PROJECT INVALIDATES THE TASKS. It used to reset only the
      // workstream, so predecessor/successor kept ids from the previous
      // project and submit produced the very "two tasks from the same project"
      // 422 the filter exists to prevent.
      setPredecessor(''); setSuccessor('')
      if (!selectedProject) { setWorkstreams([]); setSelectedWorkstream(''); setWorkstreamsError(''); return }
      const context = getLaravelContext()
      if (!isLaravelContextReady(context)) { setWorkstreamsError('Session unavailable.'); return }
      setWorkstreamsLoading(true); setSelectedWorkstream(''); setWorkstreamsError('')
      taskService.getWorkstreams(context, selectedProject)
        .then((response) => { if (active) setWorkstreams(response.data ?? []) })
        .catch((reason) => { if (active) setWorkstreamsError(reason instanceof Error ? reason.message : 'Unable to load workstreams.') })
        .finally(() => { if (active) setWorkstreamsLoading(false) })
    })
    return () => { active = false }
  }, [selectedProject])

  // THE MAP OPENED BLANK. React Flow's `fitView` prop fits once, on mount, when
  // `nodes` is still the empty array; the data arrived a moment later and the
  // viewport was never re-fitted - which is why switching tabs and back
  // "fixed" it. Re-fit whenever the node set changes while the map is visible.
  useEffect(() => {
    // GUARDED ON WHAT IS VISIBLE, not on what exists. fitView ignores hidden
    // nodes, so filtering everything out left it fitting an empty set - and a
    // single visible node makes it zoom to maxZoom and fill the canvas, which
    // reads as a broken layout rather than a filtered one. maxZoom caps that.
    if (activeTab !== 'map') return
    if (!nodes.some((n) => !n.hidden)) return
    const frame = requestAnimationFrame(() => {
      flowRef.current?.fitView({ padding: 0.2, duration: 300, maxZoom: 1.2 })
    })
    return () => cancelAnimationFrame(frame)
  }, [activeTab, nodes])

  // Filter States - these hold IDS, matched against ids on the node.
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [filterAssignee, setFilterAssignee] = useState<string | null>(null)
  const [filterProject, setFilterProject] = useState<string | null>(null)
  const [filterWorkstream, setFilterWorkstream] = useState<string | null>(null)
  // The filter you asked for and the map did not have. Client-side like the
  // other four: the graph must stay whole for a chain to be readable, and every
  // node already carries its department, so this is instant and cannot drop an
  // intermediate task and silently break a dependency line.
  const [filterDepartment, setFilterDepartment] = useState<string | null>(null)

  /**
   * ONE PREDICATE, USED BY BOTH PASSES.
   *
   * ── THE BUG THIS REPLACES ───────────────────────────────────────────────
   *
   * Node visibility ANDed every active filter, while edge visibility ORed the
   * two endpoints **per filter, independently**:
   *
   *     if (filterStatus   && (src.status   !== s && tgt.status   !== s)) hide
   *     if (filterAssignee && (src.assignee !== a && tgt.assignee !== a)) hide
   *
   * So with a status AND an assignee filter set, an edge survived when the
   * SOURCE matched the status and the TARGET matched the assignee — even
   * though neither node matched both, and therefore BOTH nodes were hidden.
   * The result was edges drawn across an empty canvas, anchored to nothing.
   *
   * An edge is a relationship between two nodes. If either end is not on
   * screen, the edge cannot be drawn truthfully — so it is visible only when
   * BOTH endpoints pass the same predicate the nodes were judged by.
   */
  const nodeMatches = useCallback((data: Record<string, unknown> | undefined) => {
    if (!data) return false
    if (filterStatus && data.status !== filterStatus) return false
    if (filterAssignee && data.assigneeId !== filterAssignee) return false
    if (filterProject && data.projectId !== filterProject) return false
    if (filterWorkstream && data.workstreamId !== filterWorkstream) return false
    if (filterDepartment && data.departmentId !== filterDepartment) return false
    return true
  }, [filterStatus, filterAssignee, filterProject, filterWorkstream, filterDepartment])

  useEffect(() => {
    setNodes((nds) => nds.map((node) => ({ ...node, hidden: !nodeMatches(node.data) })))

    // Judged against baseNodes, not the live nodes, because `nodes` is what we
    // are in the middle of updating - reading it here would race the setState
    // above and use last render's hidden flags.
    setEdges((eds) =>
      eds.map((edge) => {
        const source = baseNodes.find((n) => n.id === edge.source)
        const target = baseNodes.find((n) => n.id === edge.target)
        return { ...edge, hidden: !(nodeMatches(source?.data) && nodeMatches(target?.data)) }
      }),
    )
  }, [baseNodes, nodeMatches, setNodes, setEdges])

  const handleLayout = (next: 'TB' | 'LR' | 'reset') => {
    // "Reset" means back to the laid-out positions the graph loaded with, in
    // whichever direction is currently selected - not back to the holding grid.
    const target = next === 'reset' ? direction : next
    setDirection(target)
    setNodes((current) => {
      const laid = layoutGraph(next === 'reset' ? baseNodes : current, edges, target)
      if (next === 'reset') setBaseNodes(laid)
      return laid
    })
    requestAnimationFrame(() => flowRef.current?.fitView({ padding: 0.2, duration: 300 }))
  }

  /**
   * MOVE THE SUCCESSOR TO THE DATE ITS DEPENDENCY IMPLIES.
   *
   * Never automatic. `schedule.implied_date` says where the date should sit;
   * this is the click that puts it there, and `schedule.target_field` decides
   * whether that is the start date or the due date.
   */
  const applySchedule = async (dependency: TaskDependency) => {
    const { implied_date: implied, target_field: field } = dependency.schedule
    if (!implied) return
    setApplyingId(dependency.id); setError(''); setMessage('')
    try {
      await taskService.updateTaskSchedule(getLaravelContext(), dependency.successor.id, { [field]: implied })
      setMessage(`"${dependency.successor.title}" moved to ${formatDate(implied)}.`)
      setReload((value) => value + 1)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to move that task.')
    } finally { setApplyingId('') }
  }

  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return
    setPredecessor(params.source); setSuccessor(params.target); setIsCreateModalOpen(true)
  }, [])

  const onEdgeDoubleClick = useCallback(
    async (event: React.MouseEvent, edge: Edge) => {
      event.stopPropagation()
      if (!window.confirm('Delete this dependency?')) return
      try {
        const response = await taskService.deleteDependency(getLaravelContext(), edge.id)
        setMessage(response.message); setReload((value) => value + 1)
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to delete dependency.') }
    },
    []
  )

  const createDependency = async () => {
    if (!predecessor || !successor) { setFormError('Select both a predecessor and a successor task.'); return }
    setSaving(true); setFormError('')
    try {
      const response = await taskService.createDependency(getLaravelContext(), {
        predecessor_task_id: predecessor, successor_task_id: successor,
        dependency_type: dependencyType, lag_days: Number(lagDays) || 0, notes: notes || undefined,
        project_id: selectedProject || undefined, workstream_id: selectedWorkstream || undefined,
      })
      setMessage(response.message); setIsCreateModalOpen(false); setPredecessor(''); setSuccessor(''); setNotes(''); setLagDays('0')
      setSelectedProject(''); setSelectedWorkstream(''); setWorkstreams([])
      setReload((value) => value + 1)
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : 'Unable to create dependency.') }
    finally { setSaving(false) }
  }

  const openMilestoneModal = (milestone: TaskMilestone | null) => {
    setEditingMilestone(milestone)
    setMilestoneError('')
    setMilestoneForm(milestone
      ? { project_id: String(milestone.project_id), workstream_id: milestone.workstream_id ? String(milestone.workstream_id) : '',
          name: milestone.name, description: milestone.description ?? '', target_date: milestone.target_date, status: milestone.status }
      : { project_id: '', workstream_id: '', name: '', description: '', target_date: '', status: 'UPCOMING' })
    setMilestoneModalOpen(true)
  }

  const saveMilestone = async () => {
    if (!milestoneForm.project_id || !milestoneForm.name.trim() || !milestoneForm.target_date) {
      setMilestoneError('A milestone needs a project, a name and a target date.')
      return
    }
    setMilestoneSaving(true); setMilestoneError('')
    const payload = {
      project_id: milestoneForm.project_id,
      ...(milestoneForm.workstream_id ? { workstream_id: milestoneForm.workstream_id } : {}),
      name: milestoneForm.name.trim(),
      ...(milestoneForm.description.trim() ? { description: milestoneForm.description.trim() } : {}),
      target_date: milestoneForm.target_date, status: milestoneForm.status,
    }
    try {
      const response = editingMilestone
        ? await taskService.updateMilestone(getLaravelContext(), editingMilestone.id, payload)
        : await taskService.createMilestone(getLaravelContext(), payload)
      setMessage(response.message); setMilestoneModalOpen(false); setReload((value) => value + 1)
    } catch (reason) {
      setMilestoneError(reason instanceof Error ? reason.message : 'Unable to save that milestone.')
    } finally { setMilestoneSaving(false) }
  }

  const removeMilestone = async (milestone: TaskMilestone) => {
    if (!window.confirm(`Delete the milestone "${milestone.name}"?`)) return
    try {
      const response = await taskService.deleteMilestone(getLaravelContext(), milestone.id)
      setMessage(response.message); setReload((value) => value + 1)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete that milestone.')
    }
  }

  // The milestone dialog needs the chosen project's workstreams, exactly as the
  // dependency dialog does.
  useEffect(() => {
    let active = true
    // Deferred so the reset lands after this render rather than cascading out
    // of the effect body - the same shape as the dependency dialog's loader.
    queueMicrotask(() => {
      if (!active) return
      const projectId = milestoneForm.project_id
      if (!projectId) { setMilestoneWorkstreams([]); return }
      const context = getLaravelContext()
      if (!isLaravelContextReady(context)) return
      taskService.getWorkstreams(context, projectId)
        .then((response) => { if (active) setMilestoneWorkstreams(response.data ?? []) })
        .catch(() => { if (active) setMilestoneWorkstreams([]) })
    })
    return () => { active = false }
  }, [milestoneForm.project_id])

  // Only dependencies whose successor sits earlier than their type and lag
  // allow. `implied_date` is null when the anchor date is missing, and those
  // carry a reason instead of a number.
  const scheduleIssues = data.dependencies.filter((dependency) => dependency.schedule?.violates)

  // FILTERS OFFER ONLY WHAT IS ON THE CANVAS. data.options.users lists every
  // active person in the tenant; offering all of them would fill the menu with
  // choices that blank the graph, because the graph only holds tasks that take
  // part in a dependency.
  const assigneeOptions = useMemo(() => {
    const seen = new Map<string, string>()
    data.tasks.forEach((task) => { if (task.assignee_id) seen.set(task.assignee_id, task.assignee) })
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [data.tasks])

  const projectOptions = useMemo(() => {
    const seen = new Map<string, string>()
    data.tasks.forEach((task) => { if (task.project_id) seen.set(task.project_id, task.project) })
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [data.tasks])

  /*
   * The order the project palette is keyed on.
   *
   * Sorted by NAME and derived from the whole loaded set, never from the
   * filtered view — so filtering to one project leaves every other project's
   * colour exactly where it was. Colour follows the entity, not its rank in
   * whatever is currently on screen.
   */
  const projectOrder = useMemo(() => projectOptions.map((option) => option.id), [projectOptions])

  // Same rule, one level down. A task can belong to a project without being
  // placed in a workstream, so a null workstream_id is normal and simply does
  // not become an option - it is not "Unassigned", it is not a grouping.
  const workstreamOptions = useMemo(() => {
    const seen = new Map<string, string>()
    data.tasks.forEach((task) => {
      if (task.workstream_id) seen.set(task.workstream_id, task.workstream ?? 'Unnamed workstream')
    })
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [data.tasks])

  /*
   * Same rule as the other three: only departments actually present on the
   * canvas. A person with no department set contributes nothing rather than an
   * "Unassigned" bucket, which would be a grouping nobody created.
   *
   * DUPLICATE NAMES ARE DISAMBIGUATED, NOT MERGED. 373 department names on dev
   * and 368 on live are used by more than one record — tenant 6 alone has two
   * called "Development" — so a plain name list would show one word twice with
   * no way to tell which is which, and merging them would filter to only one of
   * the two and quietly hide the other's tasks.
   *
   * The task count is the disambiguator because it is the one thing that is both
   * visible on the canvas and meaningful to a person; a record id would not be.
   * It is appended ONLY where a name actually collides, so the common case stays
   * a clean list.
   */
  const departmentOptions = useMemo(() => {
    const counts = new Map<string, number>()
    const names = new Map<string, string>()

    data.tasks.forEach((task) => {
      if (!task.department_id) return
      names.set(task.department_id, task.department ?? 'Unnamed department')
      counts.set(task.department_id, (counts.get(task.department_id) ?? 0) + 1)
    })

    const nameUses = new Map<string, number>()
    names.forEach((name) => nameUses.set(name, (nameUses.get(name) ?? 0) + 1))

    return Array.from(names, ([id, name]) => ({
      id,
      name: (nameUses.get(name) ?? 0) > 1 ? `${name} (${counts.get(id) ?? 0} tasks)` : name,
    })).sort((a, b) => a.name.localeCompare(b.name))
  }, [data.tasks])

  /**
   * How much the filters are hiding.
   *
   * A filtered graph that shows nothing looks identical to a graph with no
   * dependencies, and only one of those is a problem the user caused. These
   * two numbers are what let the empty state tell them apart.
   */
  const visibleNodeCount = useMemo(() => nodes.filter((n) => !n.hidden).length, [nodes])
  const filtersActive = Boolean(filterStatus || filterAssignee || filterProject || filterWorkstream || filterDepartment)

  const clearFilters = useCallback(() => {
    setFilterStatus(null); setFilterAssignee(null); setFilterProject(null); setFilterWorkstream(null)
    setFilterDepartment(null)
  }, [])

  const pulseData = [
    { id: 'total', title: 'Total Dependencies', value: data.summary.total, subtitle: 'Across all active projects', icon: GitMerge },
    { id: 'blocking', title: 'Blocking', value: data.summary.blocking, subtitle: 'High priority blockers', icon: AlertTriangle },
    { id: 'risk', title: 'At Risk', value: data.summary.at_risk, subtitle: 'Behind schedule', icon: AlertCircle },
    { id: 'ontrack', title: 'On Track', value: data.summary.on_track, subtitle: 'Proceeding as planned', icon: CheckCircle2 },
    { id: 'milestones', title: 'Milestones', value: data.summary.milestones, subtitle: 'Key deliverables', icon: Flag },
    { id: 'critical', title: 'Critical Path', value: data.summary.critical_path, subtitle: 'Longest dependency chain', icon: Users }
  ]

  return (
    <div className="flex h-full flex-col gap-6">
      {/* Header Area */}
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Dependencies & Workstreams
              <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-[10px] font-bold cursor-help">i</div>
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/20 bg-card/50 px-4 py-2 text-sm font-medium shadow-sm backdrop-blur-sm transition-colors hover:bg-primary/5 cursor-pointer outline-none">
                <Layout className="h-4 w-4" /> Layout
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5 text-sm font-bold text-foreground/70 tracking-wide uppercase">Auto-Layout Algorithm</div>
                <DropdownMenuSeparator />
                {/* "Radial Hierarchy" used to sit here with no onClick at
                    all - a menu entry that did nothing when clicked. Removed
                    rather than left looking live. */}
                <DropdownMenuItem onClick={() => handleLayout('LR')} className={cn('cursor-pointer', direction === 'LR' && 'font-medium text-primary')}>
                  <span className="w-4 inline-block">{direction === 'LR' ? '✓' : ''}</span> Left to Right
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleLayout('TB')} className={cn('cursor-pointer', direction === 'TB' && 'font-medium text-primary')}>
                  <span className="w-4 inline-block">{direction === 'TB' ? '✓' : ''}</span> Top to Bottom
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleLayout('reset')} className="cursor-pointer text-muted-foreground">Reset Node Positions</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/20 bg-card/50 px-4 py-2 text-sm font-medium shadow-sm backdrop-blur-sm transition-colors hover:bg-primary/5 cursor-pointer outline-none">
                <Filter className="h-4 w-4" /> Filters
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="px-2 py-1.5 text-xs font-bold text-foreground/50 tracking-wider uppercase">Filter By Status</div>
                <DropdownMenuItem onClick={() => setFilterStatus(filterStatus === 'blocked' ? null : 'blocked')} className="cursor-pointer">
                  <span className="w-4 inline-block">{filterStatus === 'blocked' ? '✓' : ''}</span> Only Blocked Tasks
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus(filterStatus === 'at_risk' ? null : 'at_risk')} className="cursor-pointer">
                  <span className="w-4 inline-block">{filterStatus === 'at_risk' ? '✓' : ''}</span> Only At Risk Tasks
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus(filterStatus === 'completed' ? null : 'completed')} className="cursor-pointer">
                  <span className="w-4 inline-block">{filterStatus === 'completed' ? '✓' : ''}</span> Only Completed Tasks
                </DropdownMenuItem>

                {/* THESE WERE THREE INVENTED NAMES AND TWO INVENTED PROJECTS -
                    "Sarah", "Michael", "Dwight", "Alpha Release", "Beta
                    Testing" - none of which exist in any tenant, and each
                    compared against a full "First Middle Last" string. Every
                    click hid the entire graph. The lists now come from
                    data.options, and match on the id. */}
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-bold text-foreground/50 tracking-wider uppercase">Filter By Assignee</div>
                <div className="max-h-48 overflow-y-auto">
                  {assigneeOptions.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No assignee on any task here.</div>}
                  {assigneeOptions.map((person) => (
                    <DropdownMenuItem key={person.id} onClick={() => setFilterAssignee(filterAssignee === person.id ? null : person.id)} className="cursor-pointer">
                      <span className="w-4 inline-block">{filterAssignee === person.id ? '✓' : ''}</span> {person.name}
                    </DropdownMenuItem>
                  ))}
                </div>

                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-bold text-foreground/50 tracking-wider uppercase">Filter By Project</div>
                <div className="max-h-48 overflow-y-auto">
                  {projectOptions.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No project on any task here.</div>}
                  {projectOptions.map((project) => (
                    <DropdownMenuItem key={project.id} onClick={() => setFilterProject(filterProject === project.id ? null : project.id)} className="cursor-pointer">
                      <span className="w-4 inline-block">{filterProject === project.id ? '✓' : ''}</span> {project.name}
                    </DropdownMenuItem>
                  ))}
                </div>

                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-bold text-foreground/50 tracking-wider uppercase">Filter By Department</div>
                <div className="max-h-48 overflow-y-auto">
                  {departmentOptions.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No department on any task here.</div>}
                  {departmentOptions.map((department) => (
                    <DropdownMenuItem key={department.id} onClick={() => setFilterDepartment(filterDepartment === department.id ? null : department.id)} className="cursor-pointer">
                      <span className="w-4 inline-block">{filterDepartment === department.id ? '✓' : ''}</span> {department.name}
                    </DropdownMenuItem>
                  ))}
                </div>

                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-bold text-foreground/50 tracking-wider uppercase">Filter By Workstream</div>
                <div className="max-h-48 overflow-y-auto">
                  {workstreamOptions.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No workstream on any task here.</div>}
                  {workstreamOptions.map((workstream) => (
                    <DropdownMenuItem key={workstream.id} onClick={() => setFilterWorkstream(filterWorkstream === workstream.id ? null : workstream.id)} className="cursor-pointer">
                      <span className="w-4 inline-block">{filterWorkstream === workstream.id ? '✓' : ''}</span> {workstream.name}
                    </DropdownMenuItem>
                  ))}
                </div>

                {filtersActive && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={clearFilters}
                      className="cursor-pointer text-rose-500 font-bold justify-center"
                    >
                      Clear All Filters
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2 bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all cursor-pointer">
              <Plus className="h-4 w-4" /> Create Dependency
            </Button>
          </div>
        </div>

        {message && <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">{message}</div>}
        {error && <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}

        {/* Stats Row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {pulseData.map((card, idx) => {
  const Icon = card.icon;
  return (
            <Card key={card.id} className="animate-in fade-in slide-in-from-bottom-3" style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'both' }}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">{card.subtitle}</p>
              </CardContent>
            </Card>
          );
})}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="rounded-3xl bg-card/20 backdrop-blur-md border border-primary/10 shadow-2xl flex flex-col overflow-hidden relative h-[500px] 2xl:h-[700px] min-h-[400px] shrink-0">
        {/* Tabs Bar */}
        <div className="flex items-center gap-1 p-3 border-b border-border/50 bg-card/60 backdrop-blur-xl">
          {(['Dependency Map', 'Timeline', 'Workstream', 'Milestone View']).map((tab, i) => {
            const id = ['map', 'timeline', 'workstream', 'milestone'][i] as any
            return (
              <Button variant="ghost"
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex-1 text-center px-5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer",
                  activeTab === id ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {tab}
              </Button>
            )
          })}
        </div>

        {/* Map Area */}
        <div className="flex-1 w-full h-full">
          {activeTab === 'map' && (
            <div className="flex w-full h-full relative">
              {/* Static Left Sidebar for Legend */}
              <div className="w-[260px] h-full border-r border-border/50 bg-card/40 backdrop-blur-3xl p-5 overflow-y-auto shrink-0 z-10 flex flex-col gap-6">
                {/* ── WHICH RAIL IS WHICH PROJECT ──────────────────────────
                    Not decoration: orange and teal in this palette sit below 3:1
                    against the surface, and the rule for that is that the colour
                    must be accompanied by a visible label. This legend IS that
                    label — without it the rail would be a colour nobody can name.

                    Projects past the palette's five slots get no rail rather than
                    a repeated colour, and the legend says so instead of leaving
                    someone hunting for a sixth hue that does not exist. */}
                {projectOrder.length > 0 && (
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Project</h4>
                    <div className="flex flex-col gap-3">
                      {projectOptions.map((option) => {
                        const colour = categoricalColor(option.id, projectOrder)
                        return (
                          <div key={option.id} className="flex items-center gap-3">
                            <span
                              className="h-3 w-1.5 shrink-0 rounded-full"
                              style={{ background: colour ?? 'var(--muted-foreground)' }}
                            />
                            <span className="min-w-0 truncate text-sm font-semibold" title={option.name}>
                              {option.name}
                            </span>
                          </div>
                        )
                      })}
                      {projectOptions.length > categoricalColors.length && (
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Only the first {categoricalColors.length} projects carry a colour — the rest
                          share a neutral rail rather than repeating a hue.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Node Status</h4>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-success shadow-[0_0_10px_rgba(16,185,129,0.5)]" /><span className="text-sm font-semibold">On Track / Done</span></div>
                    <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]" /><span className="text-sm font-semibold">In Progress</span></div>
                    <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-warning shadow-[0_0_10px_rgba(245,158,11,0.5)]" /><span className="text-sm font-semibold">At Risk</span></div>
                    <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)] animate-pulse" /><span className="text-sm font-semibold">Blocked</span></div>
                    {/* A "Milestone" swatch used to sit here. normalizeStatus()
                        returns one of five values and 'milestone' is not among
                        them, so no node could ever wear it. */}
                  </div>
                </div>

                <div className="h-px bg-border/50" />

                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Edge Types</h4>
                  {/* THE SWATCHES READ FROM THE SAME CONSTANTS THE EDGES DO.
                      The blocking swatch was rose while graphEdges() drew
                      blocking edges in taskChartColors.blocked - amber. The
                      legend described a colour that was not on the canvas. */}
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-0 border-t-2" style={{ borderColor: taskChartColors.completed }} />
                      <span className="text-xs font-semibold text-muted-foreground">Completed Line</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-0 border-t-2 border-dashed" style={{ borderColor: taskChartColors.inProgress }} />
                      <span className="text-xs font-semibold text-muted-foreground">Active Flow</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-0 border-t-2 border-dashed animate-pulse" style={{ borderColor: taskChartColors.blocked }} />
                      {/* Named apart from the "Blocked" NODE status above -
                          one is a task on hold, the other is a link whose
                          predecessor has not finished. */}
                      <span className="text-xs font-semibold text-muted-foreground">Blocking dependency</span>
                    </div>
                  </div>
                </div>

                {/* ─────────────────────────────────────────────────────────
                    WHAT THE TYPE AND LAG ACTUALLY IMPLY - AND THE CLICK THAT
                    APPLIES IT.

                    Before this, `dependency_type` and `lag_days` were stored,
                    echoed back, and used by nothing: setting "lag 2 days"
                    moved no date, ever. The server now computes the date the
                    dependency implies; this is where a person sees it and
                    decides. Nothing moves on its own.
                    ───────────────────────────────────────────────────────── */}
                {scheduleIssues.length > 0 && (
                  <>
                    <div className="h-px bg-border/50" />
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                        <CalendarClock className="h-3.5 w-3.5" /> Schedule ({scheduleIssues.length})
                      </h4>
                      <div className="flex flex-col gap-3">
                        {scheduleIssues.map((dependency) => (
                          <div key={dependency.id} className="rounded-xl border border-warning/30 bg-warning/5 p-3">
                            <p className="text-xs font-bold text-foreground leading-snug line-clamp-2" title={dependency.successor.title}>
                              {dependency.successor.title}
                            </p>
                            <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
                              {dependency.type} {dependency.lag_days !== 0 && `${dependency.lag_days > 0 ? '+' : ''}${dependency.lag_days}d `}
                              after <span className="font-medium">{dependency.predecessor.title.slice(0, 28)}{dependency.predecessor.title.length > 28 ? '…' : ''}</span>
                            </p>
                            <p className="mt-1.5 text-[11px] text-foreground">
                              {dependency.schedule.target_field === 'due_date' ? 'Due' : 'Starts'}{' '}
                              <span className="font-semibold text-warning">{formatDate(dependency.schedule.current_date) ?? 'not set'}</span>
                              {' → should be '}
                              <span className="font-semibold text-success">{formatDate(dependency.schedule.implied_date)}</span>
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={applyingId === dependency.id}
                              onClick={() => void applySchedule(dependency)}
                              className="mt-2 h-7 w-full text-[11px] font-bold"
                            >
                              {applyingId === dependency.id ? 'Moving…' : 'Apply'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* ReactFlow Canvas Area */}
              <div className="flex-1 h-full bg-background/30 relative">
                {loading && <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/60 backdrop-blur-sm"><Spinner /></div>}
                <div className="absolute top-4 left-4 z-10 bg-card/80 backdrop-blur-md px-3 py-2 rounded-xl border border-primary/10 shadow-sm flex items-center gap-2 text-xs font-medium text-muted-foreground animate-in fade-in">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Drag between nodes to connect. Double-click any line to delete.
                  {/* STATED, NOT INFERRED. Without this a filtered graph looks
                      like a smaller graph, and there is nothing on screen
                      saying tasks were removed from view rather than absent. */}
                  {filtersActive && nodes.length > 0 && (
                    <span className="ml-1 font-semibold text-foreground">
                      · showing {visibleNodeCount} of {nodes.length}
                    </span>
                  )}
                </div>
                {/* TWO DIFFERENT EMPTIES, AND ONLY ONE IS A PROBLEM THE USER
                    CAUSED. A graph with no dependencies needs somebody to
                    create one; a graph whose filters hide everything needs
                    them cleared. Showing "No dependencies yet" for the second
                    sends the user off to create a duplicate of work that is
                    already there, just hidden. */}
                {!loading && !nodes.length && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 px-8 text-center">
                    <GitMerge className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-semibold text-foreground">No dependencies yet</p>
                    <p className="max-w-sm text-xs text-muted-foreground">
                      A dependency links two tasks in the same project — the predecessor has to move before the successor can. Create one to see the graph.
                    </p>
                    <Button size="sm" onClick={() => setIsCreateModalOpen(true)} className="mt-1 gap-2"><Plus className="h-4 w-4" /> Create Dependency</Button>
                  </div>
                )}
                {!loading && nodes.length > 0 && visibleNodeCount === 0 && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 px-8 text-center">
                    <Filter className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-semibold text-foreground">Your filters hide every task</p>
                    <p className="max-w-sm text-xs text-muted-foreground">
                      {nodes.length} task{nodes.length === 1 ? '' : 's'} {nodes.length === 1 ? 'is' : 'are'} on this graph, and none of them match the filters you have set.
                    </p>
                    <Button size="sm" variant="outline" onClick={clearFilters} className="mt-1">Clear filters</Button>
                  </div>
                )}
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onEdgeDoubleClick={onEdgeDoubleClick}
                  onInit={(instance) => { flowRef.current = instance }}
                  nodeTypes={nodeTypes}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
                  className="bg-transparent"
                  minZoom={0.1}
                  maxZoom={2}
                  defaultEdgeOptions={{ type: 'smoothstep' }}
                >
                  <Background variant={BackgroundVariant.Dots} gap={24} size={2} color="var(--primary)" className="opacity-20" />
                  <Controls className="bg-card/95 backdrop-blur-xl border border-primary/20 shadow-2xl rounded-xl overflow-hidden fill-primary text-primary" />
                </ReactFlow>
              </div>
            </div>
          )}
          {activeTab === 'timeline' && (() => {
            // A REAL TIMELINE, COMPUTED FROM THE TASKS' OWN DATES.
            //
            // This tab used to hardcode six column headers ("May 01" ... "Jun
            // 05") and set each bar's width from its STATUS — 100% done, 65%
            // in-progress, 35% otherwise — always starting at position 0. No
            // date was involved anywhere, so the chart was decoration that
            // looked like a schedule.
            //
            // Bars span planned_start_date -> due_date. Most tasks have no
            // planned start: that column is write-only schema, set by no
            // screen. Rather than invent a span, those render as a POINT MARKER
            // on their due date — an honest "this is when it is due, we do not
            // know when it starts".
            const dated = data.tasks
              .filter((task) => task.due_date)
              // Earliest first. It used to render in task-id order, which is
              // insert order — a Gantt chart whose rows ignore time.
              .slice()
              .sort((a, b) => {
                const aStart = a.planned_start_date ?? a.due_date ?? ''
                const bStart = b.planned_start_date ?? b.due_date ?? ''
                return aStart.localeCompare(bStart) || (a.due_date ?? '').localeCompare(b.due_date ?? '')
              })

            // THE RANGE MUST COVER STARTS AS WELL AS DUES. Taking min/max from
            // due dates alone, while positioning bars from planned_start_date,
            // put any task starting before the earliest due date at a NEGATIVE
            // offset — and the track had no overflow clip, so the bar ran out
            // of the chart and across the page.
            const stamps = dated.flatMap((task) => [
              fromDateOnly(task.due_date!)?.getTime(),
              task.planned_start_date ? fromDateOnly(task.planned_start_date)?.getTime() : undefined,
            ]).filter((value): value is number => typeof value === 'number' && !Number.isNaN(value))
            const min = stamps.length ? Math.min(...stamps) : 0
            const max = stamps.length ? Math.max(...stamps) : 0
            // A single-day range would divide by zero; give it a week of air.
            const span = Math.max(max - min, 6 * 86400000)
            const pct = (time: number) => Math.min(100, Math.max(0, ((time - min) / span) * 100))

            const TICKS = 6
            const ticks = Array.from({ length: TICKS }, (_, index) => ({
              at: (100 / (TICKS - 1)) * index,
              date: new Date(min + (span / (TICKS - 1)) * index),
            }))
            const withoutStart = dated.filter((task) => !task.planned_start_date).length

            return (
            <div className="flex h-full flex-col bg-background/30 p-6 overflow-y-auto">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg text-primary"><CalendarDays className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Project Timeline (Gantt)</h2>
                  {dated.length > 0 && withoutStart > 0 && (
                    <p className="text-xs text-muted-foreground">{withoutStart} of {dated.length} tasks have no planned start date, so they show as a marker on their due date rather than a bar.</p>
                  )}
                </div>
              </div>
              {!dated.length ? (
                <div className="flex-1 rounded-xl border border-dashed border-border/50 p-10 text-center text-sm text-muted-foreground">
                  No task in this view has a due date, so there is nothing to place on a timeline.
                </div>
              ) : (
              <div className="flex-1 rounded-xl border border-border/50 bg-card/50 overflow-hidden flex flex-col">
                {/* THE NAME COLUMN IS ONE WIDTH IN BOTH ROWS. The header used
                    w-[300px] while the rows used w-[280px] inside a p-4 track,
                    so every tick sat ~4px left of the bars it labelled. */}
                <div className="flex border-b border-border/50 bg-muted/30 pr-4">
                  <div className="w-[300px] shrink-0 p-3 font-semibold text-sm border-r border-border/50">Task Name</div>
                  {/* Ticks are ABSOLUTELY POSITIONED at the same percentages
                      the bars use. As flex-1 cells they were centred inside
                      equal columns — roughly 8% away from the date they named. */}
                  <div className="relative flex-1 h-11">
                    {ticks.map((tick) => (
                      <div
                        key={tick.date.toISOString()}
                        className="absolute top-0 h-full flex items-center text-xs text-muted-foreground whitespace-nowrap"
                        style={{ left: `${tick.at}%`, transform: tick.at === 0 ? 'none' : tick.at === 100 ? 'translateX(-100%)' : 'translateX(-50%)' }}
                      >
                        {tick.date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto py-4 pr-4 flex flex-col gap-3">
                  {dated.map((task) => {
                    const status = normalizeStatus(task.status, task.at_risk)
                    const color = status === 'completed' ? 'bg-success' : status === 'in_progress' ? 'bg-primary' : status === 'blocked' ? 'bg-rose-500' : status === 'at_risk' ? 'bg-warning' : 'bg-muted-foreground'
                    // A malformed date must not take the whole tab down with
                    // it; an unparseable due date drops the row instead.
                    const due = fromDateOnly(task.due_date)?.getTime()
                    if (due === undefined || Number.isNaN(due)) return null
                    const start = task.planned_start_date ? fromDateOnly(task.planned_start_date)?.getTime() ?? null : null
                    const left = pct(start !== null ? Math.min(start, due) : due)
                    const width = start !== null ? Math.min(Math.max(pct(due) - left, 1.5), 100 - left) : null

                    return (
                    <div key={task.id} className="flex items-center group">
                      <div className="w-[300px] shrink-0 text-sm font-medium px-3 truncate" title={task.title}>{task.title}</div>
                      <div className="flex-1 relative h-8 rounded-md bg-muted/20 border border-border/50 overflow-hidden">
                        {width === null ? (
                          // No planned start: a marker at the due date, not a
                          // fabricated span. Clamped so a marker at 0% or 100%
                          // stays inside its own track.
                          <div
                            className={cn('absolute top-1/2 size-3 -translate-y-1/2 rotate-45 rounded-sm shadow-sm', color)}
                            style={{ left: `calc(${left}% - 6px)`, marginLeft: left === 0 ? '6px' : left === 100 ? '-6px' : 0 }}
                            title={`${task.title} — due ${formatDate(task.due_date)} (no planned start)`}
                          />
                        ) : (
                          <div
                            className={cn('absolute top-1 bottom-1 rounded-md shadow-sm transition-all hover:brightness-110 cursor-pointer', color)}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            title={`${task.title} — ${formatDate(task.planned_start_date)} to ${formatDate(task.due_date)}`}
                          />
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              </div>
              )}
            </div>
            )
          })()}

          {activeTab === 'workstream' && (() => {
            // A BOARD OF WORKSTREAMS, NOT OF PROJECTS.
            //
            // This tab is called "Workstream Boards" and grouped by
            // `task.project`, because the workstream never left the server.
            // Tasks that belong to no workstream get their own explicit column
            // rather than being silently folded into a project.
            const columns = new Map<string, { name: string; tasks: DependencyNode[] }>()
            data.tasks.forEach((task) => {
              const key = task.workstream_id ?? 'none'
              const name = task.workstream ?? 'Not in a workstream'
              if (!columns.has(key)) columns.set(key, { name, tasks: [] })
              columns.get(key)!.tasks.push(task)
            })
            // The unassigned column sorts last; the rest alphabetically.
            const board = Array.from(columns, ([id, column]) => ({ id, ...column }))
              .sort((a, b) => (a.id === 'none' ? 1 : b.id === 'none' ? -1 : a.name.localeCompare(b.name)))

            return (
            // min-h-0 lets the inner scroll area shrink. Without it the header
            // pushes the board row past the bottom of its parent.
            <div className="flex h-full min-h-0 flex-col bg-background/30 p-6">
              <div className="flex items-center gap-3 mb-6 shrink-0">
                <div className="p-2 bg-primary/10 rounded-lg text-primary"><Columns className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Workstream Boards</h2>
                  <p className="text-xs text-muted-foreground">A workstream is a lane of related work inside a project. Set one on a task from the project drawer.</p>
                </div>
              </div>
              {!board.length ? (
                <div className="flex-1 rounded-xl border border-dashed border-border/50 p-10 text-center text-sm text-muted-foreground">
                  No task is on this board yet. Tasks appear here once they take part in a dependency.
                </div>
              ) : (
              <div className="flex flex-1 min-h-0 gap-6 overflow-x-auto pb-4">
                {board.map((column) => (
                  <div key={column.id} className="w-[320px] shrink-0 flex flex-col min-h-0 rounded-3xl bg-card/30 backdrop-blur-2xl border border-primary/10 shadow-xl p-5">
                    <div className="flex items-center justify-between mb-5 shrink-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn('w-2 h-2 rounded-full shrink-0', column.id === 'none' ? 'bg-muted-foreground' : 'bg-primary shadow-[0_0_8px_rgba(59,130,246,0.8)]')} />
                        <h3 className="font-bold text-sm text-foreground truncate" title={column.name}>{column.name}</h3>
                      </div>
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full shrink-0">{column.tasks.length}</span>
                    </div>
                    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto pr-1">
                      {column.tasks.map((task) => (
                        <div key={task.id} className="group bg-card/80 backdrop-blur-md p-5 rounded-2xl shadow-lg border border-primary/5 hover:border-primary/40 hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-300 flex flex-col gap-3">
                          <div className="flex justify-between items-center gap-2">
                            <div className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-md">T-{task.id}</div>
                            <span className="text-[10px] text-muted-foreground truncate" title={task.project}>{task.project}</span>
                          </div>
                          <h4 className="font-bold text-sm text-foreground/90 leading-snug">{task.title}</h4>
                          <div className="flex justify-between items-center mt-2 pt-3 border-t border-border/50">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                              <Calendar className="h-3.5 w-3.5" /> {formatDate(task.due_date) ?? 'No due date'}
                            </div>
                            <div className="h-7 w-7 rounded-full border-2 border-card bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-[10px] font-bold shadow-sm" title={task.assignee}>
                              {task.assignee.charAt(0)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>
            )
          })()}

          {activeTab === 'milestone' && (
            <div className="flex h-full flex-col bg-background/30 p-6 overflow-y-auto">
              <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary"><Target className="h-5 w-5" /></div>
                  <h2 className="text-xl font-bold text-foreground">Project Milestones</h2>
                </div>
                {/* CREATE/EDIT/DELETE ALL EXISTED ON THE SERVER AND NOTHING
                    CALLED THEM — a milestone could only appear by writing to
                    the database directly. */}
                <Button size="sm" onClick={() => openMilestoneModal(null)} className="gap-2"><Plus className="h-4 w-4" /> New Milestone</Button>
              </div>
              <div className="max-w-4xl mx-auto w-full flex flex-col gap-4">
                {!data.milestones.length && (
                  <div className="rounded-xl border border-dashed border-border/50 p-10 text-center">
                    <p className="text-sm font-semibold text-foreground">No milestones yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">A milestone marks a date a project — or one workstream inside it — has to hit.</p>
                  </div>
                )}
                {data.milestones.map((ms, i) => {
                  const Icon = ms.status === 'COMPLETED' ? CheckCircle2 : ms.status === 'AT RISK' ? AlertCircle : Flag
                  const color = ms.status === 'COMPLETED' ? 'text-emerald-500 bg-success/10 border-emerald-500/20' : ms.status === 'AT RISK' ? 'text-amber-500 bg-warning/10 border-amber-500/20' : 'text-primary bg-primary/10 border-primary/20'
                  return (
                  // Keyed on the milestone's id. Keyed on the array index, a
                  // delete re-used the removed card's state on its neighbour.
                  <div key={ms.id} className="flex items-stretch gap-6 group">
                    <div className="flex flex-col items-center">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-lg", color.split(' ')[1])}>
                        <Icon className={cn("h-6 w-6", color.split(' ')[0])} />
                      </div>
                      {i !== data.milestones.length - 1 && <div className="w-0.5 flex-1 bg-gradient-to-b from-primary/30 to-transparent my-3 rounded-full" />}
                    </div>
                    <div className="flex-1 bg-card/30 backdrop-blur-3xl border border-primary/10 rounded-3xl p-6 mb-6 shadow-xl group-hover:shadow-2xl group-hover:shadow-primary/5 group-hover:border-primary/30 transition-all duration-300 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                      <div className="flex justify-between items-start gap-4 mb-4 relative z-10">
                        <div className="min-w-0">
                          <h3 className="text-xl font-black text-foreground tracking-tight mb-1.5">{ms.name}</h3>
                          {/* project_name, workstream_name and description
                              were all returned and all discarded, so a card
                              could not say which project it belonged to. */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm font-medium text-muted-foreground">
                            <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary/70" /> {formatDate(ms.target_date) ?? ms.target_date}</span>
                            <span className="flex items-center gap-2"><Columns className="h-4 w-4 text-primary/70" /> {ms.project_name}{ms.workstream_name ? ` · ${ms.workstream_name}` : ''}</span>
                          </div>
                          {ms.description && <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{ms.description}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={ms.status} />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-5 border-t border-primary/10 relative z-10">
                        {/* THESE NUMBERS DESCRIBE THIS MILESTONE. Every card
                            used to print data.summary.blocking — one
                            tenant-wide figure repeated on all of them. */}
                        <div className="flex items-center gap-6 text-sm">
                          <div className="flex flex-col">
                            <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-0.5">Tasks</span>
                            <span className="font-black text-foreground">{ms.counts?.total ?? 0}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-0.5">Completed</span>
                            <span className="font-black text-emerald-500">{ms.counts?.completed ?? 0}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-0.5">Blocked</span>
                            <span className="font-black text-rose-500">{ms.counts?.blocked ?? 0}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-0.5">Overdue</span>
                            <span className="font-black text-amber-500">{ms.counts?.overdue ?? 0}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openMilestoneModal(ms)} className="h-9 gap-1.5 rounded-xl font-bold">
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => void removeMilestone(ms)} className="h-9 gap-1.5 rounded-xl font-bold text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* ─────────────────────────────────────────────────────────────────
          THE LAYOUT BREAK.

          DialogContent was passed no className, so it inherited max-w-lg with
          NO max-height and NO overflow. The form is around 600px tall; on a
          1366x768 screen it clipped at BOTH ends with nothing to scroll. The
          sizing here is copied from create-project-modal.tsx, which solved the
          same problem in the same module.
          ───────────────────────────────────────────────────────────────── */}
      <Dialog open={isCreateModalOpen} onOpenChange={(open) => { setIsCreateModalOpen(open); if (!open) setFormError('') }}>
        <DialogContent className="max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Create Dependency</DialogTitle>
            <DialogDescription>Connect two tasks. Duplicate and cyclic relationships are rejected by the API.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 px-1">
            {/* ERRORS BELONG INSIDE THE DIALOG. setError() renders a banner in
                the page behind this overlay, so a duplicate or cycle 422 looked
                like the button simply did nothing. */}
            {formError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
                {formError}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm font-medium"><span>Project</span><SearchableSelect value={selectedProject} onChange={setSelectedProject} placeholder="Select project" searchPlaceholder="Search by name, code or manager…" options={projectPickerOptions(data.options.projects)} /></label>
              <label className="block space-y-1.5 text-sm font-medium"><span>Workstream</span><Select value={selectedWorkstream} onChange={setSelectedWorkstream} placeholder={workstreamsLoading ? 'Loading...' : selectedProject ? 'Select workstream' : 'Select project first'} options={workstreams.map((ws) => ({ value: String(ws.id), label: ws.name }))} disabled={!selectedProject || workstreamsLoading} /></label>
            </div>
            {workstreamsError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{workstreamsError}</div>}
            {/* THE PROJECT SELECT NOW NARROWS THESE LISTS.
                It never did, so a user could pick project A then two tasks from
                project B — and the server refused with a confusing
                "Dependencies require two tasks from the same project". The
                option rows already carry project_id; nothing was reading it. */}
            <label className="block space-y-1.5 text-sm font-medium"><span>Predecessor</span><Select value={predecessor} onChange={setPredecessor} placeholder={selectedProject ? 'Select predecessor' : 'Select a task'} options={eligibleTasks.map((task) => ({ value: String(task.id), label: task.title }))} /></label>
            <label className="block space-y-1.5 text-sm font-medium"><span>Successor</span><Select value={successor} onChange={setSuccessor} placeholder="Select successor" options={eligibleTasks.filter((task) => String(task.id) !== predecessor).map((task) => ({ value: String(task.id), label: task.title }))} /></label>
            {selectedProject && !eligibleTasks.length && <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">This project has no linked tasks yet, so no dependency can be created inside it.</div>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm font-medium"><span>Type</span><Select value={dependencyType} onChange={(value) => setDependencyType(value as DependencyType)} options={data.options.types.map((value) => ({ value, label: DEPENDENCY_TYPE_LABELS[value] ?? value }))} /></label>
              {/* The Select renders at h-8 and this input was h-10, so the two
                  halves of one row sat at different heights. */}
              <label className="block space-y-1.5 text-sm font-medium"><span>Lag days</span><input type="number" min={-365} max={365} step={1} value={lagDays} onChange={(event) => setLagDays(event.target.value)} className="h-8 w-full rounded-lg border bg-background px-3 text-sm" /></label>
            </div>
            {/* WHAT THESE FOUR FIELDS MEAN, where someone filling them in can
                read it. The lag is applied to the predecessor's anchor date;
                the result is shown on the map with an Apply button. */}
            <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">{DEPENDENCY_TYPE_LABELS[dependencyType]}</span> — {DEPENDENCY_TYPE_HELP[dependencyType]}
              {Number(lagDays) !== 0 && ` A lag of ${lagDays} day(s) shifts that date by ${lagDays}.`}
            </p>
            <label className="block space-y-1.5 text-sm font-medium"><span>Notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-24 w-full resize-none rounded-lg border bg-background p-3 text-sm" /></label>
          </div>
          <DialogFooter className="shrink-0"><Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button><Button disabled={saving || !predecessor || !successor} onClick={() => void createDependency()}>{saving ? 'Creating…' : 'Create Dependency'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MILESTONE CRUD. The endpoints have always been there; this is the
          first thing that calls them. */}
      <Dialog open={milestoneModalOpen} onOpenChange={(open) => { setMilestoneModalOpen(open); if (!open) setMilestoneError('') }}>
        <DialogContent className="max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editingMilestone ? 'Edit Milestone' : 'New Milestone'}</DialogTitle>
            <DialogDescription>A milestone marks a date a project — or one workstream inside it — has to hit.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 px-1">
            {milestoneError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
                {milestoneError}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm font-medium">
                <span>Project</span>
                <SearchableSelect
                  value={milestoneForm.project_id}
                  onChange={(value) => setMilestoneForm((form) => ({ ...form, project_id: value, workstream_id: '' }))}
                  placeholder="Select project"
                  searchPlaceholder="Search by name, code or manager…"
                  options={projectPickerOptions(data.options.projects)}
                />
              </label>
              <label className="block space-y-1.5 text-sm font-medium">
                <span>Workstream <span className="font-normal text-muted-foreground">(optional)</span></span>
                <Select
                  value={milestoneForm.workstream_id}
                  onChange={(value) => setMilestoneForm((form) => ({ ...form, workstream_id: value }))}
                  placeholder={milestoneForm.project_id ? 'Whole project' : 'Select project first'}
                  options={milestoneWorkstreams.map((ws) => ({ value: String(ws.id), label: ws.name }))}
                  disabled={!milestoneForm.project_id}
                />
              </label>
            </div>
            <label className="block space-y-1.5 text-sm font-medium">
              <span>Name</span>
              <input value={milestoneForm.name} onChange={(event) => setMilestoneForm((form) => ({ ...form, name: event.target.value }))} maxLength={191} className="h-8 w-full rounded-lg border bg-background px-3 text-sm" />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm font-medium">
                <span>Target date</span>
                {/* A plain date input keeps the value in `YYYY-MM-DD` from end
                    to end, which is the one format the column stores. */}
                <input type="date" value={milestoneForm.target_date} onChange={(event) => setMilestoneForm((form) => ({ ...form, target_date: event.target.value }))} className="h-8 w-full rounded-lg border bg-background px-3 text-sm" />
              </label>
              <label className="block space-y-1.5 text-sm font-medium">
                <span>Status</span>
                <Select
                  value={milestoneForm.status}
                  onChange={(value) => setMilestoneForm((form) => ({ ...form, status: value as TaskMilestone['status'] }))}
                  options={MILESTONE_STATUSES.map((value) => ({ value, label: value }))}
                />
              </label>
            </div>
            <label className="block space-y-1.5 text-sm font-medium">
              <span>Description <span className="font-normal text-muted-foreground">(optional)</span></span>
              <textarea value={milestoneForm.description} onChange={(event) => setMilestoneForm((form) => ({ ...form, description: event.target.value }))} maxLength={5000} className="min-h-24 w-full resize-none rounded-lg border bg-background p-3 text-sm" />
            </label>
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setMilestoneModalOpen(false)}>Cancel</Button>
            <Button disabled={milestoneSaving} onClick={() => void saveMilestone()}>
              {milestoneSaving ? 'Saving…' : editingMilestone ? 'Save Changes' : 'Create Milestone'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

