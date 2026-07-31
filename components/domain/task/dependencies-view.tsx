'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { 
  Users, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Flag, 
  GitMerge, 
  Search, 
  Filter, 
  Plus,
  Layout,
  ArrowRight,
  UserCircle2,
  Calendar,
  AlertCircle,
  CalendarDays,
  Columns,
  Target,
  MoreVertical,
  ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
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
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  BackgroundVariant,
  MarkerType,
  Panel,
  Edge,
  Node,
  addEdge,
  Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { taskChartColors } from '@/lib/chart-colors'
import { getLaravelContext } from '@/lib/laravel-context'
import { taskService } from '@/services/task'
import type { DependenciesResponse, DependencyNode, DependencyType, TaskDependency } from '@/types/task-management'

// Custom Premium Node Component
const TaskNode = ({ data }: { id: string; data: Record<string, any> }) => {
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed': return 'from-emerald-500/20 to-emerald-500/5 text-emerald-500 border-emerald-500/30 ring-emerald-500/20'
      case 'in_progress': return 'from-blue-500/20 to-blue-500/5 text-primary border-blue-500/30 ring-blue-500/20'
      case 'at_risk': return 'from-amber-500/20 to-amber-500/5 text-amber-500 border-amber-500/30 ring-amber-500/20'
      case 'blocked': return 'from-rose-500/20 to-rose-500/5 text-rose-500 border-rose-500/30 ring-rose-500/20'
      case 'milestone': return 'from-purple-500/20 to-purple-500/5 text-primary border-purple-500/30 ring-purple-500/20'
      default: return 'from-slate-500/20 to-slate-500/5 text-slate-500 border-slate-500/30 ring-slate-500/20'
    }
  }

  const getStatusIconColor = (status: string) => {
    switch(status) {
      case 'completed': return 'text-emerald-500 bg-success/10'
      case 'in_progress': return 'text-primary bg-primary/10'
      case 'at_risk': return 'text-amber-500 bg-warning/10'
      case 'blocked': return 'text-rose-500 bg-rose-500/10'
      case 'milestone': return 'text-primary bg-primary/10'
      default: return 'text-slate-500 bg-slate-500/10'
    }
  }

  const getIcon = (status: string) => {
    switch(status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4" />
      case 'in_progress': return <Clock className="h-4 w-4" />
      case 'at_risk': return <AlertCircle className="h-4 w-4" />
      case 'blocked': return <AlertTriangle className="h-4 w-4" />
      case 'milestone': return <Flag className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const formatStatus = (status: string) => status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())

  const isMilestone = data.status === 'milestone'

  return (
    <div className={cn(
      "group relative w-[280px] rounded-2xl border bg-card/90 backdrop-blur-2xl p-4 shadow-xl transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:z-50",
      getStatusColor(data.status),
      data.selected ? 'ring-4' : 'ring-0',
      data.status === 'blocked' ? 'animate-pulse shadow-rose-500/20' : ''
    )}>
      {/* Handles with custom styling to ensure connection points are visible */}
      <Handle 
        type="target" 
        position={Position.Left} 
        className={cn(
          "w-5 h-5 border-2 transition-all duration-300 group-hover:scale-125 !bg-background cursor-crosshair z-20",
          getStatusColor(data.status).split(' ')[1] // Uses text color class as border
        )}
      />
      <Handle 
        type="source" 
        position={Position.Right} 
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

function normalizeStatus(status: string, atRisk = false) {
  if (atRisk) return 'at_risk'
  const value = status.toUpperCase()
  if (value === 'COMPLETED') return 'completed'
  if (value === 'IN-PROGRESS' || value === 'IN PROGRESS') return 'in_progress'
  if (value === 'ON HOLD') return 'blocked'
  return 'not_started'
}

function graphNodes(tasks: DependencyNode[]): Node[] {
  return Array.from(new Map(tasks.map((task) => [task.id, task])).values()).map((task, index) => ({
    id: task.id, type: 'taskNode',
    position: { x: (index % 4) * 390 + 50, y: Math.floor(index / 4) * 230 + 80 },
    data: {
      id: `T-${task.id}`, title: task.title, status: normalizeStatus(task.status, task.at_risk),
      assignee: task.assignee, duration: task.due_date ?? 'No due date', project: task.project,
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

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await taskService.getDependencies(getLaravelContext())
      const uniqueTasks = Array.from(new Map(response.data.tasks.map((task) => [task.id, task])).values())
      const uniqueDependencies = Array.from(new Map(response.data.dependencies.map((dependency) => [dependency.id, dependency])).values())
      const nextData = { ...response.data, tasks: uniqueTasks, dependencies: uniqueDependencies }
      const nextNodes = graphNodes(uniqueTasks)
      setData(nextData); setBaseNodes(nextNodes); setNodes(nextNodes); setEdges(graphEdges(uniqueDependencies))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load dependencies.')
    } finally { setLoading(false) }
  }, [reload, setEdges, setNodes])

  useEffect(() => { void load() }, [load])

  // Filter States
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [filterAssignee, setFilterAssignee] = useState<string | null>(null)
  const [filterProject, setFilterProject] = useState<string | null>(null)

  // Apply filters whenever state changes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        let isVisible = true
        if (filterStatus && node.data.status !== filterStatus) {
          isVisible = false
        }
        if (filterAssignee && node.data.assignee !== filterAssignee) {
          isVisible = false
        }
        if (filterProject && node.data.project !== filterProject) {
          isVisible = false
        }
        return { ...node, hidden: !isVisible }
      })
    )
    
    // Also hide edges if either source or target is hidden
    setEdges((eds) => 
      eds.map((edge) => {
        const sourceNode = baseNodes.find(n => n.id === edge.source)
        const targetNode = baseNodes.find(n => n.id === edge.target)
        let isVisible = true
        
        if (filterStatus && (sourceNode?.data.status !== filterStatus && targetNode?.data.status !== filterStatus)) isVisible = false
        if (filterAssignee && (sourceNode?.data.assignee !== filterAssignee && targetNode?.data.assignee !== filterAssignee)) isVisible = false
        if (filterProject && (sourceNode?.data.project !== filterProject && targetNode?.data.project !== filterProject)) isVisible = false

        return { ...edge, hidden: !isVisible }
      })
    )
  }, [baseNodes, filterStatus, filterAssignee, filterProject, setNodes, setEdges])

  const handleLayout = (direction: 'TB' | 'LR' | 'reset') => {
    if (direction === 'reset') {
      setNodes(baseNodes.map((node) => ({ ...node })))
      return
    }

    const newNodes = nodes.map(node => {
      const initial = baseNodes.find(n => n.id === node.id)
      if (!initial) return node

      if (direction === 'TB') {
        // Mock a top-to-bottom layout by flipping coordinates
        return { 
          ...node, 
          position: { 
            x: initial.position.y * 3, 
            y: initial.position.x * 0.8 
          } 
        }
      } else {
        // Left to Right (restore original)
        return { ...node, position: initial.position }
      }
    })
    setNodes(newNodes)
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
    if (!predecessor || !successor) { setError('Select predecessor and successor tasks.'); return }
    setSaving(true); setError('')
    try {
      const response = await taskService.createDependency(getLaravelContext(), {
        predecessor_task_id: predecessor, successor_task_id: successor,
        dependency_type: dependencyType, lag_days: Number(lagDays) || 0, notes: notes || undefined,
      })
      setMessage(response.message); setIsCreateModalOpen(false); setPredecessor(''); setSuccessor(''); setNotes(''); setLagDays('0')
      setReload((value) => value + 1)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create dependency.') }
    finally { setSaving(false) }
  }

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
                <DropdownMenuItem onClick={() => handleLayout('LR')} className="cursor-pointer font-medium text-primary">Left to Right (Dagre)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleLayout('TB')} className="cursor-pointer">Top to Bottom</DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">Radial Hierarchy</DropdownMenuItem>
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

                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-bold text-foreground/50 tracking-wider uppercase">Filter By Assignee</div>
                <DropdownMenuItem onClick={() => setFilterAssignee(filterAssignee === 'Sarah' ? null : 'Sarah')} className="cursor-pointer">
                  <span className="w-4 inline-block">{filterAssignee === 'Sarah' ? '✓' : ''}</span> Sarah
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterAssignee(filterAssignee === 'Michael' ? null : 'Michael')} className="cursor-pointer">
                  <span className="w-4 inline-block">{filterAssignee === 'Michael' ? '✓' : ''}</span> Michael
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterAssignee(filterAssignee === 'Dwight' ? null : 'Dwight')} className="cursor-pointer">
                  <span className="w-4 inline-block">{filterAssignee === 'Dwight' ? '✓' : ''}</span> Dwight
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-bold text-foreground/50 tracking-wider uppercase">Filter By Project</div>
                <DropdownMenuItem onClick={() => setFilterProject(filterProject === 'Alpha Release' ? null : 'Alpha Release')} className="cursor-pointer">
                  <span className="w-4 inline-block">{filterProject === 'Alpha Release' ? '✓' : ''}</span> Alpha Release
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterProject(filterProject === 'Beta Testing' ? null : 'Beta Testing')} className="cursor-pointer">
                  <span className="w-4 inline-block">{filterProject === 'Beta Testing' ? '✓' : ''}</span> Beta Testing
                </DropdownMenuItem>

                {(filterStatus || filterAssignee || filterProject) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => { setFilterStatus(null); setFilterAssignee(null); setFilterProject(null); }} 
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
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Node Status</h4>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-success shadow-[0_0_10px_rgba(16,185,129,0.5)]" /><span className="text-sm font-semibold">On Track / Done</span></div>
                    <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]" /><span className="text-sm font-semibold">In Progress</span></div>
                    <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-warning shadow-[0_0_10px_rgba(245,158,11,0.5)]" /><span className="text-sm font-semibold">At Risk</span></div>
                    <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)] animate-pulse" /><span className="text-sm font-semibold">Blocked</span></div>
                    <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-sm bg-primary shadow-[0_0_10px_rgba(168,85,247,0.5)] rotate-45" /><span className="text-sm font-semibold">Milestone</span></div>
                  </div>
                </div>
                
                <div className="h-px bg-border/50" />
                
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Edge Types</h4>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-0 border-t-2 border-emerald-500" />
                      <span className="text-xs font-semibold text-muted-foreground">Completed Line</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-0 border-t-2 border-blue-500 border-dashed" />
                      <span className="text-xs font-semibold text-muted-foreground">Active Flow</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-0 border-t-2 border-rose-500 border-dashed animate-pulse" />
                      <span className="text-xs font-semibold text-muted-foreground">Blocking Error</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ReactFlow Canvas Area */}
              <div className="flex-1 h-full bg-background/30 relative">
                {loading && <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/60 backdrop-blur-sm"><Spinner /></div>}
                <div className="absolute top-4 left-4 z-10 bg-card/80 backdrop-blur-md px-3 py-2 rounded-xl border border-primary/10 shadow-sm flex items-center gap-2 text-xs font-medium text-muted-foreground animate-in fade-in">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Drag between nodes to connect. Double-click any line to delete.
                </div>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onEdgeDoubleClick={onEdgeDoubleClick}
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
          {activeTab === 'timeline' && (
            <div className="flex h-full flex-col bg-background/30 p-6 overflow-y-auto">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg text-primary"><CalendarDays className="h-5 w-5" /></div>
                <h2 className="text-xl font-bold text-foreground">Project Timeline (Gantt)</h2>
              </div>
              <div className="flex-1 rounded-xl border border-border/50 bg-card/50 overflow-hidden flex flex-col">
                <div className="flex border-b border-border/50 bg-muted/30">
                  <div className="w-[300px] p-3 font-semibold text-sm border-r border-border/50">Task Name</div>
                  <div className="flex-1 flex text-xs text-muted-foreground">
                    {['May 01', 'May 08', 'May 15', 'May 22', 'May 29', 'Jun 05'].map(date => (
                      <div key={date} className="flex-1 p-3 border-r border-border/50 truncate text-center">{date}</div>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                  {data.tasks.map((task, i) => {
                    const status = normalizeStatus(task.status, task.at_risk)
                    const color = status === 'completed' ? 'bg-success' : status === 'in_progress' ? 'bg-primary' : status === 'blocked' ? 'bg-rose-500' : status === 'at_risk' ? 'bg-warning' : 'bg-muted-foreground'
                    const width = status === 'completed' ? '100%' : status === 'in_progress' ? '65%' : '35%'
                    return (
                    <div key={i} className="flex items-center group">
                      <div className="w-[280px] shrink-0 text-sm font-medium pr-4 truncate">{task.title}</div>
                      <div className="flex-1 relative h-8 rounded-md bg-muted/20 border border-border/50">
                        <div 
                          className={cn("absolute top-1 bottom-1 rounded-md shadow-sm transition-all hover:brightness-110 cursor-pointer", color)}
                          style={{ left: 0, width }}
                        />
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'workstream' && (
            <div className="flex h-full flex-col bg-background/30 p-6 overflow-x-auto">
              <div className="flex items-center gap-3 mb-6 shrink-0">
                <div className="p-2 bg-primary/10 rounded-lg text-primary"><Columns className="h-5 w-5" /></div>
                <h2 className="text-xl font-bold text-foreground">Workstream Boards</h2>
              </div>
              <div className="flex gap-6 h-full pb-4">
                {Array.from(new Set(data.tasks.map((task) => task.project))).map((project, i) => {
                  const streamTasks = data.tasks.filter((task) => task.project === project)
                  return (
                  <div key={i} className="w-[320px] shrink-0 flex flex-col h-full rounded-3xl bg-card/30 backdrop-blur-2xl border border-primary/10 shadow-xl p-5">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", i === 0 ? "bg-primary shadow-[0_0_8px_rgba(168,85,247,0.8)]" : i === 1 ? "bg-primary shadow-[0_0_8px_rgba(59,130,246,0.8)]" : i === 2 ? "bg-success shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-warning shadow-[0_0_8px_rgba(245,158,11,0.8)]")} />
                        <h3 className="font-bold text-sm text-foreground">{project}</h3>
                      </div>
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">{streamTasks.length}</span>
                    </div>
                    <div className="flex flex-col gap-4 flex-1 overflow-y-auto pr-1">
                      {streamTasks.map((task) => (
                        <div key={task.id} className="group bg-card/80 backdrop-blur-md p-5 rounded-2xl shadow-lg border border-primary/5 hover:border-primary/40 hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col gap-3">
                          <div className="flex justify-between items-center">
                            <div className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-md">T-{task.id}</div>
                            <MoreVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <h4 className="font-bold text-sm text-foreground/90 group-hover:text-foreground transition-colors leading-snug">{task.title}</h4>
                          <div className="flex justify-between items-center mt-2 pt-3 border-t border-border/50">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                              <Calendar className="h-3.5 w-3.5" /> {task.due_date ?? 'No due date'}
                            </div>
                            <div className="flex -space-x-2">
                              <div className="h-7 w-7 rounded-full border-2 border-card bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-[10px] font-bold shadow-sm">{task.assignee.charAt(0)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )})}
              </div>
            </div>
          )}

          {activeTab === 'milestone' && (
            <div className="flex h-full flex-col bg-background/30 p-6 overflow-y-auto">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg text-primary"><Target className="h-5 w-5" /></div>
                <h2 className="text-xl font-bold text-foreground">Project Milestones</h2>
              </div>
              <div className="max-w-4xl mx-auto w-full flex flex-col gap-4">
                {data.milestones.map((ms, i) => {
                  const Icon = ms.status === 'COMPLETED' ? CheckCircle2 : ms.status === 'AT RISK' ? AlertCircle : Flag
                  const color = ms.status === 'COMPLETED' ? 'text-emerald-500 bg-success/10 border-emerald-500/20' : ms.status === 'AT RISK' ? 'text-amber-500 bg-warning/10 border-amber-500/20' : 'text-primary bg-primary/10 border-primary/20'
                  return (
                  <div key={i} className="flex items-stretch gap-6 group cursor-pointer">
                    <div className="flex flex-col items-center">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-lg", color.split(' ')[1])}>
                        <Icon className={cn("h-6 w-6", color.split(' ')[0])} />
                      </div>
                      {i !== data.milestones.length - 1 && <div className="w-0.5 flex-1 bg-gradient-to-b from-primary/30 to-transparent my-3 rounded-full" />}
                    </div>
                    <div className="flex-1 bg-card/30 backdrop-blur-3xl border border-primary/10 rounded-3xl p-6 mb-6 shadow-xl group-hover:shadow-2xl group-hover:shadow-primary/5 group-hover:border-primary/30 group-hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                      <div className="flex justify-between items-start mb-4 relative z-10">
                        <div>
                          <h3 className="text-xl font-black text-foreground tracking-tight mb-1.5 group-hover:text-primary transition-colors">{ms.name}</h3>
                          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <CalendarDays className="h-4 w-4 text-primary/70" /> {ms.target_date}
                          </div>
                        </div>
                        <StatusBadge status={ms.status} />
                      </div>
                      <div className="flex items-center justify-between mt-6 pt-5 border-t border-primary/10 relative z-10">
                        <div className="flex items-center gap-6 text-sm">
                          <div className="flex flex-col">
                            <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-0.5">Blocked</span>
                            <span className="font-black text-rose-500">{data.summary.blocking} Tasks</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-0.5">Completed</span>
                            <span className="font-black text-emerald-500">{data.tasks.filter((task) => task.status?.toUpperCase() === 'COMPLETED').length} Tasks</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="h-9 gap-1 text-primary hover:bg-primary/10 rounded-xl font-bold">
                          View Details <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Dependency</DialogTitle>
            <DialogDescription>Connect two tasks. Duplicate and cyclic relationships are rejected by the API.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="block space-y-1.5 text-sm font-medium"><span>Predecessor</span><Select value={predecessor} onChange={setPredecessor} placeholder="Select predecessor" options={data.options.tasks.map((task) => ({ value: String(task.id), label: task.title }))} /></label>
            <label className="block space-y-1.5 text-sm font-medium"><span>Successor</span><Select value={successor} onChange={setSuccessor} placeholder="Select successor" options={data.options.tasks.filter((task) => String(task.id) !== predecessor).map((task) => ({ value: String(task.id), label: task.title }))} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5 text-sm font-medium"><span>Type</span><Select value={dependencyType} onChange={(value) => setDependencyType(value as DependencyType)} options={data.options.types.map((value) => ({ value, label: value }))} /></label>
              <label className="block space-y-1.5 text-sm font-medium"><span>Lag days</span><input type="number" min={-365} max={365} value={lagDays} onChange={(event) => setLagDays(event.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm" /></label>
            </div>
            <label className="block space-y-1.5 text-sm font-medium"><span>Notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-24 w-full rounded-lg border bg-background p-3 text-sm" /></label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button><Button disabled={saving || !predecessor || !successor} onClick={() => void createDependency()}>{saving ? 'Creating…' : 'Create Dependency'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

