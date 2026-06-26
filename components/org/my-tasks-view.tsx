'use client'

import React, { useState } from 'react'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ListChecks,
  Search,
  Filter,
  LayoutGrid,
  List,
  CalendarDays
} from 'lucide-react'
import { ModulePulse } from './module-pulse'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { mockTasks } from '@/lib/mock-data/task-management'
import { cn } from '@/lib/utils'

import { TaskDetailsDrawer } from './task-details-drawer'
import { TaskBoardView } from './task-board-view'
import { Task } from '@/types/task-management'
import { getPriorityColor, getStatusColor } from '@/lib/task-utils'

// A specialized list view for an individual employee
function EmployeeTaskListView({ tasks, onSelectTask }: { tasks: Task[], onSelectTask: (t: Task) => void }) {
  return (
    <div className="rounded-xl border border-primary/10 bg-card/40 backdrop-blur-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/30 text-muted-foreground border-b border-primary/10 text-xs uppercase tracking-wider font-semibold">
            <tr>
              <th className="px-6 py-4 rounded-tl-xl">Task Name</th>
              <th className="px-6 py-4">Project</th>
              <th className="px-6 py-4">Due Date</th>
              <th className="px-6 py-4">Priority</th>
              <th className="px-6 py-4 rounded-tr-xl">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary/5">
            {tasks.map((task) => (
              <tr
                key={task.id}
                onClick={() => onSelectTask(task)}
                className="group hover:bg-primary/[0.02] transition-colors cursor-pointer"
              >
                <td className="px-6 py-4 font-medium text-foreground group-hover:text-primary transition-colors">
                  {task.title}
                  <div className="text-xs text-muted-foreground mt-1 font-normal line-clamp-1">{task.description}</div>
                </td>
                <td className="px-6 py-4 text-muted-foreground">{task.project}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={cn("inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider", getPriorityColor(task.priority))}>
                    {task.priority}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium", getStatusColor(task.status))}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current mr-2 opacity-70" />
                    {task.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                  No tasks found in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function MyTasksView() {
  const [view, setView] = useState<'list' | 'board'>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskGroup, setTaskGroup] = useState<'all' | 'today' | 'upcoming' | 'recent' | 'subordinates'>('all')

  // Hardcoded to current user for this view
  const myTasks = mockTasks.filter(t => t.assignee === 'Sarah Chen')

  // Derived metrics for Employee Pulse Cards
  const dueToday = myTasks.filter(t => new Date(t.dueDate) <= new Date() && t.status !== 'completed').length
  const blockedTasks = myTasks.filter(t => t.status === 'blocked').length
  const reviewTasks = myTasks.filter(t => t.status === 'review').length
  const completedTasks = myTasks.filter(t => t.status === 'completed').length

  const pulseData = [
    {
      id: 'due_today',
      title: 'Due Today',
      value: dueToday,
      subtitle: 'Requires immediate action',
      icon: Clock,
      trend: dueToday > 0 ? { direction: 'down' as const, label: 'Urgent' } : undefined,
    },
    {
      id: 'blocked',
      title: 'Blocked',
      value: blockedTasks,
      subtitle: 'Waiting on dependencies',
      icon: AlertCircle,
      actionLabel: blockedTasks > 0 ? 'View blocked' : undefined,
    },
    {
      id: 'review',
      title: 'In Review',
      value: reviewTasks,
      subtitle: 'Awaiting manager sign-off',
      icon: ListChecks,
    },
    {
      id: 'completed',
      title: 'Completed',
      value: completedTasks,
      subtitle: 'Tasks finished this month',
      icon: CheckCircle2,
      trend: { direction: 'up' as const, label: 'Great job!' }
    }
  ]

  // Apply tab grouping filters
  let baseListTasks = mockTasks;
  if (taskGroup === 'subordinates') {
    // Show tasks assigned to others (mock subordinates)
    baseListTasks = mockTasks.filter(t => t.assignee !== 'Sarah Chen');
  } else {
    // Show own tasks
    baseListTasks = myTasks;
  }

  if (taskGroup === 'today') {
    const today = new Date()
    baseListTasks = baseListTasks.filter(t => {
      const d = new Date(t.dueDate)
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
    })
  } else if (taskGroup === 'upcoming') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    baseListTasks = baseListTasks.filter(t => new Date(t.dueDate) > today && t.status !== 'completed')
  } else if (taskGroup === 'recent') {
    // Mock recent tasks (e.g. recently completed or recently modified)
    baseListTasks = baseListTasks.filter(t => t.status === 'completed' || t.status === 'review')
  }

  let filteredTasks = baseListTasks.filter(t =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (filterStatus === 'high_priority') {
    filteredTasks = filteredTasks.filter(t => t.priority === 'urgent' || t.priority === 'high')
  } else if (filterStatus === 'in_progress') {
    filteredTasks = filteredTasks.filter(t => t.status === 'in_progress')
  }

  return (
    <div className="flex h-full flex-col gap-6">
      {/* Header Area */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Tasks</h1>
        </div>

        {/* Personalized Pulse Metrics */}
        <ModulePulse cards={pulseData} />
      </div>

      {/* Workspace Area */}
      <div className="flex flex-col gap-4 flex-1">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-6 border-b border-border/50 px-1">
          {(['all', 'today', 'upcoming', 'recent', 'subordinates'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setTaskGroup(tab)}
              className={cn(
                "pb-3 text-sm font-medium transition-colors border-b-2 -mb-[1px] cursor-pointer",
                taskGroup === tab 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === 'all' && 'All Tasks'}
              {tab === 'today' && 'Today'}
              {tab === 'upcoming' && 'Upcoming'}
              {tab === 'recent' && 'Recent'}
              {tab === 'subordinates' && 'Subordinate Tasks'}
            </button>
          ))}
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between p-2 rounded-2xl bg-card/30 backdrop-blur-xl border border-primary/10 shadow-sm shrink-0 relative z-20">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search my tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 pl-9 pr-4 rounded-xl border border-input bg-background/50 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all w-[240px]"
              />
            </div>

            <Select
              value={filterStatus}
              onChange={setFilterStatus}
              options={[
                { label: 'All My Tasks', value: 'all' },
                { label: 'In Progress', value: 'in_progress' },
                { label: 'High Priority', value: 'high_priority' }
              ]}
              className="w-[160px] h-10 bg-background/50 rounded-xl"
            />
          </div>

          <div className="flex items-center gap-1 bg-background/50 p-1 rounded-xl border border-primary/5">
            <button
              onClick={() => setView('list')}
              className={cn("p-2 rounded-lg transition-all duration-200", view === 'list' ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('board')}
              className={cn("p-2 rounded-lg transition-all duration-200", view === 'board' ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 animate-in fade-in duration-500 slide-in-from-bottom-4">
          {view === 'list' ? (
            <EmployeeTaskListView tasks={filteredTasks} onSelectTask={setSelectedTask} />
          ) : (
            <TaskBoardView tasks={filteredTasks} onSelectTask={setSelectedTask} />
          )}
        </div>
      </div>

      <TaskDetailsDrawer
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        readOnly={true}
      />
    </div>
  )
}
