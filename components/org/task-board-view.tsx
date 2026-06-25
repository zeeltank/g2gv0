import React from 'react'
import { CalendarDays } from 'lucide-react'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { Task } from '@/types/task-management'
import { getPriorityColor } from '@/lib/task-utils'

interface TaskBoardViewProps {
  tasks: Task[]
  onSelectTask: (task: Task) => void
}

export function TaskBoardView({ tasks, onSelectTask }: TaskBoardViewProps) {
  return (
    <div className="flex-1 flex gap-4 p-4 overflow-x-auto g2g-scrollbar bg-background">
      {[
        { id: 'draft', label: 'To Do', border: 'border-muted' },
        { id: 'in_progress', label: 'In Progress', border: 'border-primary' },
        { id: 'review', label: 'Review', border: 'border-warning' },
        { id: 'blocked', label: 'Blocked', border: 'border-danger' },
        { id: 'completed', label: 'Done', border: 'border-success' },
      ].map(col => {
        const colTasks = tasks.filter(t => t.status === col.id)
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
                   onClick={() => onSelectTask(task)}
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
                      <Tooltip content={task.assignee}>
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary border border-primary/20">
                          {task.assignee.split(' ').map(n => n[0]).join('')}
                        </div>
                      </Tooltip>
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
  )
}
