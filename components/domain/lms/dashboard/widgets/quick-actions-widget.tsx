'use client'

import React, { useMemo, useState } from 'react'
import { BookMarked, ChevronRight, FileText, GraduationCap, PlusCircle } from 'lucide-react'
import { format } from 'date-fns'
import { CardContent } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { EmptyState } from '@/components/ui/empty-state'
import type { DashboardCourse } from '@/hooks/use-lms-dashboard'
import { WidgetShell } from './shared'

function formatDate(value: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : format(parsed, 'dd MMM yyyy')
}

/**
 * Quick Actions.
 *
 * Only actions with a real destination or a real data source are listed. The
 * design's "Download Certificates", "Request Training" and "Give Feedback"
 * entries have no backing endpoint on this Laravel instance and were removed
 * rather than shipped as dead buttons.
 */
export function QuickActionsWidget({
  courses,
  onBrowseCatalog,
  onEnrollClick,
}: {
  courses: DashboardCourse[]
  onBrowseCatalog: () => void
  onEnrollClick: () => void
}) {
  const [transcriptOpen, setTranscriptOpen] = useState(false)

  const completed = useMemo(
    () =>
      courses
        .filter((course) => course.bucket === 'completed')
        .sort((a, b) => {
          const aTime = a.end_date ? new Date(a.end_date).getTime() : 0
          const bTime = b.end_date ? new Date(b.end_date).getTime() : 0
          return bTime - aTime
        }),
    [courses],
  )

  const actions = [
    {
      icon: BookMarked,
      label: 'Browse Course Catalog',
      caption: 'Explore everything on offer',
      onClick: onBrowseCatalog,
    },
    {
      icon: PlusCircle,
      label: 'Enroll in a Course',
      caption: 'Pick a course and enrol',
      onClick: onEnrollClick,
    },
    {
      icon: FileText,
      label: 'My Transcript',
      caption: `${completed.length} completed ${completed.length === 1 ? 'course' : 'courses'}`,
      onClick: () => setTranscriptOpen(true),
    },
  ]

  return (
    <>
      <WidgetShell title="Quick Actions">
        <CardContent className="flex-1 overflow-auto p-0">
          <div className="flex flex-col divide-y divide-border/30">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className="group flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-primary/5"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <action.icon className="size-4" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                    {action.label}
                  </span>
                  <span className="truncate text-[11px] font-medium text-muted-foreground">
                    {action.caption}
                  </span>
                </div>
                <ChevronRight className="size-4 text-muted-foreground/40 transition-colors group-hover:text-primary/70" />
              </button>
            ))}
          </div>
        </CardContent>
      </WidgetShell>

      <Sheet open={transcriptOpen} onOpenChange={setTranscriptOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>My Transcript</SheetTitle>
            <SheetDescription>
              Every course you have completed, from your enrolment record.
            </SheetDescription>
          </SheetHeader>

          {completed.length === 0 ? (
            <EmptyState
              icon={<GraduationCap className="size-8" />}
              title="No completed courses yet"
              description="Courses you finish will be recorded here."
            />
          ) : (
            <div className="flex flex-col divide-y divide-border/50">
              {completed.map((course) => (
                <div key={course.enrollment_id ?? course.id} className="flex flex-col gap-1 py-3.5">
                  <h4 className="text-sm font-semibold leading-tight text-foreground">
                    {course.title}
                  </h4>
                  {(course.category || course.jobrole || course.standard_name) && (
                    <p className="text-[11px] font-medium text-muted-foreground">
                      {[course.category, course.jobrole, course.standard_name]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {formatDate(course.start_date)} — {formatDate(course.end_date)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
