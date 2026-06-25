import React from 'react'
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
    <div className="p-6 flex-1 flex flex-col overflow-y-auto g2g-scrollbar">
      <h2 className="text-lg font-semibold mb-6">Team Workload & Capacity</h2>
      <div className="grid gap-6">
        {assignees.map(assignee => {
          const assigneeTasks = tasks.filter(t => t.assignee === assignee)
          const activeCount = assigneeTasks.filter(t => t.status === 'in_progress').length
          const totalCount = assigneeTasks.length
          const percentage = Math.min(100, Math.round((activeCount / maxCapacity) * 100))
          
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
  )
}
