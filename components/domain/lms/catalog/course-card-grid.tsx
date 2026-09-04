'use client'

/**
 * THE COURSE CATALOGUE, AS SOMETHING YOU BROWSE.
 *
 * This screen was an admin table gated on `canAuthor`, so an ordinary employee
 * who opened it found a list they could read and no way to join anything -
 * while My Learning's empty state told them to "enrol from the learning
 * catalogue". The only working enrol control in the product was a quick-action
 * tucked into a widget on a different page.
 *
 * So the catalogue is a grid of cards any role can open, and Enrol is the
 * card's primary action. The admin table stays as the management view, where
 * bulk actions and editing live.
 *
 * ── THE LESSON COUNT IS ON THE CARD ON PURPOSE ──────────────────────────────
 *
 * 43 of 97 courses on live have no lessons at all, and 905 of 1,454 enrolments
 * are against such a course. Joining one is a dead end: there is nothing to
 * open, and `issueCertificate` refuses when the lesson count is zero. A course
 * that cannot be taken should say so on its face, not after somebody joins it.
 */

import { BookOpen, CheckCircle2, GraduationCap, Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CatalogCourse } from '@/services/lms'

export function CourseCardGrid({
  courses,
  enrollingId,
  enrolledIds,
  onEnrol,
  onOpenDetails,
}: {
  courses: CatalogCourse[]
  enrollingId: number | null
  /** Courses this viewer is already in - Enrol becomes "In My Learning". */
  enrolledIds: ReadonlySet<number>
  onEnrol: (course: CatalogCourse) => void
  onOpenDetails: (course: CatalogCourse) => void
}) {
  return (
    /*
     * Container queries, not viewport breakpoints. The nav is 260px and the
     * agent panel another 30rem, so at 1440px with both open there are ~650px
     * of content while `lg:` still matches and would lay three columns into
     * the space of one and a half.
     */
    <div className="@container/catalog">
      <ul className="grid grid-cols-1 gap-4 @2xl/catalog:grid-cols-2 @5xl/catalog:grid-cols-3">
        {courses.map((course) => {
          const enrolled = enrolledIds.has(course.id)
          const name = course.display_name ?? `Course ${course.id}`
          const inactive = course.status !== 1

          return (
            <li key={course.id}>
              <article
                className={cn(
                  'flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40',
                  inactive && 'opacity-60',
                )}
              >
                <button
                  type="button"
                  onClick={() => onOpenDetails(course)}
                  className="flex flex-1 flex-col items-start gap-2 p-4 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <span className="flex w-full items-start justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {course.subject_category ?? 'Uncategorised'}
                    </span>
                    {inactive && (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </span>

                  <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
                    {name}
                  </h3>

                  {course.standard_name && (
                    <p className="text-[11px] text-muted-foreground">{course.standard_name}</p>
                  )}

                  <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" aria-hidden="true" />
                      <span className="tabular-nums">{course.learners}</span> enrolled
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      <span className="tabular-nums">{course.completion_rate}%</span> complete
                    </span>
                  </span>
                </button>

                <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <BookOpen className="size-3.5" aria-hidden="true" />
                    {course.subject_type ?? 'Course'}
                  </span>

                  {enrolled ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-success">
                      <GraduationCap className="size-3.5" aria-hidden="true" />
                      In My Learning
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      className="h-8"
                      disabled={enrollingId !== null || inactive}
                      onClick={() => onEnrol(course)}
                    >
                      {enrollingId === course.id ? (
                        <>
                          <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
                          Enrolling…
                        </>
                      ) : (
                        'Enrol'
                      )}
                    </Button>
                  )}
                </div>
              </article>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
