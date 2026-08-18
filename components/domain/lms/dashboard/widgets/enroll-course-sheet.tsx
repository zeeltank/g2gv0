'use client'

import React from 'react'
import { AlertTriangle, BookOpen, Image as ImageIcon, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAvailableCourses } from '@/hooks/use-lms-dashboard'
import type { AvailableCourse } from '@/services/lms'

/**
 * Course picker for the "Enroll in a Course" quick action.
 *
 * Sourced from GET /api/available_courses, which already excludes anything the
 * learner is enrolled in, so every row here is actionable.
 */
export function EnrollCourseSheet({
  open,
  onOpenChange,
  onEnroll,
  enrollingCourseId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEnroll: (course: AvailableCourse) => Promise<{ ok: boolean; message: string }>
  enrollingCourseId: number | null
}) {
  const { courses, loading, error, search, setSearch, reload } = useAvailableCourses(open)

  const handleEnroll = async (course: AvailableCourse) => {
    const result = await onEnroll(course)
    if (result.ok) {
      // The enrolled course drops out of the catalogue on the next fetch.
      reload()
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border/60 p-6 pb-4">
          <SheetTitle>Enroll in a Course</SheetTitle>
          <SheetDescription>
            Courses available to you that you are not already enrolled in.
          </SheetDescription>
          <div className="pt-2">
            <SearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, category or job role..."
            />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Skeleton className="size-10 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-8 w-20 rounded-md" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-6">
              <EmptyState
                icon={<AlertTriangle className="size-8 text-destructive" />}
                title="Couldn't load courses"
                description={error}
                action={
                  <Button variant="outline" size="sm" onClick={reload}>
                    Retry
                  </Button>
                }
              />
            </div>
          ) : courses.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<BookOpen className="size-8" />}
                title={search ? 'No matching courses' : 'Nothing left to enrol in'}
                description={
                  search
                    ? 'Try a different search term.'
                    : 'You are already enrolled in every course available to you.'
                }
              />
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border/50">
              {courses.map((course) => {
                const isEnrolling = enrollingCourseId === course.id

                return (
                  <div key={course.id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-muted/30">
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-muted">
                      {course.display_image && course.display_image !== '/' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={course.display_image} alt="" className="size-full object-cover" />
                      ) : (
                        <ImageIcon className="size-5 text-muted-foreground/40" />
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <h4 className="truncate text-sm font-semibold leading-tight text-foreground">
                        {course.display_name ?? 'Untitled course'}
                      </h4>
                      <p className="truncate text-[11px] font-medium text-muted-foreground">
                        {[course.subject_type, course.subject_category, course.standard_name]
                          .filter(Boolean)
                          .join(' · ') || 'Course'}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isEnrolling}
                      onClick={() => void handleEnroll(course)}
                      className="h-8 shrink-0 gap-1.5 text-xs font-semibold"
                    >
                      {isEnrolling ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Plus className="size-3.5" />
                      )}
                      Enroll
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
