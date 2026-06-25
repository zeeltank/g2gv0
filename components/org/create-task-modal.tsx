import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CalendarDays, AlertCircle, FileText, Users, Link as LinkIcon, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateTaskModal({ isOpen, onClose }: CreateTaskModalProps) {
  const [step, setStep] = useState(1)
  
  // Just for visual effect in this mock phase
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const handleNext = () => setStep(2)
  const handleBack = () => setStep(1)
  const handleClose = () => {
    setStep(1)
    setTitle('')
    setDescription('')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden gap-0 bg-card border-primary/20 shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-muted/10">
          <DialogTitle className="text-xl">Create New Task</DialogTitle>
          <DialogDescription>
            {step === 1 ? 'Step 1 of 2: Basic Information' : 'Step 2 of 2: Planning & Assignment'}
          </DialogDescription>
          
          <div className="flex gap-2 mt-4">
            <div className={cn("h-1 flex-1 rounded-full transition-colors", step >= 1 ? "bg-primary" : "bg-muted")} />
            <div className={cn("h-1 flex-1 rounded-full transition-colors", step >= 2 ? "bg-primary" : "bg-muted")} />
          </div>
        </DialogHeader>

        <div className="p-6 bg-card">
          {step === 1 ? (
            <div className="flex flex-col gap-5 animate-in slide-in-from-right-4 fade-in duration-300">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Task Title
                </label>
                <input 
                  type="text" 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., Finalize Q3 Marketing Budget" 
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-primary" /> Description
                </label>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Provide a detailed explanation of the task requirements..." 
                  className="min-h-[120px] rounded-lg border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all resize-none"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-primary" /> Attachments
                </label>
                <div className="h-20 border-2 border-dashed border-border/60 rounded-lg flex items-center justify-center text-sm text-muted-foreground bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer">
                  Drag and drop files here, or click to browse
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 fade-in duration-300">
              
              <div className="grid grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" /> Assignee
                  </label>
                  <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all cursor-pointer">
                    <option value="">Select Assignee...</option>
                    <option value="1">Sarah Chen</option>
                    <option value="2">John Doe</option>
                    <option value="3">Alex Miller</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-primary" /> Project
                  </label>
                  <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all cursor-pointer">
                    <option value="">Select Project...</option>
                    <option value="1">G2G Platform v2</option>
                    <option value="2">Q3 Financial Planning</option>
                    <option value="3">HR Policy Update</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" /> Due Date
                  </label>
                  <input 
                    type="date" 
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-primary" /> Priority
                  </label>
                  <div className="flex bg-muted/50 rounded-lg p-1 border border-border/50">
                    <button className="flex-1 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-background/50 transition-all">Low</button>
                    <button className="flex-1 py-1.5 text-xs font-medium rounded-md bg-background shadow-sm text-primary transition-all">Medium</button>
                    <button className="flex-1 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-background/50 transition-all">High</button>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-border/50 bg-muted/10 sm:justify-between items-center">
          {step === 1 ? (
            <>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button 
                onClick={handleNext} 
                disabled={!title.trim() || !description.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
              >
                Next Step
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={handleBack}>Back</Button>
              <Button 
                onClick={handleClose} 
                className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
              >
                Create Task
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
