import React, { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Task } from '@/types/task-management'
import { 
  CalendarDays, 
  MessageSquare, 
  Paperclip, 
  Activity, 
  Send,
  MoreVertical,
  CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TaskDetailsDrawerProps {
  task: Task | null
  isOpen: boolean
  onClose: () => void
}

export function TaskDetailsDrawer({ task, isOpen, onClose }: TaskDetailsDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'comments'>('overview')
  const [newComment, setNewComment] = useState('')

  if (!task) return null

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed': return 'bg-success/10 text-success border-success/20'
      case 'in_progress': return 'bg-primary/10 text-primary border-primary/20'
      case 'review': return 'bg-warning/10 text-warning border-warning/20'
      case 'blocked': return 'bg-danger/10 text-danger border-danger/20'
      default: return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'urgent': return 'text-danger font-semibold'
      case 'high': return 'text-warning font-semibold'
      case 'medium': return 'text-primary'
      default: return 'text-muted-foreground'
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] p-0 flex flex-col border-l-primary/10 shadow-2xl">
        
        {/* Header */}
        <SheetHeader className="p-6 border-b border-border/50 bg-muted/10 shrink-0 relative">
          <div className="flex items-start justify-between gap-4 pr-6">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">{task.id}</span>
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider border", getPriorityColor(task.priority), "border-current/20")}>
                  {task.priority}
                </span>
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize", getStatusColor(task.status))}>
                  {task.status.replace('_', ' ')}
                </span>
              </div>
              <SheetTitle className="text-xl leading-tight">{task.title}</SheetTitle>
              <SheetDescription>In project <span className="font-medium text-foreground">{task.project}</span></SheetDescription>
            </div>
            
            <div className="flex items-center gap-1">
              {task.status !== 'completed' && (
                <Button size="sm" variant="outline" className="h-8 gap-1.5 border-success/30 text-success hover:bg-success/10 hover:text-success">
                  <CheckCircle2 className="h-4 w-4" /> Complete
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex items-center gap-6 mt-6 border-b border-transparent">
            {(['overview', 'activity', 'comments'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "pb-3 text-sm font-medium transition-all relative capitalize outline-none",
                  activeTab === tab ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full shadow-[0_-2px_8px_rgba(var(--primary),0.5)]" />
                )}
              </button>
            ))}
          </div>
        </SheetHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto g2g-scrollbar p-6">
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    Assignee
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary border border-primary/20">
                      {task.assignee.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-sm font-medium">{task.assignee}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    Reporter
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground border">
                      {task.owner.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-sm font-medium">{task.owner}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" /> Due Date
                  </span>
                  <span className="text-sm font-medium">{new Date(task.dueDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    Department
                  </span>
                  <span className="text-sm font-medium">{task.department}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Description</h3>
                <div className="text-sm text-muted-foreground/90 leading-relaxed bg-muted/20 p-4 rounded-xl border border-border/50">
                  {task.description}
                </div>
              </div>

            </div>
          )}

          {activeTab === 'activity' && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground animate-in fade-in duration-300 gap-3">
              <Activity className="h-10 w-10 opacity-20" />
              <p className="text-sm">Activity history will appear here.</p>
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="flex flex-col h-full animate-in fade-in duration-300">
              <div className="flex-1 flex flex-col gap-4 justify-end pb-4">
                {task.comments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-3">
                    <MessageSquare className="h-10 w-10 opacity-20" />
                    <p className="text-sm">No comments yet. Be the first to start the discussion!</p>
                  </div>
                ) : (
                  task.comments.map(comment => (
                    <div key={comment.id} className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                        {comment.author.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex flex-col gap-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{comment.author}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(comment.timestamp).toLocaleString()}</span>
                        </div>
                        <div className="text-sm bg-muted/40 p-3 rounded-2xl rounded-tl-sm border border-border/50">
                          {comment.content}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer / Comment Input */}
        <div className="p-4 border-t border-border/50 bg-background shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
          <div className="relative flex items-center">
            <Button variant="ghost" size="sm" className="absolute left-1 h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
              <Paperclip className="h-4 w-4" />
            </Button>
            <input 
              type="text" 
              placeholder="Type a comment or update..." 
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full h-10 pl-10 pr-10 rounded-full border border-input bg-muted/20 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary transition-all"
            />
            <Button 
              size="sm" 
              className={cn(
                "absolute right-1 h-8 w-8 p-0 rounded-full transition-all duration-300",
                newComment.trim().length > 0 ? "bg-primary text-primary-foreground opacity-100 scale-100" : "opacity-0 scale-90"
              )}
            >
              <Send className="h-3.5 w-3.5 ml-0.5" />
            </Button>
          </div>
        </div>

      </SheetContent>
    </Sheet>
  )
}
