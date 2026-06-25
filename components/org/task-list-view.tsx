import React from 'react'
import { CalendarDays, ListChecks, CheckCircle2, PlayCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { Task } from '@/types/task-management'
import { getStatusColor, getPriorityColor } from '@/lib/task-utils'

interface TaskListViewProps {
  tasks: Task[]
  onSelectTask: (task: Task) => void
}

export function TaskListView({ tasks, onSelectTask }: TaskListViewProps) {
  return (
    <div className="overflow-auto flex-1 g2g-scrollbar relative bg-card">
      <table className="w-full text-sm text-left border-collapse">
        <thead className="text-[11px] font-semibold text-primary/70 uppercase tracking-wider bg-primary/5 sticky top-0 z-10 backdrop-blur-md">
          <tr>
            <th className="px-6 py-4 rounded-tl-xl">Task Name</th>
            <th className="px-6 py-4">Project</th>
            <th className="px-6 py-4">Assignee</th>
            <th className="px-6 py-4">Priority</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4">Due Date</th>
            <th className="px-6 py-4 text-right rounded-tr-xl">Quick Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-primary/5">
          {tasks.map((task) => (
            <tr 
              key={task.id} 
              onClick={() => onSelectTask(task)}
              className="hover:bg-primary/[0.02] transition-colors group cursor-pointer"
            >
              <td className="px-6 py-4">
                <span className="font-semibold text-foreground group-hover:text-primary transition-colors block">{task.title}</span>
              </td>
              <td className="px-6 py-4">
                <span className="text-muted-foreground font-medium">{task.project}</span>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <Tooltip content={task.assignee}>
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary border border-primary/20 shadow-sm">
                      {task.assignee.split(' ').map(n => n[0]).join('')}
                    </div>
                  </Tooltip>
                  <span className="text-foreground text-sm font-medium">{task.assignee}</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className={cn("capitalize text-xs px-2 py-1 rounded-md bg-muted/30", getPriorityColor(task.priority))}>
                  {task.priority}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className={cn(
                  "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm",
                  getStatusColor(task.status)
                )}>
                  {task.status.replace('_', ' ')}
                </span>
              </td>
              <td className="px-6 py-4 text-muted-foreground">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CalendarDays className="h-4 w-4 opacity-70" />
                  {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 border-primary/20 text-xs text-primary hover:bg-primary hover:text-primary-foreground shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Start task logic
                    }}
                  >
                    <PlayCircle className="h-3.5 w-3.5 mr-1.5" /> Start
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 border-success/20 text-xs text-success hover:bg-success hover:text-success-foreground shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Complete task logic
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Done
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground bg-muted/10 m-4 rounded-xl border border-dashed border-border/50">
          <ListChecks className="h-12 w-12 mb-4 opacity-20" />
          <p className="font-medium">No tasks found matching your search.</p>
        </div>
      )}
    </div>
  )
}
