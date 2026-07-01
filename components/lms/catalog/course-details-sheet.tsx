import React from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Image as ImageIcon } from 'lucide-react'

export function CourseDetailsSheet({
  course,
  open,
  onOpenChange,
}: {
  course: any
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!course) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col gap-0 border-l border-border/80">
        <SheetHeader className="p-6 pb-0 space-y-0 text-left">
          <SheetTitle className="text-xl font-bold">Course Details</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Image Placeholder */}
          <div className="w-full h-40 bg-muted/50 rounded-xl border border-border/60 flex items-center justify-center">
            <ImageIcon className="size-10 text-muted-foreground/30" />
          </div>

          {/* Header Info */}
          <div className="flex flex-col gap-2">
            <StatusBadge 
              variant={course.status === 'Published' ? 'success' : course.status === 'Draft' ? 'default' : course.status === 'Under Review' ? 'warning' : 'error'} 
              className="w-fit text-[10px] uppercase font-bold tracking-wider"
            >
              {course.status}
            </StatusBadge>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground leading-tight">
                {course.title}
              </h2>
              <span className="text-sm font-semibold text-muted-foreground mt-0.5">
                v{course.version}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {course.description}
            </p>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-[100px_1fr] gap-y-3 text-sm">
            <span className="text-muted-foreground font-medium">Category</span>
            <span className="font-semibold text-foreground">{course.category}</span>
            
            <span className="text-muted-foreground font-medium">Type</span>
            <span className="font-semibold text-foreground">{course.type}</span>
            
            <span className="text-muted-foreground font-medium">Mandatory</span>
            <span className="font-semibold text-foreground">{course.mandatory ? 'Yes' : 'No'}</span>
            
            <span className="text-muted-foreground font-medium">Duration</span>
            <span className="font-semibold text-foreground">45 mins</span>
            
            <span className="text-muted-foreground font-medium">Language</span>
            <span className="font-semibold text-foreground">English</span>
            
            <span className="text-muted-foreground font-medium">Owner</span>
            <span className="font-semibold text-foreground">HR Team</span>
            
            <span className="text-muted-foreground font-medium">Created On</span>
            <span className="font-semibold text-foreground">Mar 15, 2024</span>
            
            <span className="text-muted-foreground font-medium">Last Updated</span>
            <span className="font-semibold text-foreground">{course.updatedAt}</span>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 mt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Actions</h3>
            <Button className="w-full justify-center">Edit Course</Button>
            <Button variant="outline" className="w-full justify-center">Assign Course</Button>
            <Button variant="outline" className="w-full justify-center">Duplicate Course</Button>
            <Button variant="outline" className="w-full justify-center text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20">Archive Course</Button>
          </div>

          {/* Vertical Menu Tabs */}
          <div className="flex flex-col gap-1 mt-4">
            <button className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted text-sm font-semibold text-foreground transition-colors">
              <span>Overview</span>
            </button>
            <button className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/50 text-sm font-semibold text-muted-foreground transition-colors">
              <span>Content</span>
              <span className="bg-muted px-2 py-0.5 rounded-full text-xs font-bold text-foreground">8</span>
            </button>
            <button className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/50 text-sm font-semibold text-muted-foreground transition-colors">
              <span>Learners</span>
              <span className="bg-muted px-2 py-0.5 rounded-full text-xs font-bold text-foreground">{course.assignedLearners}</span>
            </button>
            <button className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/50 text-sm font-semibold text-muted-foreground transition-colors">
              <span>Sessions</span>
              <span className="bg-muted px-2 py-0.5 rounded-full text-xs font-bold text-foreground">3</span>
            </button>
            <button className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/50 text-sm font-semibold text-muted-foreground transition-colors">
              <span>Certificates</span>
              <span className="bg-muted px-2 py-0.5 rounded-full text-xs font-bold text-foreground">{course.assignedLearners}</span>
            </button>
            <button className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/50 text-sm font-semibold text-muted-foreground transition-colors">
              <span>Feedback</span>
              <span className="bg-muted px-2 py-0.5 rounded-full text-xs font-bold text-foreground">32</span>
            </button>
            <button className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/50 text-sm font-semibold text-muted-foreground transition-colors">
              <span>Activity</span>
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
