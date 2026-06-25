import React from 'react'
import { CheckSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Task } from '@/types/task-management'

interface TaskApprovalsViewProps {
  tasks: Task[]
  onSelectTask: (task: Task) => void
}

export function TaskApprovalsView({ tasks, onSelectTask }: TaskApprovalsViewProps) {
  const reviewTasks = tasks.filter(t => t.status === 'review')
  
  return (
    <div className="p-6 flex-1 flex flex-col overflow-y-auto g2g-scrollbar">
      <h2 className="text-lg font-semibold mb-4">Pending Approvals</h2>
      <div className="grid gap-4 max-w-4xl">
        {reviewTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border">
            <CheckSquare className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-sm">No tasks pending approval. You're all caught up!</p>
          </div>
        ) : (
          reviewTasks.map(task => (
            <div key={task.id} className="flex items-center justify-between p-4 bg-card border border-warning/20 rounded-xl shadow-sm hover:border-warning/40 transition-colors">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center text-sm font-medium text-warning border border-warning/20 shrink-0">
                  {task.assignee.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground cursor-pointer hover:text-primary" onClick={() => onSelectTask(task)}>{task.title}</span>
                    <span className="text-xs text-muted-foreground">{task.project}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Submitted by {task.assignee} for review.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <Button variant="outline" size="sm" className="h-9 border-danger/30 text-danger hover:bg-danger/10 hover:text-danger">Reject</Button>
                <Button size="sm" className="h-9 bg-success hover:bg-success/90 text-success-foreground">Approve</Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
