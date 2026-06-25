import React from 'react'
import { CalendarDays, MoreVertical, ListChecks } from 'lucide-react'
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
          {tasks.map((task) => (
            <tr 
              key={task.id} 
              onClick={() => onSelectTask(task)}
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
                  <Tooltip content={task.assignee}>
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary border border-primary/20">
                      {task.assignee.split(' ').map(n => n[0]).join('')}
                    </div>
                  </Tooltip>
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
      {tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <ListChecks className="h-12 w-12 mb-4 opacity-20" />
          <p>No tasks found matching your search.</p>
        </div>
      )}
    </div>
  )
}
