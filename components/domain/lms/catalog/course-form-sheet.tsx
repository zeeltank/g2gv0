'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type {
  CatalogCourse,
  CatalogFilterOptions,
  CourseCreatePayload,
  CourseUpdatePayload,
} from '@/services/lms'

export type CourseFormMode = 'create' | 'edit'

interface FormState {
  display_name: string
  standard_id: string
  subject_category: string
  subject_type: string
  subject_code: string
  short_name: string
  jobrole: string
  sort_order: string
  certificate_validity_months: string
  status: boolean
}

const EMPTY_FORM: FormState = {
  display_name: '',
  standard_id: '',
  subject_category: '',
  subject_type: '',
  subject_code: '',
  short_name: '',
  jobrole: '',
  sort_order: '1',
  certificate_validity_months: '',
  status: true,
}

function toFormState(course: CatalogCourse | null): FormState {
  if (!course) return EMPTY_FORM

  return {
    display_name: course.display_name ?? '',
    standard_id: course.standard_id != null ? String(course.standard_id) : '',
    subject_category: course.subject_category ?? '',
    subject_type: course.subject_type ?? '',
    subject_code: course.subject_code ?? '',
    short_name: course.short_name ?? '',
    jobrole: course.jobrole ?? '',
    sort_order: course.sort_order != null ? String(course.sort_order) : '1',
    certificate_validity_months:
      course.certificate_validity_months != null ? String(course.certificate_validity_months) : '',
    status: course.status === 1,
  }
}

/**
 * Free-text field with suggestions from the values already in the catalogue.
 *
 * subject_category, subject_type and jobrole are free-text columns on
 * sub_std_map with no master table, so the field must accept new values while
 * still steering users toward the existing ones.
 */
function SuggestInput({
  id,
  label,
  value,
  onChange,
  suggestions,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
}) {
  const listId = `${id}-options`

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        list={listId}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={listId}>
        {suggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
    </div>
  )
}

/**
 * Create / edit form for a catalogue course.
 *
 * Create posts to /school_setup/master_setup (multipart, supports the cover
 * image); edit PUTs to /api/lms/courses/{id}, which does not handle uploads -
 * so the image field is create-only rather than silently ignored on save.
 */
export function CourseFormSheet({
  open,
  onOpenChange,
  mode,
  course,
  filterOptions,
  saving,
  onCreate,
  onUpdate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: CourseFormMode
  course: CatalogCourse | null
  filterOptions: CatalogFilterOptions | null
  saving: boolean
  onCreate: (payload: CourseCreatePayload) => Promise<{ ok: boolean; message: string }>
  onUpdate: (id: number, payload: CourseUpdatePayload) => Promise<{ ok: boolean; message: string }>
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [image, setImage] = useState<File | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  // Reset whenever the sheet opens so a previous edit never leaks into a create.
  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setForm(mode === 'edit' ? toFormState(course) : EMPTY_FORM)
      setImage(null)
      setErrors({})
    })
  }, [open, mode, course])

  const departmentOptions = useMemo(
    () =>
      (filterOptions?.departments ?? []).map((department) => ({
        value: String(department.id),
        label: department.department,
      })),
    [filterOptions],
  )

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  /** Mirrors LmsCourseController@update's rules so the user sees them inline. */
  const validate = () => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {}

    if (!form.display_name.trim()) {
      nextErrors.display_name = 'Course name is required.'
    } else if (form.display_name.length > 191) {
      nextErrors.display_name = 'Course name must be 191 characters or fewer.'
    }

    if (!form.standard_id) nextErrors.standard_id = 'Department is required.'
    if (form.subject_code.length > 100) nextErrors.subject_code = 'Maximum 100 characters.'
    if (form.short_name.length > 100) nextErrors.short_name = 'Maximum 100 characters.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    const base: CourseUpdatePayload = {
      display_name: form.display_name.trim(),
      standard_id: Number(form.standard_id),
      subject_category: form.subject_category.trim() || null,
      subject_type: form.subject_type.trim() || null,
      subject_code: form.subject_code.trim() || null,
      short_name: form.short_name.trim() || null,
      jobrole: form.jobrole.trim() || null,
      sort_order: form.sort_order ? Number(form.sort_order) : 1,
      // Blank means the certificate never expires.
      certificate_validity_months: form.certificate_validity_months
        ? Number(form.certificate_validity_months)
        : null,
      status: form.status ? 1 : 0,
    }

    const result =
      mode === 'create'
        ? await onCreate({ ...base, display_image: image })
        : course
          ? await onUpdate(course.id, base)
          : { ok: false, message: 'No course selected.' }

    if (result.ok) onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border/60 p-6 pb-4">
          <SheetTitle>{mode === 'create' ? 'New Course' : 'Edit Course'}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? 'Add a course to the catalog.'
              : 'Update this course. Learner enrolments are not affected.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="course-name">
              Course name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="course-name"
              value={form.display_name}
              onChange={(event) => setField('display_name', event.target.value)}
              placeholder="e.g. Workplace Safety Fundamentals"
              aria-invalid={Boolean(errors.display_name)}
            />
            {errors.display_name && (
              <p className="text-xs font-medium text-destructive">{errors.display_name}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="course-department">
              Department <span className="text-destructive">*</span>
            </Label>
            <Select
              id="course-department"
              value={form.standard_id}
              onChange={(value) => setField('standard_id', String(value))}
              options={departmentOptions}
              placeholder="Select a department..."
            />
            {errors.standard_id && (
              <p className="text-xs font-medium text-destructive">{errors.standard_id}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <SuggestInput
              id="course-category"
              label="Category"
              value={form.subject_category}
              onChange={(value) => setField('subject_category', value)}
              suggestions={filterOptions?.categories ?? []}
              placeholder="e.g. Technical"
            />
            <SuggestInput
              id="course-type"
              label="Type"
              value={form.subject_type}
              onChange={(value) => setField('subject_type', value)}
              suggestions={filterOptions?.subject_types ?? []}
              placeholder="e.g. E-learning Module"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="course-code">Course code</Label>
              <Input
                id="course-code"
                value={form.subject_code}
                onChange={(event) => setField('subject_code', event.target.value)}
                placeholder="e.g. WSF-101"
              />
              {errors.subject_code && (
                <p className="text-xs font-medium text-destructive">{errors.subject_code}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="course-short-name">Short name</Label>
              <Input
                id="course-short-name"
                value={form.short_name}
                onChange={(event) => setField('short_name', event.target.value)}
                placeholder="e.g. SafetyFund"
              />
              {errors.short_name && (
                <p className="text-xs font-medium text-destructive">{errors.short_name}</p>
              )}
            </div>
          </div>

          <SuggestInput
            id="course-jobrole"
            label="Job role"
            value={form.jobrole}
            onChange={(value) => setField('jobrole', value)}
            suggestions={filterOptions?.jobroles ?? []}
            placeholder="Optional"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="course-sort-order">Sort order</Label>
              <Input
                id="course-sort-order"
                type="number"
                min={0}
                value={form.sort_order}
                onChange={(event) => setField('sort_order', event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="course-cert-validity">Certificate validity (months)</Label>
              <Input
                id="course-cert-validity"
                type="number"
                min={1}
                max={600}
                value={form.certificate_validity_months}
                onChange={(event) => setField('certificate_validity_months', event.target.value)}
                placeholder="Never expires"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank for a certificate that never expires.
              </p>
            </div>
          </div>

          {mode === 'create' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="course-image">Cover image</Label>
              <Input
                id="course-image"
                type="file"
                accept="image/*"
                onChange={(event) => setImage(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Optional. Images can only be set when the course is created.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="flex flex-col">
              <Label htmlFor="course-status" className="cursor-pointer">
                Active
              </Label>
              <span className="text-xs text-muted-foreground">
                Inactive courses stay in the catalog but are not offered to learners.
              </span>
            </div>
            <Switch
              id="course-status"
              checked={form.status}
              onChange={(event) => setField('status', event.target.checked)}
            />
          </div>
        </div>

        <SheetFooter className="border-t border-border/60 p-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving} className="gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {mode === 'create' ? 'Create course' : 'Save changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
