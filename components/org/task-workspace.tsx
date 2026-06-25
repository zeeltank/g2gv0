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
  MoreVertical
} from 'lucide-react'
import { ModulePulse } from './module-pulse'
import { Button } from '@/components/ui/button'
import { mockTasks } from '@/lib/mock-data/task-management'
import { cn } from '@/lib/utils'

export function TaskWorkspace() {
  const [view, setView] = useState<'list' | 'board'>('list')
  const [searchQuery, setSearchQuery] = useState('')

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

  const filteredTasks = mockTasks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.assignee.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
          <Button className="cursor-pointer shadow-sm bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 transition-all duration-300">
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
          <Button variant="ghost" size="sm" className="h-9 text-muted-foreground hover:text-foreground">
            <Filter className="mr-2 h-4 w-4" /> Filter
          </Button>
          <div className="h-5 w-px bg-border mx-1" />
          <div className="flex bg-muted/50 rounded-lg p-1 border border-border/50">
            <button
              onClick={() => setView('list')}
              className={cn(
                "p-1.5 rounded-md transition-all cursor-pointer",
                view === 'list' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('board')}
              className={cn(
                "p-1.5 rounded-md transition-all cursor-pointer",
                view === 'board' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
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
                  <tr key={task.id} className="hover:bg-muted/20 transition-colors group">
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
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
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
        ) : (
          <div className="p-6 flex-1 flex items-center justify-center text-muted-foreground flex-col">
             <LayoutGrid className="h-16 w-16 mb-4 opacity-10 text-primary" />
             <p className="text-lg font-medium text-foreground">Board View</p>
             <p className="text-sm">Drag and drop functionality coming in Phase 2.</p>
          </div>
        )}
      </div>
    </div>
  )
}
