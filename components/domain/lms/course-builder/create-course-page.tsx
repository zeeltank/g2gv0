'use client'

import React, { useState } from 'react'
import {
  ChevronRight,
  Clock,
  Image as ImageIcon,
  CheckCircle2,
  Circle,
  Search,
  FileText,
  Video,
  FileBox,
  Users,
  Plus,
  Trash2,
  Globe,
  Calendar as CalendarIcon,
  PackageOpen,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, Radio } from '@/components/ui/radio-group'
import { FileUpload } from '@/components/ui/file-upload'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'
import { useCourseBuilder } from '@/hooks/use-course-builder'
import type { ContentKind, CourseVisibility, EnrollmentRule } from '@/services/lms'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { LMS_LEARNING_CATALOG_ACCESS_LINK } from '@/lib/gtg-navigation'
import { CourseCompetencyInlinePanel } from '@/domain/competency/course-competency-inline-panel'

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

/** Inline field error, styled once so every field reads the same. */
function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
      <AlertCircle className="size-3.5 shrink-0" /> {message}
    </p>
  )
}

/** Turn a distinct-values list from the API into Select options. */
function toOptions(values: string[]) {
  return values.map((value) => ({ label: value, value }))
}

const CONTENT_KINDS: { kind: ContentKind; label: string; icon: typeof Video }[] = [
  { kind: 'video', label: 'Video', icon: Video },
  { kind: 'document', label: 'Document', icon: FileText },
  { kind: 'scorm', label: 'SCORM', icon: FileBox },
  { kind: 'session', label: 'Live Session', icon: Users },
]

const VALIDITY_OPTIONS = [
  { label: 'Never Expires', value: '' },
  { label: 'Valid for 1 Year', value: '12' },
  { label: 'Valid for 2 Years', value: '24' },
  { label: 'Valid for 3 Years', value: '36' },
]

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export function CreateCoursePage() {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const builder = useCourseBuilder()
  const {
    step, steps, goNext, goBack, goToStep,
    form, setField, errors,
    courseId, prerequisites, setPrerequisites, courseOptions,
    modules, contentCount, addModule, removeModule, addContent, removeContent,
    assessments, addAssessment, removeAssessment,
    categories, types, departments, jobRoles, languages, certificateTemplates,
    loadingOptions, saving, message, error, dismiss,
    saveDraft, publish,
    preview, checklist,
  } = builder

  // Small local composers — these hold what the user is typing before it is
  // committed to the server, so they belong here rather than in the hook.
  const [newModuleName, setNewModuleName] = useState('')
  const [contentDraft, setContentDraft] = useState<{
    moduleId: number
    kind: ContentKind
    title: string
    url: string
  } | null>(null)
  const [quizName, setQuizName] = useState('')

  /*
   * Roles for the chosen department. Narrowing here rather than in the hook
   * because it depends on the form, and an unnarrowed list of 332 roles is not
   * a choice, it is a search problem.
   */
  const jobRoleOptions = jobRoles
    .filter((role) =>
      !form.standard_id || String(role.department_id ?? '') === String(form.standard_id))
    .map((role) => role.jobrole)

  const handleCancel = () => router.push(resolveAccessLink(LMS_LEARNING_CATALOG_ACCESS_LINK))

  const handlePublish = async () => {
    const result = await publish()
    if (result.ok) router.push(resolveAccessLink(LMS_LEARNING_CATALOG_ACCESS_LINK))
  }

  return (
    <div className="flex h-full w-full flex-col bg-background pb-10">
      {/* Top Header */}
      <div className="mb-6 flex items-center justify-between border-b border-border/60 pb-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>LMS</span>
            <ChevronRight className="size-3" />
            <span>Course Builder</span>
            <ChevronRight className="size-3" />
            <span className="text-primary">
              {courseId ? `Draft #${courseId}` : 'Create New Course'}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Course Builder</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="gap-2 font-semibold shadow-sm"
            disabled={saving}
            onClick={() => void saveDraft()}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save as Draft
          </Button>
          <Button variant="outline" className="gap-2 font-semibold shadow-sm" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </div>

      {/* Stepper */}
      <Card className="mb-6 overflow-hidden rounded-xl border-border/80 bg-card shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex flex-1 items-center">
              {steps.map((entry, index) => (
                <React.Fragment key={entry.id}>
                  <button
                    type="button"
                    className="group relative z-10 flex cursor-pointer items-center gap-3"
                    onClick={() => goToStep(entry.id)}
                  >
                    <div
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-200',
                        step === entry.id
                          ? 'border-primary bg-primary text-primary-foreground shadow-md ring-4 ring-primary/10'
                          : step > entry.id
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-muted-foreground/30 bg-background text-muted-foreground group-hover:border-muted-foreground/50',
                      )}
                    >
                      {step > entry.id ? <CheckCircle2 className="size-4" /> : entry.id}
                    </div>
                    <span
                      className={cn(
                        'hidden whitespace-nowrap text-sm font-bold transition-colors md:block',
                        step === entry.id
                          ? 'text-foreground'
                          : 'text-muted-foreground group-hover:text-foreground/80',
                      )}
                    >
                      {entry.label}
                    </span>
                  </button>
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        'mx-4 h-[2px] w-full max-w-[60px] rounded-full transition-colors duration-300 lg:max-w-[100px]',
                        step > entry.id ? 'bg-primary' : 'bg-border',
                      )}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
            <div className="flex items-center gap-3 border-l border-border/60 pl-6">
              <span className="text-sm font-bold text-muted-foreground">Step {step} of 5</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Banners */}
      {(message || error) && (
        <div
          className={cn(
            'mb-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm',
            error
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : 'border-success/40 bg-success/10 text-success',
          )}
        >
          <span className="font-medium">{error ?? message}</span>
          <button type="button" onClick={dismiss} aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-6 xl:flex-row">
        <div className="flex flex-1 flex-col gap-6">
          <Card className="flex min-h-[500px] flex-1 flex-col rounded-xl border-border/80 bg-card shadow-sm">
            {/* ── Step 1: Basic Information ── */}
            {step === 1 && (
              <>
                <CardHeader className="border-b border-border/40 px-6 pb-4 pt-6">
                  <CardTitle className="text-lg font-bold">Basic Information</CardTitle>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">
                    Define the essential details and metadata about this course.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-8 p-6">
                  <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="flex gap-1 text-sm font-bold text-foreground">
                        Course Title <span className="text-destructive">*</span>
                      </label>
                      <Input
                        placeholder="E.g. Introduction to Project Management"
                        className="h-10 bg-muted/20"
                        value={form.display_name}
                        onChange={(event) => setField('display_name', event.target.value)}
                      />
                      <FieldError message={errors.display_name} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-foreground">Course Code</label>
                      <Input
                        placeholder="E.g. PM-101"
                        className="h-10 bg-muted/20"
                        value={form.subject_code}
                        onChange={(event) => setField('subject_code', event.target.value)}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="flex gap-1 text-sm font-bold text-foreground">
                        Short Description
                      </label>
                      <div className="relative">
                        <Textarea
                          placeholder="Provide a brief overview of what learners will achieve..."
                          className="h-24 resize-none bg-muted/20 pb-8"
                          value={form.description}
                          maxLength={2000}
                          onChange={(event) => setField('description', event.target.value)}
                        />
                        <span className="absolute bottom-2 right-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          {form.description.length} / 2000
                        </span>
                      </div>
                      <FieldError message={errors.description} />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-foreground">Course Type</label>
                      <Select
                        options={toOptions(types)}
                        value={form.subject_type}
                        onChange={(value) => setField('subject_type', String(value))}
                        placeholder={loadingOptions ? 'Loading…' : 'Select a type'}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-foreground">Estimated Duration</label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Input
                            placeholder="00:00"
                            className="h-10 bg-muted/20 pl-9"
                            value={form.duration}
                            onChange={(event) => setField('duration', event.target.value)}
                          />
                          <Clock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        </div>
                        <span className="rounded-md bg-muted px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          HH:MM
                        </span>
                      </div>
                      <FieldError message={errors.duration} />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-foreground">Category</label>
                      <Select
                        options={toOptions(categories)}
                        value={form.subject_category}
                        onChange={(value) => setField('subject_category', String(value))}
                        placeholder={loadingOptions ? 'Loading…' : 'Select a category'}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-foreground">Language</label>
                      <Select
                        options={toOptions(languages)}
                        value={form.language}
                        onChange={(value) => setField('language', String(value))}
                        placeholder="Select a language"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="flex gap-1 text-sm font-bold text-foreground">
                        Department <span className="text-destructive">*</span>
                      </label>
                      <Select
                        options={departments.map((department) => ({
                          label: department.department,
                          value: String(department.id),
                        }))}
                        value={form.standard_id}
                        onChange={(value) => setField('standard_id', String(value))}
                        placeholder={loadingOptions ? 'Loading…' : 'Select a department'}
                      />
                      <FieldError message={errors.standard_id} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-foreground">Job Role</label>
                      {/*
                        This was a bare text input with no options of any kind -
                        not even the free-text suggestions the catalogue sheet
                        had - so the only way to fill it was to type a role name
                        from memory and hope it matched. It now offers the
                        organisation's actual roles, narrowed to the chosen
                        department, and a blank first option because the field
                        is optional.
                      */}
                      <Select
                        value={form.jobrole}
                        onChange={(value) => setField('jobrole', value)}
                        options={[
                          { value: '', label: 'No specific role' },
                          ...jobRoleOptions.map((role) => ({ value: role, label: role })),
                        ]}
                        placeholder={form.standard_id ? 'Select a role' : 'Select a department first'}
                        disabled={jobRoleOptions.length === 0}
                      />
                    </div>
                  </div>

                  <div className="h-px w-full bg-border/60" />

                  <div>
                    <h3 className="mb-4 text-base font-bold">Configuration &amp; Settings</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/10 p-4 transition-colors hover:bg-muted/30">
                        <Checkbox
                          id="mandatory"
                          className="mt-0.5"
                          checked={form.is_mandatory}
                          onCheckedChange={(checked) => setField('is_mandatory', Boolean(checked))}
                        />
                        <div className="flex flex-col gap-0.5">
                          <label htmlFor="mandatory" className="cursor-pointer text-sm font-bold text-foreground">
                            Mandatory Course
                          </label>
                          <span className="text-xs leading-snug text-muted-foreground">
                            Automatically assign and enforce completion rules.
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/10 p-4 transition-colors hover:bg-muted/30">
                        <Checkbox
                          id="discussion"
                          className="mt-0.5"
                          checked={form.discussion_enabled}
                          onCheckedChange={(checked) =>
                            setField('discussion_enabled', Boolean(checked))
                          }
                        />
                        <div className="flex flex-col gap-0.5">
                          <label htmlFor="discussion" className="cursor-pointer text-sm font-bold text-foreground">
                            Enable Discussion
                          </label>
                          <span className="text-xs leading-snug text-muted-foreground">
                            Allow learners to ask questions in a course forum.
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/10 p-4">
                        <span className="text-sm font-bold text-foreground">Course Visibility</span>
                        <RadioGroup
                          value={form.visibility}
                          onValueChange={(value) => setField('visibility', value as CourseVisibility)}
                          className="flex items-center gap-4"
                        >
                          <Radio value="all" label="Visible to all" size="sm" />
                          <Radio value="restricted" label="Restricted" size="sm" />
                        </RadioGroup>
                      </div>

                      <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/10 p-4">
                        <span className="text-sm font-bold text-foreground">
                          Prerequisites ({prerequisites.length})
                        </span>
                        {prerequisites.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {prerequisites.map((item) => (
                              <span
                                key={item.id}
                                className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
                              >
                                {item.title}
                                <button
                                  type="button"
                                  aria-label={`Remove ${item.title}`}
                                  onClick={() =>
                                    setPrerequisites((current) =>
                                      current.filter((entry) => entry.id !== item.id),
                                    )
                                  }
                                >
                                  <X className="size-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <Select
                          options={courseOptions
                            .filter(
                              (option) =>
                                option.id !== courseId &&
                                !prerequisites.some((entry) => entry.id === option.id),
                            )
                            .map((option) => ({
                              label: option.title ?? `Course ${option.id}`,
                              value: String(option.id),
                            }))}
                          value=""
                          onChange={(value) => {
                            const picked = courseOptions.find(
                              (option) => option.id === Number(value),
                            )
                            if (picked) setPrerequisites((current) => [...current, picked])
                          }}
                          placeholder="+ Add Prerequisite Rule"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="h-px w-full bg-border/60" />

                  <div className="max-w-lg space-y-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-bold text-foreground">Course Thumbnail</label>
                      <span className="text-xs text-muted-foreground">
                        Upload a 16:9 image (1280x720) to display in the catalog.
                      </span>
                    </div>
                    <FileUpload
                      hint="JPEG, PNG or WebP up to 5MB"
                      className="border-dashed bg-muted/10"
                      onFileSelect={(file: File | null) => setField('thumbnail', file)}
                    />
                    {form.thumbnail && (
                      <p className="text-xs font-semibold text-muted-foreground">
                        Selected: {form.thumbnail.name}
                      </p>
                    )}
                  </div>

                  {/* WHAT THIS COURSE BUILDS - merged in from the standalone
                      Course Competencies screen, which has been removed. The
                      author knows what the course develops; an admin filling a
                      matrix later is guessing. It sits in Basic Information
                      because it describes the course, not its content. */}
                  <div className="mt-6 border-t border-border/40 pt-6">
                    <h3 className="mb-1 text-sm font-bold text-foreground">What this course builds</h3>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Map the competencies this course develops. This is what lets it be suggested to
                      someone with a matching gap.
                    </p>
                    <CourseCompetencyInlinePanel courseId={courseId ? Number(courseId) : null} />
                  </div>
                </CardContent>
              </>
            )}

            {/* ── Step 2: Content & Modules ── */}
            {step === 2 && (
              <>
                <CardHeader className="border-b border-border/40 px-6 pb-4 pt-6">
                  <CardTitle className="text-lg font-bold">Content &amp; Modules</CardTitle>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">
                    Structure your course by adding modules and content files.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-6 bg-muted/5 p-6">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="New module name, e.g. Module 1: Introduction"
                      className="h-9 bg-background"
                      value={newModuleName}
                      onChange={(event) => setNewModuleName(event.target.value)}
                    />
                    <Button
                      size="sm"
                      className="shrink-0 gap-2"
                      disabled={saving || !newModuleName.trim()}
                      onClick={() =>
                        void addModule(newModuleName.trim()).then((result) => {
                          if (result.ok) setNewModuleName('')
                        })
                      }
                    >
                      <Plus className="size-4" /> Add Module
                    </Button>
                  </div>

                  {modules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-12">
                      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
                        <PackageOpen className="size-6 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm font-bold text-foreground">No modules yet.</p>
                      <p className="mt-1 max-w-sm text-center text-xs text-muted-foreground">
                        Add your first module above to start building the course structure.
                      </p>
                    </div>
                  ) : (
                    modules.map((module) => (
                      <div
                        key={module.id}
                        className="overflow-hidden rounded-lg border border-border/60 bg-background shadow-sm"
                      >
                        <div className="flex items-center gap-3 border-b border-border/40 bg-muted/30 p-3">
                          <div className="flex flex-1 flex-col">
                            <span className="text-sm font-bold text-foreground">
                              {module.chapter_name}
                            </span>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {module.content?.length ?? 0} item
                              {(module.content?.length ?? 0) === 1 ? '' : 's'}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${module.chapter_name}`}
                            className="size-7 text-muted-foreground hover:text-destructive"
                            disabled={saving}
                            onClick={() => void removeModule(module.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>

                        <div className="flex flex-col gap-3 p-4">
                          {(module.content ?? []).map((content) => (
                            <div
                              key={content.id}
                              className="flex items-center gap-3 rounded-md border border-border/50 px-3 py-2"
                            >
                              <FileText className="size-4 shrink-0 text-muted-foreground" />
                              <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm font-semibold text-foreground">
                                  {content.title}
                                </span>
                                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                  {content.file_type}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete ${content.title}`}
                                className="size-7 text-muted-foreground hover:text-destructive"
                                disabled={saving}
                                onClick={() => void removeContent(content.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          ))}

                          {contentDraft?.moduleId === module.id ? (
                            <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                                New {contentDraft.kind}
                              </span>
                              <Input
                                placeholder="Title"
                                className="h-9 bg-background"
                                value={contentDraft.title}
                                onChange={(event) =>
                                  setContentDraft({ ...contentDraft, title: event.target.value })
                                }
                              />
                              <Input
                                placeholder="URL or file reference"
                                className="h-9 bg-background"
                                value={contentDraft.url}
                                onChange={(event) =>
                                  setContentDraft({ ...contentDraft, url: event.target.value })
                                }
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  disabled={saving || !contentDraft.title.trim()}
                                  onClick={() =>
                                    void addContent(
                                      contentDraft.moduleId,
                                      contentDraft.kind,
                                      contentDraft.title.trim(),
                                      contentDraft.url.trim(),
                                    ).then((result) => {
                                      if (result.ok) setContentDraft(null)
                                    })
                                  }
                                >
                                  Add
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setContentDraft(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-border/60 py-6">
                              <div className="flex flex-wrap gap-3">
                                {CONTENT_KINDS.map(({ kind, label, icon: Icon }) => (
                                  <Button
                                    key={kind}
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-2 text-xs font-bold"
                                    onClick={() =>
                                      setContentDraft({
                                        moduleId: module.id,
                                        kind,
                                        title: '',
                                        url: '',
                                      })
                                    }
                                  >
                                    <Icon className="size-3.5" /> {label}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </>
            )}

            {/* ── Step 3: Assessments ── */}
            {step === 3 && (
              <>
                <CardHeader className="border-b border-border/40 px-6 pb-4 pt-6">
                  <CardTitle className="text-lg font-bold">Assessments &amp; Quizzes</CardTitle>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">
                    Add tests to evaluate learner understanding.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-6 p-6">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="New quiz name"
                      className="h-9"
                      value={quizName}
                      onChange={(event) => setQuizName(event.target.value)}
                    />
                    <Button
                      size="sm"
                      className="shrink-0 gap-2"
                      disabled={saving || !quizName.trim()}
                      onClick={() =>
                        void addAssessment({
                          paper_name: quizName.trim(),
                          attempt_allowed: Number(form.max_attempts) || null,
                          exam_type: 'quiz',
                        }).then((result) => {
                          if (result.ok) setQuizName('')
                        })
                      }
                    >
                      <Plus className="size-4" /> Add Quiz
                    </Button>
                  </div>

                  {assessments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-12">
                      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
                        <FileText className="size-6 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm font-bold text-foreground">No assessments configured.</p>
                      <p className="mt-1 max-w-sm text-center text-xs text-muted-foreground">
                        Courses without assessments will be marked complete when all modules are
                        viewed.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col divide-y divide-border/50 rounded-lg border border-border/60">
                      {assessments.map((assessment) => (
                        <div key={assessment.id} className="flex items-center gap-3 p-3">
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-bold text-foreground">
                              {assessment.paper_name}
                            </span>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {assessment.total_ques} question
                              {assessment.total_ques === 1 ? '' : 's'}
                              {assessment.attempt_allowed
                                ? ` · ${assessment.attempt_allowed} attempts`
                                : ''}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${assessment.paper_name}`}
                            className="size-7 text-muted-foreground hover:text-destructive"
                            disabled={saving}
                            onClick={() => void removeAssessment(assessment.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-4 border-t border-border/40 pt-4">
                    <h3 className="text-sm font-bold">Global Assessment Rules</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-foreground">
                          Minimum Passing Score (%)
                        </label>
                        <Input
                          type="number"
                          placeholder="80"
                          className="h-9"
                          value={form.passing_score}
                          onChange={(event) => setField('passing_score', event.target.value)}
                        />
                        <FieldError message={errors.passing_score} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-foreground">
                          Maximum Attempts Allowed
                        </label>
                        <Input
                          type="number"
                          placeholder="Unlimited"
                          className="h-9"
                          value={form.max_attempts}
                          onChange={(event) => setField('max_attempts', event.target.value)}
                        />
                        <FieldError message={errors.max_attempts} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </>
            )}

            {/* ── Step 4: Certification ── */}
            {step === 4 && (
              <>
                <CardHeader className="border-b border-border/40 px-6 pb-4 pt-6">
                  <CardTitle className="text-lg font-bold">Certification Rules</CardTitle>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">
                    Configure compliance and certificate generation settings.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-6 p-6">
                  <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <Checkbox
                      id="enable-cert"
                      className="mt-1"
                      checked={form.issue_certificate}
                      onCheckedChange={(checked) => setField('issue_certificate', Boolean(checked))}
                    />
                    <div className="flex flex-col gap-1">
                      <label htmlFor="enable-cert" className="cursor-pointer text-sm font-bold text-foreground">
                        Issue Certificate upon Completion
                      </label>
                      <span className="text-xs text-muted-foreground">
                        Learners will receive a downloadable PDF certificate.
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-foreground">Certificate Template</label>
                      <Select
                        options={certificateTemplates}
                        value={form.certificate_template}
                        onChange={(value) => setField('certificate_template', String(value))}
                        disabled={!form.issue_certificate}
                        placeholder="Select a template"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-foreground">Certificate Validity</label>
                      <Select
                        options={VALIDITY_OPTIONS}
                        value={form.certificate_validity_months}
                        onChange={(value) =>
                          setField('certificate_validity_months', String(value))
                        }
                        disabled={!form.issue_certificate}
                      />
                      <FieldError message={errors.certificate_validity_months} />
                    </div>
                  </div>

                  <div className="space-y-3 border-t border-border/40 pt-4">
                    <div className="flex items-start gap-3 p-3">
                      <Checkbox
                        id="recert"
                        className="mt-0.5"
                        checked={form.recert_alerts}
                        disabled={!form.issue_certificate}
                        onCheckedChange={(checked) => setField('recert_alerts', Boolean(checked))}
                      />
                      <div className="flex flex-col">
                        <label htmlFor="recert" className="cursor-pointer text-sm font-bold text-foreground">
                          Enable Re-certification Alerts
                        </label>
                        <span className="text-xs text-muted-foreground">
                          Notify learners before their certificate expires.
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </>
            )}

            {/* ── Step 5: Publish Settings ── */}
            {step === 5 && (
              <>
                <CardHeader className="border-b border-border/40 px-6 pb-4 pt-6">
                  <CardTitle className="text-lg font-bold">Publish Settings</CardTitle>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">
                    Define who can see this course and how they enroll.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-8 p-6">
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold">
                      <Globe className="size-4" /> Enrollment Rules
                    </h3>
                    <RadioGroup
                      value={form.enrollment_rule}
                      onValueChange={(value) => setField('enrollment_rule', value as EnrollmentRule)}
                      className="grid grid-cols-1 gap-4 md:grid-cols-2"
                    >
                      <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-background p-4">
                        <Radio value="open" />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold">Open Enrollment</span>
                          <span className="text-xs text-muted-foreground">
                            Anyone in the target audience can join instantly.
                          </span>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-background p-4">
                        <Radio value="approval" />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold">Approval Required</span>
                          <span className="text-xs text-muted-foreground">
                            Manager or Admin approval required to join.
                          </span>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold">
                      <Users className="size-4" /> Target Audience
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Restrict to Departments ({form.restrict_departments.length || 'All'})
                        </label>
                        {form.restrict_departments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {form.restrict_departments.map((id) => {
                              const department = departments.find((entry) => entry.id === id)
                              return (
                                <span
                                  key={id}
                                  className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
                                >
                                  {department?.department ?? `#${id}`}
                                  <button
                                    type="button"
                                    aria-label="Remove department"
                                    onClick={() =>
                                      setField(
                                        'restrict_departments',
                                        form.restrict_departments.filter((entry) => entry !== id),
                                      )
                                    }
                                  >
                                    <X className="size-3" />
                                  </button>
                                </span>
                              )
                            })}
                          </div>
                        )}
                        <Select
                          options={departments
                            .filter((entry) => !form.restrict_departments.includes(entry.id))
                            .map((entry) => ({
                              label: entry.department,
                              value: String(entry.id),
                            }))}
                          value=""
                          onChange={(value) =>
                            setField('restrict_departments', [
                              ...form.restrict_departments,
                              Number(value),
                            ])
                          }
                          placeholder="All departments"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Restrict to Roles ({form.restrict_roles.length || 'All'})
                        </label>
                        {form.restrict_roles.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {form.restrict_roles.map((role) => (
                              <span
                                key={role}
                                className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
                              >
                                {role}
                                <button
                                  type="button"
                                  aria-label={`Remove ${role}`}
                                  onClick={() =>
                                    setField(
                                      'restrict_roles',
                                      form.restrict_roles.filter((entry) => entry !== role),
                                    )
                                  }
                                >
                                  <X className="size-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <Input
                          placeholder="Type a role and press Enter"
                          className="h-9"
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter') return
                            event.preventDefault()
                            const value = event.currentTarget.value.trim()
                            if (value && !form.restrict_roles.includes(value)) {
                              setField('restrict_roles', [...form.restrict_roles, value])
                              event.currentTarget.value = ''
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-border/40 pt-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold">
                      <CalendarIcon className="size-4" /> Availability Dates
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Available From
                        </label>
                        <Input
                          type="date"
                          className="h-9"
                          value={form.available_from}
                          onChange={(event) => setField('available_from', event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Available Until
                        </label>
                        <Input
                          type="date"
                          className="h-9"
                          value={form.available_until}
                          onChange={(event) => setField('available_until', event.target.value)}
                        />
                        <FieldError message={errors.available_until} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </>
            )}

            {/* Bottom action bar */}
            <div className="mt-auto flex items-center justify-between rounded-b-xl border-t border-border/40 bg-muted/10 p-6">
              <Button
                variant="outline"
                className="px-6 font-bold shadow-sm"
                disabled={step === 1 || saving}
                onClick={goBack}
              >
                Back
              </Button>
              <Button
                className="gap-2 px-8 font-bold shadow-sm"
                disabled={saving}
                onClick={() => (step === steps.length ? void handlePublish() : void goNext())}
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                {step === steps.length
                  ? 'Publish Course'
                  : `Continue to ${steps[step]?.label ?? 'Next Step'}`}
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Right rail */}
        <div className="flex w-full shrink-0 flex-col gap-6 xl:w-[340px]">
          <Card className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
            <CardHeader className="border-b border-border/40 bg-muted/10 px-5 pb-3 pt-5">
              <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <Search className="size-4" /> Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-5">
              <div className="flex aspect-[16/9] w-full items-center justify-center rounded-lg border border-border/60 bg-muted/50 shadow-inner">
                {preview.thumbnailName ? (
                  <span className="px-3 text-center text-xs font-semibold text-muted-foreground">
                    {preview.thumbnailName}
                  </span>
                ) : (
                  <ImageIcon className="size-10 text-muted-foreground/30" />
                )}
              </div>
              <div className="flex items-start justify-between gap-3">
                <h3 className="line-clamp-2 text-lg font-black leading-snug tracking-tight text-foreground">
                  {preview.title}
                </h3>
                <StatusBadge
                  variant={courseId ? 'pending' : 'default'}
                  className="shrink-0 text-[10px] font-black uppercase tracking-widest shadow-sm"
                >
                  {preview.status}
                </StatusBadge>
              </div>
              <div className="mt-1 flex flex-col gap-2.5 rounded-lg border border-border/40 bg-muted/30 p-3 text-sm">
                {[
                  ['Category', preview.category],
                  ['Type', preview.type],
                  ['Duration', preview.duration],
                  ['Language', preview.language],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="font-semibold text-muted-foreground">{label}</span>
                    <span className="max-w-[60%] truncate font-bold text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border/80 bg-card shadow-sm">
            <CardHeader className="border-b border-border/40 bg-muted/10 px-5 py-4">
              <CardTitle className="flex items-center justify-between text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <div className="flex items-center gap-2">
                  <PackageOpen className="size-4" /> Modules
                </div>
                <span className="flex size-6 items-center justify-center rounded-md border border-border bg-background text-xs font-black text-foreground shadow-sm">
                  {modules.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {modules.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-background px-4 py-6 text-center">
                  <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
                    <PackageOpen className="size-5 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm font-bold text-foreground">No modules yet.</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Configure in Step 2
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {modules.slice(0, 5).map((module) => (
                    <div key={module.id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {module.chapter_name}
                      </span>
                      <span className="shrink-0 text-[11px] font-bold text-muted-foreground">
                        {module.content?.length ?? 0}
                      </span>
                    </div>
                  ))}
                  <p className="mt-2 border-t border-border/40 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {contentCount} content item{contentCount === 1 ? '' : 's'} total
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border/80 bg-card shadow-sm">
            <CardHeader className="border-b border-border/40 bg-muted/10 px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <CheckCircle2 className="size-4" /> Checklist
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3.5 p-5">
              {checklist.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="group flex items-start gap-3 text-left"
                  onClick={() => goToStep(item.id)}
                >
                  <div className="mt-0.5">
                    {item.completed ? (
                      <CheckCircle2 className="size-4 text-success" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-sm font-bold transition-colors',
                      item.completed
                        ? 'text-muted-foreground line-through opacity-70'
                        : 'text-foreground',
                    )}
                  >
                    {item.label}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
