'use client'

import React, { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { LearningChapter, LearningContent } from '@/services/lms'

/**
 * Chapter and lesson authoring for admins and HR.
 *
 * These write to /api/lms/learning/chapters and .../content rather than the
 * existing /lms/chapter_master and /lms/content_master routes: those are web
 * routes, and a cross-origin POST is rejected by Laravel's CSRF guard with 419.
 */

export type AuthoringTarget =
  | { kind: 'chapter'; mode: 'create' | 'edit'; chapter?: LearningChapter }
  | { kind: 'content'; mode: 'create' | 'edit'; chapterId: number; content?: LearningContent }

/** The file_type values the player knows how to render. */
const FILE_TYPE_OPTIONS = [
  { value: 'mp4', label: 'Video (mp4)' },
  { value: 'pdf', label: 'PDF' },
  // Slide decks and documents render in place through the Office viewer.
  // Previously they had no type here at all, so the only way to use one was
  // to add it as an external link and send the learner out of the course.
  { value: 'pptx', label: 'Slides (PPT/PPTX)' },
  { value: 'docx', label: 'Document (DOC/DOCX)' },
  { value: 'link', label: 'External link' },
  { value: 'jpg', label: 'Image' },
]

export function ChapterFormSheet({
  open,
  onOpenChange,
  target,
  categories,
  saving,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: AuthoringTarget | null
  /** Existing content_category values, so authoring reuses the tenant's own. */
  categories: string[]
  saving: boolean
  onSubmit: (values: Record<string, string>) => Promise<{ ok: boolean; message: string }>
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open || !target) return

    queueMicrotask(() => {
      setErrors({})

      if (target.kind === 'chapter') {
        setValues({
          chapter_name: target.chapter?.chapter_name ?? '',
          chapter_desc: target.chapter?.chapter_desc ?? '',
          sort_order: target.chapter?.sort_order != null ? String(target.chapter.sort_order) : '1',
        })
      } else {
        setValues({
          title: target.content?.title ?? '',
          description: target.content?.description ?? '',
          filename: target.content?.filename ?? '',
          file_type: target.content?.file_type ?? 'mp4',
          content_category: target.content?.content_category ?? (categories[0] ?? 'Videos'),
          sort_order: target.content?.sort_order != null ? String(target.content.sort_order) : '1',
        })
      }
    })
  }, [open, target, categories])

  if (!target) return null

  const isChapter = target.kind === 'chapter'
  const setField = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: '' }))
  }

  /** Mirrors the controller's rules so failures surface inline, not as a toast. */
  const validate = () => {
    const next: Record<string, string> = {}

    if (isChapter) {
      if (!values.chapter_name?.trim()) next.chapter_name = 'Chapter name is required.'
      else if (values.chapter_name.length > 191) next.chapter_name = 'Maximum 191 characters.'
    } else {
      if (!values.title?.trim()) next.title = 'Lesson title is required.'
      else if (values.title.length > 191) next.title = 'Maximum 191 characters.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    const result = await onSubmit(values)
    if (result.ok) onOpenChange(false)
  }

  const title = `${target.mode === 'create' ? 'New' : 'Edit'} ${isChapter ? 'chapter' : 'lesson'}`

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border/60 p-6 pb-4">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {isChapter
              ? 'Chapters group the lessons in this course.'
              : 'A lesson points at a media file or an external link.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          {isChapter ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="chapter-name">
                  Chapter name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="chapter-name"
                  value={values.chapter_name ?? ''}
                  onChange={(event) => setField('chapter_name', event.target.value)}
                  placeholder="e.g. Fundamentals"
                />
                {errors.chapter_name && (
                  <p className="text-xs font-medium text-destructive">{errors.chapter_name}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="chapter-desc">Description</Label>
                <Textarea
                  id="chapter-desc"
                  rows={3}
                  value={values.chapter_desc ?? ''}
                  onChange={(event) => setField('chapter_desc', event.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="content-title">
                  Lesson title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="content-title"
                  value={values.title ?? ''}
                  onChange={(event) => setField('title', event.target.value)}
                  placeholder="e.g. Introduction to scheduling"
                />
                {errors.title && (
                  <p className="text-xs font-medium text-destructive">{errors.title}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="content-desc">Description</Label>
                <Textarea
                  id="content-desc"
                  rows={3}
                  value={values.description ?? ''}
                  onChange={(event) => setField('description', event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="content-url">Media URL</Label>
                <Input
                  id="content-url"
                  value={values.filename ?? ''}
                  onChange={(event) => setField('filename', event.target.value)}
                  placeholder="https://…"
                />
                <p className="text-xs text-muted-foreground">
                  Paste the file or video URL. Uploads are handled by the content library.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="content-type">Type</Label>
                  <Select
                    id="content-type"
                    value={values.file_type ?? 'mp4'}
                    onChange={(value) => setField('file_type', String(value))}
                    options={FILE_TYPE_OPTIONS}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="content-category">Category</Label>
                  <Input
                    id="content-category"
                    list="content-category-options"
                    value={values.content_category ?? ''}
                    onChange={(event) => setField('content_category', event.target.value)}
                    placeholder="e.g. Videos"
                  />
                  <datalist id="content-category-options">
                    {categories.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="authoring-sort-order">Sort order</Label>
            <Input
              id="authoring-sort-order"
              type="number"
              min={0}
              value={values.sort_order ?? '1'}
              onChange={(event) => setField('sort_order', event.target.value)}
            />
          </div>
        </div>

        <SheetFooter className="border-t border-border/60 p-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving} className="gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {target.mode === 'create' ? 'Create' : 'Save changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function AuthoringDeleteDialog({
  target,
  onCancel,
  onConfirm,
}: {
  target: { kind: 'chapter' | 'content'; id: number; label: string } | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={target !== null} onOpenChange={(next: boolean) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete this {target?.kind === 'chapter' ? 'chapter' : 'lesson'}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {target
              ? target.kind === 'chapter'
                ? `"${target.label}" and every lesson inside it will be removed. Learner progress rows are kept.`
                : `"${target.label}" will be removed from this course.`
              : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
