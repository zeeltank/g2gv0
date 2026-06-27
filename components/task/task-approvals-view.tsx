import React, { useState } from 'react'
import { CheckSquare, CalendarDays, CheckCircle2, XCircle, Clock, Check, MessageSquare, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { Task } from '@/types/task-management'
import { cn } from '@/lib/utils'
import { getPriorityColor } from '@/lib/task-utils'

interface TaskApprovalsViewProps {
  tasks: Task[]
  onSelectTask: (task: Task) => void
}

export function TaskApprovalsView({ tasks, onSelectTask }: TaskApprovalsViewProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending')

  const pendingTasks = tasks.filter(t => t.status === 'review')
  const approvedTasks = tasks.filter(t => t.status === 'completed') // Mocking completed as approved for UI purposes

  // Create a mock rejected task to show the UI state
  const mockRejectedTask: Task = {
    id: 'T-999',
    title: 'Update Q3 Financial Models',
    description: 'Requires more granular breakdown of departmental expenses.',
    project: 'Q3 Enterprise Deployment',
    department: 'Finance',
    assignee: 'Oscar Martinez',
    owner: 'Michael Scott',
    dueDate: '2026-07-01',
    priority: 'high',
    status: 'in_progress',
    completionPercentage: 80,
    comments: [],
    attachments: []
  }

  const rejectedTasks = [mockRejectedTask]

  const currentTasks = activeTab === 'pending' ? pendingTasks : activeTab === 'approved' ? approvedTasks : rejectedTasks

  return (
    <div className="flex h-full flex-col gap-6 p-6 overflow-y-auto g2g-scrollbar">

      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 text-primary shadow-sm">
                <CheckSquare className="w-6 h-6" />
              </div>
              Approvals & Reviews
            </h1>

          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-card/50 backdrop-blur-md border border-primary/10 p-1.5 rounded-2xl w-fit shadow-sm">
          <Button variant={activeTab === 'pending' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('pending')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2",
              activeTab === 'pending' ? "shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            <Clock className="w-4 h-4" /> Pending Reviews
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] ml-1", activeTab === 'pending' ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")}>
              {pendingTasks.length}
            </span>
          </Button>
          <Button variant={activeTab === 'approved' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('approved')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2",
              activeTab === 'approved' ? "shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            <CheckCircle2 className="w-4 h-4" /> Approved
          </Button>
          <Button variant={activeTab === 'rejected' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('rejected')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2",
              activeTab === 'rejected' ? "shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            <XCircle className="w-4 h-4" /> Rejected / Rework
          </Button>
        </div>
      </div>

      {/* Task List */}
      <div className="grid gap-4 w-full pb-6">
        {currentTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground bg-card/40 rounded-[24px] border border-dashed border-primary/20">
            <CheckSquare className="h-12 w-12 mb-4 opacity-20 text-primary" />
            <p className="text-base font-bold text-foreground">No tasks found</p>
            <p className="text-sm mt-1">Your {activeTab} queue is empty.</p>
          </div>
        ) : (
          currentTasks.map(task => (
            <div
              key={task.id}
              className="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-[24px] shadow-xl hover:shadow-2xl hover:border-primary/30 transition-all duration-500 relative overflow-hidden cursor-pointer"
              onClick={() => onSelectTask(task)}
            >
              {/* Highlight bar for pending */}
              {activeTab === 'pending' && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-primary/40 to-primary/10" />}

              <div className="flex items-start gap-5 ml-2">
                <Tooltip content={task.assignee}>
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary border border-primary/20 shadow-sm shrink-0 group-hover:scale-110 transition-transform duration-300">
                    {task.assignee.split(' ').map(n => n[0]).join('')}
                  </div>
                </Tooltip>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-foreground text-lg transition-colors">
                      {task.title}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-muted/50 text-muted-foreground border border-border/50">
                      {task.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-5 text-xs text-muted-foreground font-medium mt-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                      {task.project}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 opacity-70" />
                      Submitted {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="h-4 w-4 opacity-70" />
                      3 Comments
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 mt-5 sm:mt-0 ml-2 sm:ml-6 w-full sm:w-auto justify-end">
                {activeTab === 'pending' && (
                  <>
                    <Button
                      variant="outline"
                      className="h-11 px-5 rounded-xl border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-all shadow-sm w-full sm:w-auto font-bold"
                      onClick={(e) => { e.stopPropagation(); /* Mock Reject */ }}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      className="h-11 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 w-full sm:w-auto font-bold"
                      onClick={(e) => { e.stopPropagation(); /* Mock Approve */ }}
                    >
                      <Check className="w-4 h-4 mr-2 stroke-[3]" />
                      Approve
                    </Button>
                  </>
                )}
                {activeTab === 'approved' && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl font-bold text-sm border border-primary/20">
                    <CheckCircle2 className="w-4 h-4" /> Approved
                  </div>
                )}
                {activeTab === 'rejected' && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded-xl font-bold text-sm border border-border">
                    <AlertCircle className="w-4 h-4" /> Rework Required
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
