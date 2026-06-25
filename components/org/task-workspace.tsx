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
import { ModulePulse } from './module-pulse'
import { Button } from '@/components/ui/button'
import { mockTasks } from '@/lib/mock-data/task-management'
import { cn } from '@/lib/utils'

import { TaskDetailsDrawer } from './task-details-drawer'
import { CreateTaskModal } from './create-task-modal'
import { Task } from '@/types/task-management'

export function TaskWorkspace() {
  const [view, setView] = useState<'list' | 'board' | 'approvals' | 'workload'>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Derived metrics for Pulse Cards
  const activeTasks = mockTasks.filter(t => t.status === 'in_progress' || t.status === 'draft').length
  const reviewTasks = mockTasks.filter(t => t.status === 'review').length
  const blockedTasks = mockTasks.filter(t => t.status === 'blocked').length
  const completedTasks = mockTasks.filter(t => t.status === 'completed').length

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
    }
  ]

  let filteredTasks = mockTasks.filter(t => 
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

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed': return 'bg-success/10 text-success border-success/20'
      case 'in_progress': return 'bg-primary/10 text-primary border-primary/20'
      case 'review': return 'bg-warning/10 text-warning border-warning/20'
      case 'blocked': return 'bg-danger/10 text-danger border-danger/20'
      default: return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'urgent': return 'text-danger font-semibold'
      case 'high': return 'text-warning font-semibold'
      case 'medium': return 'text-primary'
      default: return 'text-muted-foreground'
    }
  }

  return (
    <div className="flex h-full flex-col gap-6">
      {/* Header & Pulse */}
      <div className="flex flex-col gap-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Task Workspace</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage, monitor, and execute operational tasks across all projects.
            </p>
          </div>
          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            className="cursor-pointer shadow-sm bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 transition-all duration-300"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Task
          </Button>
        </div>
        <ModulePulse cards={pulseData} />
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between bg-card/50 backdrop-blur-sm border border-primary/10 rounded-xl p-2 shadow-sm shrink-0">
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
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <option value="all">All Tasks</option>
            <option value="my_tasks">My Tasks</option>
            <option value="high_priority">High Priority</option>
            <option value="due_today">Due Today</option>
          </select>
          <Button variant="ghost" size="sm" className="h-9 text-muted-foreground hover:text-foreground">
            <Filter className="mr-2 h-4 w-4" /> More
          </Button>
          <div className="h-5 w-px bg-border mx-1" />
          <div className="flex bg-muted/50 rounded-lg p-1 border border-border/50">
            <button
              onClick={() => setView('list')}
              title="List View"
              className={cn(
                "p-1.5 rounded-md transition-all cursor-pointer",
                view === 'list' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('board')}
              title="Board View"
              className={cn(
                "p-1.5 rounded-md transition-all cursor-pointer",
                view === 'board' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('approvals')}
              title="Approvals Workbench"
              className={cn(
                "p-1.5 rounded-md transition-all cursor-pointer",
                view === 'approvals' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <CheckSquare className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('workload')}
              title="Workload & Capacity"
              className={cn(
                "p-1.5 rounded-md transition-all cursor-pointer",
                view === 'workload' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <BarChart2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden flex flex-col">
        {view === 'list' ? (
          <div className="overflow-auto flex-1 g2g-scrollbar relative">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/30 sticky top-0 z-10 border-b border-border/50 backdrop-blur-md">
                <tr>
                  <th className="px-6 py-4 font-medium">Task</th>
                  <th className="px-6 py-4 font-medium">Project</th>
                  <th className="px-6 py-4 font-medium">Assignee</th>
                  <th className="px-6 py-4 font-medium">Priority</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Due Date</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredTasks.map((task) => (
                  <tr 
                    key={task.id} 
                    onClick={() => setSelectedTask(task)}
                    className="hover:bg-muted/20 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground group-hover:text-primary transition-colors cursor-pointer">{task.title}</span>
                        <span className="text-xs text-muted-foreground mt-0.5">{task.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{task.project}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary border border-primary/20">
                          {task.assignee.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="text-foreground">{task.assignee}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("capitalize text-xs", getPriorityColor(task.priority))}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                        getStatusColor(task.status)
                      )}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-primary hover:bg-primary/10">Start</Button>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-success hover:bg-success/10">Complete</Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredTasks.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <ListChecks className="h-12 w-12 mb-4 opacity-20" />
                <p>No tasks found matching your search.</p>
              </div>
            )}
          </div>
        ) : view === 'board' ? (
          <div className="flex-1 flex gap-4 p-4 overflow-x-auto g2g-scrollbar bg-background">
            {[
              { id: 'draft', label: 'To Do', border: 'border-muted' },
              { id: 'in_progress', label: 'In Progress', border: 'border-primary' },
              { id: 'review', label: 'Review', border: 'border-warning' },
              { id: 'blocked', label: 'Blocked', border: 'border-danger' },
              { id: 'completed', label: 'Done', border: 'border-success' },
            ].map(col => {
              const colTasks = filteredTasks.filter(t => t.status === col.id)
              return (
                <div key={col.id} className="flex flex-col w-80 shrink-0 bg-muted/10 rounded-xl border border-border/50">
                  <div className={cn("p-4 border-t-2 rounded-t-xl flex justify-between items-center", col.border, "bg-muted/30")}>
                    <h3 className="font-semibold text-sm">{col.label}</h3>
                    <span className="text-xs font-medium bg-background px-2 py-0.5 rounded-full border">{colTasks.length}</span>
                  </div>
                  <div className="flex-1 p-2 flex flex-col gap-2 overflow-y-auto g2g-scrollbar min-h-0">
                    {colTasks.map(task => (
                       <div 
                         key={task.id} 
                         onClick={() => setSelectedTask(task)}
                         className="group flex flex-col gap-2 rounded-xl border border-primary/20 bg-card p-4 shadow-sm transition-all duration-300 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
                       >
                         <div className="flex justify-between items-start">
                            <span className={cn("text-[10px] font-bold uppercase tracking-wider", getPriorityColor(task.priority))}>{task.priority}</span>
                            <span className="text-xs text-muted-foreground">{task.id}</span>
                         </div>
                         <h4 className="text-sm font-semibold text-foreground line-clamp-2">{task.title}</h4>
                         <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <CalendarDays className="h-3 w-3" />
                              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary border border-primary/20" title={task.assignee}>
                              {task.assignee.split(' ').map(n => n[0]).join('')}
                            </div>
                         </div>
                       </div>
                    ))}
                    {colTasks.length === 0 && (
                      <div className="h-24 border-2 border-dashed border-border/50 rounded-lg flex items-center justify-center text-xs text-muted-foreground">
                        Drop tasks here
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : view === 'approvals' ? (
          <div className="p-6 flex-1 flex flex-col overflow-y-auto g2g-scrollbar">
            <h2 className="text-lg font-semibold mb-4">Pending Approvals</h2>
            <div className="grid gap-4 max-w-4xl">
              {filteredTasks.filter(t => t.status === 'review').length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border">
                  <CheckSquare className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm">No tasks pending approval. You're all caught up!</p>
                </div>
              ) : (
                filteredTasks.filter(t => t.status === 'review').map(task => (
                  <div key={task.id} className="flex items-center justify-between p-4 bg-card border border-warning/20 rounded-xl shadow-sm hover:border-warning/40 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center text-sm font-medium text-warning border border-warning/20 shrink-0">
                        {task.assignee.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground cursor-pointer hover:text-primary" onClick={() => setSelectedTask(task)}>{task.title}</span>
                          <span className="text-xs text-muted-foreground">{task.project}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Submitted by {task.assignee} for review.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <Button variant="outline" size="sm" className="h-9 border-danger/30 text-danger hover:bg-danger/10 hover:text-danger">Reject</Button>
                      <Button size="sm" className="h-9 bg-success hover:bg-success/90 text-success-foreground">Approve</Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 flex-1 flex flex-col overflow-y-auto g2g-scrollbar">
            <h2 className="text-lg font-semibold mb-6">Team Workload & Capacity</h2>
            <div className="grid gap-6">
              {Array.from(new Set(mockTasks.map(t => t.assignee))).map(assignee => {
                const assigneeTasks = mockTasks.filter(t => t.assignee === assignee)
                const activeCount = assigneeTasks.filter(t => t.status === 'in_progress').length
                const totalCount = assigneeTasks.length
                const percentage = Math.min(100, Math.round((activeCount / 5) * 100)) // assuming 5 active tasks is 100% capacity
                
                return (
                  <div key={assignee} className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary border border-primary/20">
                          {assignee.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="font-medium text-sm">{assignee}</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">
                        {activeCount} active / {totalCount} total tasks
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden flex">
                      <div 
                        className={cn("h-full transition-all duration-1000", percentage > 80 ? "bg-danger" : percentage > 50 ? "bg-warning" : "bg-success")} 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
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
