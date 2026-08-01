'use client'

import React, { useEffect, useState } from 'react'
import { AlertTriangle, Image as ImageIcon, Layers, Loader2, Pencil, Trash2, Users } from 'lucide-react'
import { format } from 'date-fns'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/ui/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { lmsCatalogService, type CatalogCourse, type CatalogCourseDetail } from '@/services/lms'

function formatDate(value: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : format(parsed, 'dd MMM yyyy')
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </>
  )
}

/**
 * Course details panel.
 *
 * Every field shown maps to a real column or a real aggregate. The previous
 * version displayed hardcoded Duration / Language / Owner / Created On values
 * and fabricated Sessions / Certificates / Feedback counts - sub_std_map has no
 * such columns and those entities do not exist, so they are gone rather than
 * invented.
 */
export function CourseDetailsSheet({
  course,
  open,
  onOpenChange,
  canAuthor,
  onEdit,
  onDelete,
}: {
  course: CatalogCourse | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Admin/HR only - matches what the API will actually allow. */
  canAuthor: boolean
  onEdit: (course: CatalogCourse) => void
  onDelete: (course: CatalogCourse) => void
}) {
  const { user } = useAuth()
  const [detail, setDetail] = useState<CatalogCourseDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The list response has everything except the chapter count, which needs a
  // per-course query - so the sheet fetches the full record when it opens.
  useEffect(() => {
    if (!open || !course) return

    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) return
      setLoading(true)
      setError(null)

      lmsCatalogService
        .getCourse(getLaravelContext(user), course.id)
        .then((response) => {
          if (!cancelled) setDetail(response.data ?? null)
        })
        .catch((fetchError: unknown) => {
          if (cancelled) return
          setDetail(null)
          setError(
            fetchError instanceof Error && fetchError.message
              ? fetchError.message
              : 'Failed to load course details.',
          )
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    })

    return () => {
      cancelled = true
    }
  }, [open, course, user])

  if (!course) return null

  const shown = detail ?? course
  const isActive = shown.status === 1

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 border-l border-border/80 p-0 sm:max-w-md">
        <SheetHeader className="space-y-0 p-6 pb-0 text-left">
          <SheetTitle className="text-xl font-bold">Course Details</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/50">
            {shown.display_image && shown.display_image !== '/' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shown.display_image} alt="" className="size-full object-cover" />
            ) : (
              <ImageIcon className="size-10 text-muted-foreground/30" />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <StatusBadge
              variant={isActive ? 'active' : 'inactive'}
              className="w-fit text-[10px] font-bold uppercase tracking-wider"
            >
              {isActive ? 'Active' : 'Inactive'}
            </StatusBadge>
            <h2 className="text-xl font-bold leading-tight tracking-tight text-foreground">
              {shown.display_name ?? 'Untitled course'}
            </h2>
            {shown.standard_name && (
              <p className="text-sm text-muted-foreground">{shown.standard_name}</p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <Users className="size-3.5" /> Learners
              </div>
              <p className="mt-1 text-xl font-black text-foreground">{shown.learners}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <Layers className="size-3.5" /> Chapters
              </div>
              <p className="mt-1 text-xl font-black text-foreground">
                {loading && !detail ? <Skeleton className="h-6 w-8" /> : (detail?.chapter_count ?? 0)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wide text-muted-foreground">
                Completion
              </span>
              <span className="font-bold text-foreground">{shown.completion_rate}%</span>
            </div>
            <Progress
              value={shown.completion_rate}
              className="h-2 bg-muted-foreground/20 [&>div]:bg-primary"
            />
            <p className="text-[11px] text-muted-foreground">
              {shown.completed_learners} of {shown.learners} enrolled learners completed
            </p>
          </div>

          <div className="grid grid-cols-[110px_1fr] gap-y-3 text-sm">
            <MetaRow label="Category" value={shown.subject_category || '—'} />
            <MetaRow label="Type" value={shown.subject_type || '—'} />
            <MetaRow label="Course code" value={shown.subject_code || '—'} />
            <MetaRow label="Short name" value={shown.short_name || '—'} />
            <MetaRow label="Job role" value={shown.jobrole || '—'} />
            <MetaRow label="Department" value={shown.standard_name || '—'} />
            <MetaRow label="Sort order" value={shown.sort_order ?? '—'} />
            <MetaRow label="Created on" value={formatDate(shown.created_at)} />
            <MetaRow label="Last updated" value={formatDate(shown.updated_at)} />
          </div>

          {canAuthor && (
            <div className="mt-2 flex flex-col gap-2">
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Actions
              </h3>
              <Button className="w-full justify-center gap-2" onClick={() => onEdit(course)}>
                <Pencil className="size-4" /> Edit course
              </Button>
              <Button
                variant="outline"
                className="w-full justify-center gap-2 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDelete(course)}
              >
                <Trash2 className="size-4" /> Delete course
              </Button>
            </div>
          )}

          {loading && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Loading details…
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
