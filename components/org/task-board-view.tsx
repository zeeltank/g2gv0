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
    <div className="flex-1 w-full h-full overflow-hidden bg-background/50">
      <div className="grid grid-cols-5 h-full divide-x divide-primary/5">
        {[
          { id: 'draft', label: 'To Do', dot: 'bg-muted-foreground' },
          { id: 'in_progress', label: 'In Progress', dot: 'bg-primary' },
          { id: 'review', label: 'Review', dot: 'bg-warning' },
          { id: 'blocked', label: 'Blocked', dot: 'bg-danger' },
          { id: 'completed', label: 'Done', dot: 'bg-success' },
        ].map(col => {
          const colTasks = tasks.filter(t => t.status === col.id)
          return (
            <div key={col.id} className="flex flex-col min-w-0 h-full bg-card/20 hover:bg-card/40 transition-colors duration-500">
              <div className="p-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full", col.dot, "shadow-sm")} />
                  <h3 className="font-semibold text-[13px] text-foreground/80 uppercase tracking-wider">{col.label}</h3>
                </div>
                <span className="text-[11px] font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">{colTasks.length}</span>
              </div>
              
              <div className="flex-1 px-3 pb-4 flex flex-col gap-3 overflow-y-auto g2g-scrollbar">
                {colTasks.map(task => (
                   <div 
                     key={task.id} 
                     onClick={() => onSelectTask(task)}
                     className="group flex flex-col gap-3 rounded-xl border border-primary/10 bg-card p-3.5 hover:border-primary/30 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 relative overflow-hidden"
                   >
                     {/* subtle top highlight based on priority */}
                     <div className={cn(
                       "absolute top-0 left-0 w-full h-[2px] opacity-50",
                       task.priority === 'urgent' ? 'bg-danger' : 
                       task.priority === 'high' ? 'bg-warning' : 'bg-primary/20'
                     )} />
                     
                     <div className="flex justify-between items-start">
                        <span className={cn("text-[10px] font-bold uppercase tracking-wider", getPriorityColor(task.priority))}>
                          {task.priority}
                        </span>
                     </div>
                     <h4 className="text-sm font-semibold text-foreground leading-snug">{task.title}</h4>
                     
                     <div className="flex items-center justify-between mt-2 pt-3 border-t border-primary/5">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5 opacity-60" />
                          {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <Tooltip content={task.assignee}>
                          <div className="h-6 w-6 rounded-full bg-primary/5 flex items-center justify-center text-[10px] font-semibold text-primary border border-primary/20 shadow-sm transition-transform group-hover:scale-110">
                            {task.assignee.split(' ').map(n => n[0]).join('')}
                          </div>
                        </Tooltip>
                     </div>
                   </div>
                ))}
                {colTasks.length === 0 && (
                  <div className="h-24 border border-dashed border-primary/10 rounded-xl flex flex-col items-center justify-center text-xs text-muted-foreground/50 m-2">
                    Empty
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
