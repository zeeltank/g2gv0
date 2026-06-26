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
  CheckCircle2,
  UserCircle2,
  FolderOpen,
  Edit2,
  Copy,
  Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface TaskDetailsDrawerProps {
  task: Task | null
  isOpen: boolean
  onClose: () => void
  readOnly?: boolean
}

export function TaskDetailsDrawer({ task, isOpen, onClose, readOnly = false }: TaskDetailsDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'comments'>('overview')
  const [newComment, setNewComment] = useState('')

  if (!task) return null

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed': return 'bg-success/10 text-success border-success/20'
      case 'in_progress': return 'bg-primary/10 text-primary border-primary/20'
      case 'review': return 'bg-warning/10 text-warning border-warning/20'
      case 'blocked': return 'bg-danger/10 text-danger border-danger/20'
      default: return 'bg-muted/50 text-muted-foreground border-border/50'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'urgent': return 'text-danger border-danger/30 bg-danger/5'
      case 'high': return 'text-warning border-warning/30 bg-warning/5'
      case 'medium': return 'text-primary border-primary/30 bg-primary/5'
      default: return 'text-muted-foreground border-border bg-muted/30'
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[100vw] sm:max-w-[640px] p-0 flex flex-col border-l border-primary/20 bg-background/95 backdrop-blur-2xl shadow-2xl">
        
        {/* Header */}
        <SheetHeader className="p-6 pb-0 shrink-0 relative bg-gradient-to-b from-primary/[0.03] to-transparent">
          <div className="flex items-start justify-between gap-4 pr-10">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <span className={cn("inline-flex items-center px-3 py-1 rounded-lg text-[11px] uppercase font-bold tracking-wider border shadow-sm", getPriorityColor(task.priority))}>
                  {task.priority}
                </span>
                <span className={cn("inline-flex items-center px-3 py-1 rounded-lg text-[11px] uppercase font-bold tracking-wider border shadow-sm", getStatusColor(task.status))}>
                  {task.status.replace('_', ' ')}
                </span>
              </div>
              <SheetTitle className="text-2xl font-bold leading-tight text-foreground">{task.title}</SheetTitle>
              <SheetDescription className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <FolderOpen className="h-4 w-4 opacity-70" />
                In project <span className="text-foreground">{task.project}</span>
              </SheetDescription>
            </div>
            
            <div className="flex items-center gap-2 mt-1">
              {task.status !== 'completed' && (
                <Button size="sm" className="h-10 px-5 gap-2 bg-success hover:bg-success/90 text-success-foreground rounded-xl shadow-sm transition-transform hover:scale-105 active:scale-95">
                  <CheckCircle2 className="h-4 w-4" /> Complete
                </Button>
              )}
              {!readOnly && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center justify-center outline-none h-10 w-10 rounded-xl border border-primary/20 text-primary hover:bg-primary/10 shadow-sm transition-transform hover:scale-105 active:scale-95 cursor-pointer">
                    <MoreVertical className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-card/80 backdrop-blur-xl border-primary/10 shadow-xl rounded-xl p-1.5">
                    <DropdownMenuItem className="cursor-pointer gap-2.5 hover:bg-primary/10 rounded-lg p-2.5 font-medium transition-colors">
                      <Edit2 className="h-4 w-4 text-primary/70" /> Edit Task
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer gap-2.5 hover:bg-primary/10 rounded-lg p-2.5 font-medium transition-colors">
                      <Copy className="h-4 w-4 text-primary/70" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-primary/10 my-1.5" />
                    <DropdownMenuItem className="cursor-pointer gap-2.5 text-danger focus:text-danger hover:bg-danger/10 hover:text-danger rounded-lg p-2.5 font-medium transition-colors">
                      <Trash2 className="h-4 w-4" /> Delete Task
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex items-center w-full mt-8 border-b border-primary/10">
            {(['overview', 'activity', 'comments'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 pb-3.5 text-sm font-semibold transition-all relative capitalize outline-none cursor-pointer text-center",
                  activeTab === tab ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full shadow-[0_-2px_10px_rgba(var(--primary),0.8)]" />
                )}
              </button>
            ))}
          </div>
        </SheetHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto g2g-scrollbar p-6">
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2 p-4 rounded-2xl bg-card/60 border border-primary/10 shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    Assignee
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary border border-primary/20 shadow-sm">
                      {task.assignee.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-sm font-semibold text-foreground">{task.assignee}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 p-4 rounded-2xl bg-card/60 border border-primary/10 shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    Reporter
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground border shadow-sm">
                      {task.owner.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-sm font-semibold text-foreground">{task.owner}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 p-4 rounded-2xl bg-card/60 border border-primary/10 shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    Due Date
                  </span>
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <CalendarDays className="h-4 w-4 text-primary/70" />
                    {new Date(task.dueDate).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>

                <div className="flex flex-col gap-2 p-4 rounded-2xl bg-card/60 border border-primary/10 shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    Department
                  </span>
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <UserCircle2 className="h-4 w-4 text-primary/70" />
                    {task.department}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold tracking-wide uppercase text-muted-foreground">Description</h3>
                <div className="text-sm text-foreground/90 leading-relaxed bg-muted/20 p-5 rounded-2xl border border-primary/10 shadow-inner">
                  {task.description}
                </div>
              </div>

            </div>
          )}

          {activeTab === 'activity' && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground animate-in fade-in duration-300 gap-4">
              <div className="p-4 rounded-full bg-muted/20 border border-border/50">
                <Activity className="h-8 w-8 opacity-40" />
              </div>
              <p className="text-sm font-medium">Activity history will appear here.</p>
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="flex flex-col h-full animate-in fade-in duration-300">
              <div className="flex-1 flex flex-col gap-5 justify-end pb-4">
                {task.comments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-4">
                    <div className="p-4 rounded-full bg-muted/20 border border-border/50">
                      <MessageSquare className="h-8 w-8 opacity-40" />
                    </div>
                    <p className="text-sm font-medium">No comments yet. Start the discussion!</p>
                  </div>
                ) : (
                  task.comments.map(comment => (
                    <div key={comment.id} className="flex gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary border border-primary/20 shadow-sm shrink-0 mt-1">
                        {comment.author.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex flex-col gap-1.5 flex-1">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-bold text-foreground">{comment.author}</span>
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{new Date(comment.timestamp).toLocaleString()}</span>
                        </div>
                        <div className="text-sm text-foreground/90 bg-card/60 backdrop-blur-md p-4 rounded-2xl rounded-tl-sm border border-primary/10 shadow-sm">
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
        <div className="p-5 border-t border-primary/10 bg-background/80 backdrop-blur-md shrink-0 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
          <div className="relative flex items-center group">
            <Button variant="ghost" size="icon" className="absolute left-1.5 h-10 w-10 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
              <Paperclip className="h-5 w-5" />
            </Button>
            <input 
              type="text" 
              placeholder="Type a comment or update..." 
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full h-12 pl-12 pr-14 rounded-2xl border border-primary/20 bg-card/50 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary transition-all shadow-sm placeholder:font-normal"
            />
            <Button 
              size="icon" 
              className={cn(
                "absolute right-1.5 h-9 w-9 rounded-xl transition-all duration-300 shadow-sm",
                newComment.trim().length > 0 ? "bg-primary text-primary-foreground opacity-100 scale-100 hover:scale-105" : "bg-muted text-muted-foreground opacity-50 scale-95"
              )}
            >
              <Send className="h-4 w-4 ml-0.5" />
            </Button>
          </div>
        </div>

      </SheetContent>
    </Sheet>
  )
}
