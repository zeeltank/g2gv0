import React from 'react'
import { CheckSquare, CalendarDays, CheckCircle2, XCircle, Clock } from 'lucide-react'
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
  const reviewTasks = tasks.filter(t => t.status === 'review')
  
  return (
    <div className="p-6 flex-1 flex flex-col overflow-y-auto g2g-scrollbar bg-background/50">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 text-primary shadow-sm">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Pending Approvals</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Tasks awaiting your review and sign-off.</p>
        </div>
      </div>

      <div className="grid gap-4 w-full">
        {reviewTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground bg-card/40 rounded-2xl border border-dashed border-border/50">
            <CheckSquare className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm font-medium">No tasks pending approval. You're all caught up!</p>
          </div>
        ) : (
          reviewTasks.map(task => (
            <div 
              key={task.id} 
              className="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-card/60 backdrop-blur-md border border-primary/10 rounded-2xl shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-primary/30 transition-all duration-300 relative overflow-hidden"
            >
              {/* Subtle warning gradient side bar */}
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-warning/40 to-warning/10" />

              <div className="flex items-start gap-4 ml-2">
                <Tooltip content={task.assignee}>
                  <div className="h-11 w-11 rounded-full bg-primary/5 flex items-center justify-center text-sm font-bold text-primary border border-primary/20 shadow-sm shrink-0">
                    {task.assignee.split(' ').map(n => n[0]).join('')}
                  </div>
                </Tooltip>
                
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span 
                      className="font-bold text-foreground text-base cursor-pointer hover:text-primary transition-colors" 
                      onClick={() => onSelectTask(task)}
                    >
                      {task.title}
                    </span>
                    <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted/30 border border-border/50", getPriorityColor(task.priority))}>
                      {task.priority}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium mt-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                      {task.project}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 opacity-70" />
                      Due {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="text-foreground/70 hidden md:inline">
                      Submitted by <span className="font-semibold text-foreground">{task.assignee}</span>
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 shrink-0 mt-5 sm:mt-0 ml-2 sm:ml-6 w-full sm:w-auto justify-end">
                <Button 
                  variant="outline" 
                  className="h-10 px-4 rounded-xl border-danger/20 text-danger hover:bg-danger hover:text-danger-foreground transition-colors shadow-sm w-full sm:w-auto"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
                <Button 
                  className="h-10 px-4 rounded-xl bg-success hover:bg-success/90 text-success-foreground shadow-sm transition-colors w-full sm:w-auto"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approve
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
