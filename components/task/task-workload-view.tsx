import React from 'react'
import { Users, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { Task } from '@/types/task-management'

interface TaskWorkloadViewProps {
  tasks: Task[]
}

export function TaskWorkloadView({ tasks }: TaskWorkloadViewProps) {
  // Assuming 5 active tasks is 100% capacity for a team member
  const maxCapacity = 5

  const assignees = Array.from(new Set(tasks.map(t => t.assignee)))

  return (
    <div className="p-6 flex-1 flex flex-col overflow-y-auto g2g-scrollbar bg-background/50">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 text-primary shadow-sm">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Team Workload</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Real-time capacity and resource allocation across your team.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 w-full">
        {assignees.map(assignee => {
          const assigneeTasks = tasks.filter(t => t.assignee === assignee)
          const activeCount = assigneeTasks.filter(t => t.status === 'in_progress').length
          const reviewCount = assigneeTasks.filter(t => t.status === 'review').length
          const blockedCount = assigneeTasks.filter(t => t.status === 'blocked').length
          const totalCount = assigneeTasks.length
          
          const percentage = Math.min(100, Math.round((activeCount / maxCapacity) * 100))
          
          let statusColor = "bg-success"
          let statusText = "text-success"
          let statusBg = "bg-success/10"
          let statusLabel = "Available"
          
          if (percentage > 80) {
            statusColor = "bg-danger"
            statusText = "text-danger"
            statusBg = "bg-danger/10"
            statusLabel = "Overloaded"
          } else if (percentage > 50) {
            statusColor = "bg-warning"
            statusText = "text-warning"
            statusBg = "bg-warning/10"
            statusLabel = "At Capacity"
          }

          return (
            <div 
              key={assignee} 
              className="flex flex-col bg-card/60 backdrop-blur-md rounded-2xl border border-primary/10 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-primary/30 transition-all duration-300 overflow-hidden relative group"
            >
              {/* Subtle top gradient */}
              <div className="h-1 w-full bg-gradient-to-r from-primary/5 via-primary/20 to-primary/5 absolute top-0 left-0" />
              
              <div className="p-5 flex flex-col gap-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary border border-primary/20 shadow-sm group-hover:scale-105 transition-transform">
                      {assignee.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground text-base">{assignee}</span>
                      <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md mt-1 w-fit", statusBg, statusText)}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-foreground">
                      {Math.round(percentage)}%
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">Capacity</div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-1">
                    <span>{activeCount} Active Tasks</span>
                    <span>Max {maxCapacity}</span>
                  </div>
                  <div className="h-2.5 w-full bg-muted/50 rounded-full overflow-hidden flex shadow-inner">
                    <div 
                      className={cn("h-full transition-all duration-1000 rounded-full", statusColor)} 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-2 pt-4 border-t border-primary/10">
                  <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-primary/[0.02] border border-primary/5">
                    <CheckCircle2 className="w-4 h-4 text-success mb-1" />
                    <span className="text-lg font-bold">{activeCount}</span>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase">Active</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-primary/[0.02] border border-primary/5">
                    <Clock className="w-4 h-4 text-warning mb-1" />
                    <span className="text-lg font-bold">{reviewCount}</span>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase">Review</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-primary/[0.02] border border-primary/5">
                    <AlertTriangle className="w-4 h-4 text-danger mb-1" />
                    <span className="text-lg font-bold">{blockedCount}</span>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase">Blocked</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
