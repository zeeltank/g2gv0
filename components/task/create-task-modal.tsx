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
import { Select } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { 
  CalendarDays, 
  AlertCircle, 
  FileText, 
  Users, 
  Link as LinkIcon, 
  Paperclip,
  Building2,
  FolderOpen,
  Tag,
  UserCheck,
  UserCog,
  ShieldCheck,
  Clock,
  Activity
} from 'lucide-react'
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
  const [priority, setPriority] = useState('medium')

  const handleNext = () => setStep(prev => Math.min(prev + 1, 3))
  const handleBack = () => setStep(prev => Math.max(prev - 1, 1))
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
            {step === 1 && 'Step 1 of 3: Basic Information'}
            {step === 2 && 'Step 2 of 3: Assignment & Roles'}
            {step === 3 && 'Step 3 of 3: Planning & Execution'}
          </DialogDescription>
          
          <div className="flex gap-2 mt-4">
            <div className={cn("h-1 flex-1 rounded-full transition-colors", step >= 1 ? "bg-primary" : "bg-muted")} />
            <div className={cn("h-1 flex-1 rounded-full transition-colors", step >= 2 ? "bg-primary" : "bg-muted")} />
            <div className={cn("h-1 flex-1 rounded-full transition-colors", step >= 3 ? "bg-primary" : "bg-muted")} />
          </div>
        </DialogHeader>

        <div className="p-6 bg-card">
          {step === 1 && (
            <div className="flex flex-col gap-5 animate-in slide-in-from-right-4 fade-in duration-300">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Task Title <span className="text-danger">*</span>
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

              <div className="grid grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-primary" /> Project
                  </label>
                  <Select 
                    options={[{ label: 'G2G Platform v2', value: '1' }]}
                    placeholder="Select Project..."
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" /> Department
                  </label>
                  <Select 
                    options={[{ label: 'Engineering', value: '1' }, { label: 'Marketing', value: '2' }]}
                    placeholder="Select Department..."
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-primary" /> Description <span className="text-danger">*</span>
                </label>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Provide a detailed explanation of the task requirements..." 
                  className="min-h-[120px] rounded-lg border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all resize-none"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 fade-in duration-300">
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <UserCog className="h-4 w-4 text-primary" /> Owner
                  </label>
                  <Select 
                    options={[{ label: 'Sarah Chen (You)', value: '1' }]}
                    placeholder="Task Owner"
                  />
                  <p className="text-[10px] text-muted-foreground">Accountable for ultimate delivery.</p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" /> Assigned To
                  </label>
                  <Select 
                    options={[{ label: 'John Doe', value: '1' }]}
                    placeholder="Select Assignee..."
                  />
                  <p className="text-[10px] text-muted-foreground">Responsible for doing the work.</p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" /> Reviewer
                  </label>
                  <Select 
                    options={[{ label: 'Alex Miller', value: '1' }]}
                    placeholder="Select Reviewer..."
                  />
                  <p className="text-[10px] text-muted-foreground">Verifies work quality.</p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" /> Approver
                  </label>
                  <Select 
                    options={[{ label: 'Michael Scott', value: '1' }]}
                    placeholder="Select Approver..."
                  />
                  <p className="text-[10px] text-muted-foreground">Final sign-off authority.</p>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-5 animate-in slide-in-from-right-4 fade-in duration-300">
              <div className="grid grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" /> Start Date
                  </label>
                  <DatePicker className="h-10 rounded-lg" placeholder="Select start date..." />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" /> Due Date
                  </label>
                  <DatePicker className="h-10 rounded-lg" placeholder="Select due date..." />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" /> Est. Effort (Hrs)
                  </label>
                  <input type="number" placeholder="e.g. 12.5" className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" /> Priority
                  </label>
                  <div className="flex bg-muted/50 rounded-lg p-1 border border-border/50 h-10">
                    <Button variant={priority === 'low' ? 'default' : 'ghost'}
                      onClick={() => setPriority('low')}
                      className={cn("flex-1 text-xs font-medium rounded-md transition-all", priority === 'low' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground hover:bg-background/50")}
                    >Low</Button>
                    <Button variant={priority === 'medium' ? 'default' : 'ghost'}
                      onClick={() => setPriority('medium')}
                      className={cn("flex-1 text-xs font-medium rounded-md transition-all", priority === 'medium' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground hover:bg-background/50")}
                    >Med</Button>
                    <Button variant={priority === 'high' ? 'default' : 'ghost'}
                      onClick={() => setPriority('high')}
                      className={cn("flex-1 text-xs font-medium rounded-md transition-all", priority === 'high' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground hover:bg-background/50")}
                    >High</Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-primary" /> Blocked By (Dependencies)
                </label>
                <Select 
                  options={[
                    { label: 'T-1001: Requirements Analysis', value: 'T-1001' },
                    { label: 'T-1004: UI/UX Design', value: 'T-1004' },
                    { label: 'T-1002: System Architecture Design', value: 'T-1002' },
                    { label: 'T-1005: API & Backend Dev', value: 'T-1005' },
                  ]}
                  placeholder="Search for tasks that must finish first..."
                />
                <p className="text-[10px] text-muted-foreground font-medium text-primary/80">
                  Selecting a task here will automatically generate a connecting line in the Dependency Map.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-primary" /> Attachments
                </label>
                <div className="h-14 border-2 border-dashed border-border/60 rounded-lg flex items-center justify-center text-sm text-muted-foreground bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer">
                  Drag and drop files here
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-border/50 bg-muted/10 sm:justify-between items-center">
          {step === 1 && (
            <>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleNext} disabled={!title.trim() || !description.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all">Next: Assignments</Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button variant="ghost" onClick={handleBack}>Back</Button>
              <Button onClick={handleNext} className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all">Next: Planning</Button>
            </>
          )}
          {step === 3 && (
            <>
              <Button variant="ghost" onClick={handleBack}>Back</Button>
              <Button onClick={handleClose} className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md shadow-primary/20">Create Task</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
