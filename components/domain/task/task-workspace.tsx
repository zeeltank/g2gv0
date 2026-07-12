'use client'

import React, { useState } from 'react'
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ListChecks, 
  Plus,
  Search,
  Filter,
  LayoutGrid,
  List,
  CalendarDays,
  MoreVertical,
  CheckSquare,
  BarChart2
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Tooltip } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { mockTasks } from '@/lib/mock-data/task-management'
import { cn } from '@/lib/utils'

import { TaskDetailsDrawer } from './task-details-drawer'
import { CreateTaskModal } from './create-task-modal'
import { TaskListView } from './task-list-view'
import { TaskBoardView } from './task-board-view'
import { TaskApprovalsView } from './task-approvals-view'
import { TaskWorkloadView } from './task-workload-view'
import { TaskCalendarView } from './task-calendar-view'
import { Task } from '@/types/task-management'

export function TaskWorkspace() {
  const [scope, setScope] = useState<'all' | 'team' | 'department' | 'archived'>('all')
  const [view, setView] = useState<'list' | 'board' | 'approvals' | 'workload' | 'calendar'>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Apply base scope filtering to mock data
  const baseTasks = mockTasks.filter(t => {
    if (scope === 'archived') return t.status === 'completed' // mock assumption
    if (scope === 'team' || scope === 'department') return t.status !== 'completed' // just mock subset logic
    return true
  })

  // Derived metrics for Pulse Cards
  const activeTasks = baseTasks.filter(t => t.status === 'in_progress' || t.status === 'draft').length
  const reviewTasks = baseTasks.filter(t => t.status === 'review').length
  const blockedTasks = baseTasks.filter(t => t.status === 'blocked').length
  const completedTasks = baseTasks.filter(t => t.status === 'completed').length

  const pulseData = [
    {
      id: 'active',
      title: 'Active Tasks',
      value: activeTasks,
      subtitle: `${completedTasks} completed this week`,
      icon: ListChecks,
      trend: { direction: 'up' as const, label: 'On track' },
    },
    {
      id: 'review',
      title: 'Pending Review',
      value: reviewTasks,
      subtitle: 'Awaiting managerial approval',
      icon: Clock,
      actionLabel: reviewTasks > 0 ? 'Review now' : undefined,
    },
    {
      id: 'blocked',
      title: 'Blocked / Overdue',
      value: blockedTasks,
      subtitle: 'Requires immediate attention',
      icon: AlertCircle,
      trend: blockedTasks > 0 ? { direction: 'down' as const, label: 'Critical' } : undefined,
      actionLabel: blockedTasks > 0 ? 'Unblock tasks' : undefined,
    },
    {
      id: 'completed',
      title: 'Completed',
      value: completedTasks,
      subtitle: 'Tasks finished this month',
      icon: CheckCircle2,
      trend: { direction: 'up' as const, label: '+12% from last month' }
    }
  ]

  let filteredTasks = baseTasks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.assignee.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (filterStatus === 'my_tasks') {
    filteredTasks = filteredTasks.filter(t => t.assignee === 'Sarah Chen')
  } else if (filterStatus === 'high_priority') {
    filteredTasks = filteredTasks.filter(t => t.priority === 'urgent' || t.priority === 'high')
  } else if (filterStatus === 'due_today') {
    filteredTasks = filteredTasks.filter(t => new Date(t.dueDate) <= new Date())
  }

  // Moved color utils to lib/task-utils.ts

  return (
    <div className="flex h-full flex-col gap-6">
      {/* Header & Pulse */}
      <div className="flex flex-col gap-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {scope === 'all' && 'All Tasks Workspace'}
              {scope === 'team' && 'Team Tasks'}
              {scope === 'department' && 'Department Tasks'}
              {scope === 'archived' && 'Archived Tasks'}
            </h1>
          </div>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="cursor-pointer shadow-sm bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 transition-all duration-300"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Task
          </Button>
        </div>
        {scope !== 'archived' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        )}
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between bg-card/50 backdrop-blur-sm border border-primary/10 rounded-xl p-2 shadow-sm shrink-0 relative z-20">
        <div className="flex items-center gap-2 flex-1 max-w-md ml-2 relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tasks, assignees, or projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2 pr-2">
          <Select 
            value={scope} 
            onChange={(val) => setScope(val as any)}
            options={[
              { label: 'All Tasks Workspace', value: 'all' },
              { label: 'Team Tasks', value: 'team' },
              { label: 'Department Tasks', value: 'department' },
              { label: 'Archived Tasks', value: 'archived' }
            ]}
            className="w-[200px]"
          />
          <Select 
            value={filterStatus} 
            onChange={setFilterStatus}
            options={[
              { label: 'All Statuses', value: 'all' },
              { label: 'High Priority', value: 'high_priority' },
              { label: 'Due Today', value: 'due_today' }
            ]}
            className="w-[140px]"
          />
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-9 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors outline-none cursor-pointer">
              <Filter className="mr-2 h-4 w-4" /> More
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>Assigned to me</DropdownMenuItem>
              <DropdownMenuItem>Created by me</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-danger">Clear all filters</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="h-5 w-px bg-border mx-1" />
          <div className="flex bg-muted/50 rounded-lg p-1 border border-border/50">
            <Tooltip content="List View">
              <Button variant="ghost"
                onClick={() => setView('list')}
                className={cn(
                  "p-1.5 rounded-md transition-all cursor-pointer",
                  view === 'list' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <List className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Board View">
              <Button variant="ghost"
                onClick={() => setView('board')}
                className={cn(
                  "p-1.5 rounded-md transition-all cursor-pointer",
                  view === 'board' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Approvals Workbench">
              <Button variant="ghost"
                onClick={() => setView('approvals')}
                className={cn(
                  "p-1.5 rounded-md transition-all cursor-pointer",
                  view === 'approvals' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <CheckSquare className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Workload & Capacity">
              <Button variant="ghost"
                onClick={() => setView('workload')}
                className={cn(
                  "p-1.5 rounded-md transition-all cursor-pointer",
                  view === 'workload' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <BarChart2 className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden flex flex-col">
        {view === 'list' && <TaskListView tasks={filteredTasks} onSelectTask={setSelectedTask} />}
        {view === 'board' && <TaskBoardView tasks={filteredTasks} onSelectTask={setSelectedTask} />}
        {view === 'approvals' && <TaskApprovalsView tasks={filteredTasks} onSelectTask={setSelectedTask} />}
        {view === 'workload' && <TaskWorkloadView tasks={baseTasks} />}
        {view === 'calendar' && <TaskCalendarView tasks={filteredTasks} onSelectTask={setSelectedTask} />}
      </div>

      <TaskDetailsDrawer 
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
      />

      <CreateTaskModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  )
}

