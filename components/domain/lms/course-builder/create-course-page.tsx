'use client'

import React, { useState } from 'react'
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  FileBox,
  FileText,
  Globe,
  Image as ImageIcon,
  Loader2,
  PackageOpen,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { CourseAudiencePanel } from './course-audience-panel'
import { AiCourseSheet } from '@/domain/lms/catalog/ai-course-sheet'
import { MultiSelect } from '@/domain/lms/shared/multi-select'

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

/*
 * The types the player can actually render.
 *
 * This offered Video / Document / SCORM / Live Session, and the player knew
 * none of them but Video — the other three fell through to "unknown", so
 * three lesson types in four could not be opened.
 *
 * SCORM and Live Session are gone rather than renamed: nothing in this stack
 * can play SCORM, and a live session is a lms_virtual_classroom row scheduled
 * alongside a course, not a lesson inside one. Slides and documents are new,
 * and render in place through the Office viewer.
 */
const CONTENT_KINDS: { kind: ContentKind; label: string; icon: typeof Video }[] = [
  { kind: 'mp4', label: 'Video', icon: Video },
  { kind: 'pdf', label: 'PDF', icon: FileText },
  { kind: 'pptx', label: 'Slides', icon: PackageOpen },
  { kind: 'docx', label: 'Document', icon: FileBox },
  { kind: 'jpg', label: 'Image', icon: ImageIcon },
  { kind: 'link', label: 'External link', icon: Globe },
]

/*
 * The server accepts 1-600 months (`certificate_validity_months`), and the
 * catalogue's own course form already exposes the full range. Offering four
 * fixed choices here meant the two authoring surfaces disagreed about what a
 * course could express, and a five-year certification simply could not be
 * entered in the wizard.
 */
const VALIDITY_OPTIONS = [
  { label: 'Never expires', value: '' },
  { label: '6 months', value: '6' },
  { label: '1 year', value: '12' },
  { label: '2 years', value: '24' },
  { label: '3 years', value: '36' },
  { label: '5 years', value: '60' },
  { label: '10 years', value: '120' },
]

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export function CreateCoursePage() {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()

  /*
   * ?course_id=N opens an existing course for editing.
   *
   * A query parameter rather than a route segment because this screen is
   * mounted through the access-link content map, not by a Next route with
   * params — the map keys on the path alone, so a /course-builder/123 segment
   * would resolve to no component at all.
   */
  const searchParams = useSearchParams()
  const requestedId = Number(searchParams.get('course_id'))
  const editingId = Number.isInteger(requestedId) && requestedId > 0 ? requestedId : null

  const builder = useCourseBuilder(editingId)
  const {
    step, steps, goNext, goBack, goToStep,
    form, setField, errors,
    courseId, prerequisites, setPrerequisites, courseOptions,
    modules, contentCount, addModule, renameModule, removeModule, addContent, uploadLessonFile, reloadModules, removeContent,
    assessments, addAssessment, removeAssessment, renameAssessment,
    openPaperId, openPaper, paperQuestions, questionsLoading,
    addQuestion, updateQuestion, removeQuestion, generateQuestions,
    categories, types, departments, jobRoles, languages, certificateTemplates,
    loadingOptions, loadingCourse, isEditing, saving, message, error, dismiss,
    saveDraft, publish,
    preview, checklist,
  } = builder

  // Small local composers — these hold what the user is typing before it is
  // committed to the server, so they belong here rather than in the hook.
  const [newModuleName, setNewModuleName] = useState('')
  /**
   * The lesson being added.
   *
   * `source` is new: a lesson could only ever be a pasted URL, so an author
   * with a file on their laptop had no way to make one. For slides there is a
   * third way — generate the deck with AI — which is the same Build-with-AI
   * flow the catalogue offers, reached from the point where you actually want a
   * deck.
   */
  const [contentDraft, setContentDraft] = useState<{
    moduleId: number
    kind: ContentKind
    title: string
    url: string
    source: 'link' | 'upload' | 'ai'
    uploadedName?: string
  } | null>(null)
  /** Opens the Build-with-AI sheet from step 2's slide option. */
  const [aiOpen, setAiOpen] = useState(false)
  const [quizName, setQuizName] = useState('')
  /** Which module is being renamed inline, and the text so far. */
  const [renamingModuleId, setRenamingModuleId] = useState<number | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  /**
   * The question being written or edited.
   *
   * `id` null means new. `options` empty means a WRITTEN answer — the server
   * treats that as the discriminator, and refuses options with none correct,
   * because that combination can never be marked by anything.
   */
  const [questionDraft, setQuestionDraft] = useState<{
    id: number | null
    question_title: string
    points: string
    options: { answer: string; correct: boolean }[]
  } | null>(null)
  /**
   * How many capabilities this course is mapped to, reported by the panel.
   *
   * Only used to warn that "update capability records on a pass" is on for a
   * course that develops nothing — a setting that would look active and move
   * nobody.
   */
  const [competencyCount, setCompetencyCount] = useState(0)

  /*
   * Hold the wizard back until the course is in hand.
   *
   * Rendering the form first would show every field empty over an existing
   * course's id, and "Save as Draft" from that state is a blank overwrite of a
   * real course — the one failure on this screen that destroys work.
   *
   * ── THIS RETURN MUST STAY BELOW EVERY HOOK ──────────────────────────────
   *
   * It was above the three useState calls, which is a hooks-order violation:
   * the loading render ran N hooks and the resolved render ran N+3, so React
   * threw "Rendered more hooks than during the previous render" and the screen
   * went blank. It only fired when a course was actually being loaded — the
   * create path has loadingCourse false from the start — so the whole
   * edit-an-existing-course flow was unusable while creation looked fine.
   *
   * Neither `tsc` nor `next build` can see this. Only running it can.
   */
  if (loadingCourse) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 py-24">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted-foreground">Opening course…</p>
      </div>
    )
  }

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
              {/* An opened course is not a draft — it may well be published. */}
              {isEditing
                ? `${form.display_name.trim() || 'Course'} #${courseId}`
                : courseId
                  ? `Draft #${courseId}`
                  : 'Create New Course'}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isEditing ? 'Edit Course' : 'Course Builder'}
          </h1>
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

                    {/*
                      * ── OWNING DEPARTMENT, NOT AUDIENCE ──────────────────
                      *
                      * This field and the department picker in Publish Settings
                      * looked like the same question asked twice, which is why
                      * they read as a duplication. They are not the same:
                      *
                      *   here          which department the course BELONGS to.
                      *                 One value, because sub_std_map.standard_id
                      *                 is a single foreign key, and it is half
                      *                 of the duplicate-course check.
                      *   Publish step  which departments may SEE it. Several,
                      *                 stored as a list.
                      *
                      * Relabelled rather than merged, and the job-role picker
                      * has moved to Publish Settings where the rest of the
                      * audience lives.
                      */}
                    <div className="space-y-2 md:col-span-2">
                      <label className="flex gap-1 text-sm font-bold text-foreground">
                        Owning department <span className="text-destructive">*</span>
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
                      <p className="text-xs text-muted-foreground">
                        Which department the course belongs to. Who can see and take it is set in
                        Publish Settings.
                      </p>
                      <FieldError message={errors.standard_id} />
                    </div>
                  </div>

                  {/*
                    * MANDATORY, DISCUSSION AND VISIBILITY MOVED TO PUBLISH
                    * SETTINGS.
                    *
                    * They are not basic information about the course - they are
                    * decisions about how it is released, which is what that step
                    * is for. Keeping them here alongside a second, different
                    * department picker is what made the two steps read as
                    * duplicates of each other.
                    */}
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
                            {/*
                              * Renaming was implemented in the hook and
                              * surfaced nowhere, so fixing a typo in a module
                              * name meant deleting it — and every lesson
                              * inside it — and rebuilding. Click to rename.
                              */}
                            {renamingModuleId === module.id ? (
                              <Input
                                autoFocus
                                className="h-7 text-sm font-bold"
                                value={renameDraft}
                                onChange={(event) => setRenameDraft(event.target.value)}
                                onBlur={() => setRenamingModuleId(null)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Escape') setRenamingModuleId(null)
                                  if (event.key === 'Enter' && renameDraft.trim()) {
                                    void renameModule(module.id, renameDraft.trim()).then(() =>
                                      setRenamingModuleId(null),
                                    )
                                  }
                                }}
                              />
                            ) : (
                              <button
                                type="button"
                                className="w-fit text-left text-sm font-bold text-foreground hover:underline"
                                title="Rename this module"
                                onClick={() => {
                                  setRenameDraft(module.chapter_name)
                                  setRenamingModuleId(module.id)
                                }}
                              >
                                {module.chapter_name}
                              </button>
                            )}
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
                              {/*
                                * WHERE THE MATERIAL COMES FROM.
                                *
                                * This was one text box labelled "URL or file
                                * reference", and a file reference was never
                                * supported — course-authoring.tsx even said
                                * "Uploads are handled by the content library",
                                * which does not exist. So the only working
                                * option was a publicly reachable link, and
                                * anything behind a login rendered as a broken
                                * frame for every learner.
                                */}
                              <div className="flex flex-wrap gap-1.5">
                                {(
                                  [
                                    { key: 'link', label: 'Link' },
                                    { key: 'upload', label: 'Upload' },
                                    // Only slides can be generated: Gamma makes
                                    // decks, not videos or PDFs, and offering
                                    // it elsewhere would promise something that
                                    // cannot be delivered.
                                    ...(contentDraft.kind === 'pptx'
                                      ? [{ key: 'ai' as const, label: 'Generate with AI' }]
                                      : []),
                                  ] as { key: 'link' | 'upload' | 'ai'; label: string }[]
                                ).map(({ key, label }) => (
                                  <Button
                                    key={key}
                                    size="sm"
                                    variant={contentDraft.source === key ? 'default' : 'outline'}
                                    className="h-7 text-xs font-semibold"
                                    onClick={() => {
                                      if (key === 'ai') {
                                        // The same form the catalogue opens.
                                        // The deck it publishes becomes a
                                        // course of its own, which the author
                                        // can then link here.
                                        setAiOpen(true)
                                        return
                                      }
                                      setContentDraft({ ...contentDraft, source: key, url: '' })
                                    }}
                                  >
                                    {key === 'ai' && <Sparkles className="mr-1 size-3" />}
                                    {label}
                                  </Button>
                                ))}
                              </div>

                              {contentDraft.source === 'upload' ? (
                                <div className="flex flex-col gap-1.5">
                                  <input
                                    type="file"
                                    className="text-xs file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-semibold"
                                    accept=".mp4,.webm,.mov,.pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
                                    onChange={(event) => {
                                      const file = event.target.files?.[0]
                                      if (!file) return
                                      void uploadLessonFile(file).then((result) => {
                                        if (result.ok && result.url) {
                                          setContentDraft((current) =>
                                            current
                                              ? {
                                                  ...current,
                                                  url: result.url as string,
                                                  uploadedName: file.name,
                                                  // Take the server's word for
                                                  // the type: it derives it from
                                                  // the real extension, and the
                                                  // player switches on it.
                                                  title: current.title || file.name,
                                                }
                                              : current,
                                          )
                                        }
                                      })
                                    }}
                                  />
                                  {contentDraft.url && contentDraft.uploadedName && (
                                    <p className="text-xs font-medium text-success">
                                      Uploaded {contentDraft.uploadedName} — learners will open it
                                      inside the course.
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <Input
                                  placeholder="Paste a publicly reachable URL"
                                  className="h-9 bg-background"
                                  value={contentDraft.url}
                                  onChange={(event) =>
                                    setContentDraft({ ...contentDraft, url: event.target.value })
                                  }
                                />
                              )}
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
                                        source: 'link',
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
                      {assessments.map((assessment) => {
                        const open = openPaperId === assessment.id

                        return (
                          <div key={assessment.id} className="flex flex-col">
                            <div className="flex items-center gap-3 p-3">
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
                                {/*
                                  * Say it plainly. A quiz with no questions
                                  * cannot be sat, and the quiz panel on the
                                  * learner side will have nothing to show —
                                  * which was the state of EVERY quiz authored
                                  * through this product until now.
                                  */}
                                {assessment.total_ques === 0 && (
                                  <span className="mt-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                    No questions yet — learners cannot sit this quiz.
                                  </span>
                                )}
                              </div>
                              <Button
                                variant={open ? 'default' : 'outline'}
                                size="sm"
                                className="shrink-0 gap-1.5 font-semibold"
                                onClick={() => {
                                  setQuestionDraft(null)
                                  openPaper(open ? null : assessment.id)
                                }}
                              >
                                <FileText className="size-3.5" />
                                {open ? 'Done' : 'Questions'}
                              </Button>
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

                            {open && (
                              <div className="flex flex-col gap-3 border-t border-border/40 bg-muted/20 p-3">
                                {questionsLoading ? (
                                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Loader2 className="size-3.5 animate-spin" /> Loading questions…
                                  </p>
                                ) : paperQuestions.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">
                                    No questions yet. Add the first one below.
                                  </p>
                                ) : (
                                  <ol className="flex flex-col gap-2">
                                    {paperQuestions.map((question, index) => (
                                      <li
                                        key={question.id}
                                        className="flex items-start gap-2 rounded-md border border-border/60 bg-background p-2.5"
                                      >
                                        <span className="mt-0.5 text-xs font-bold text-muted-foreground">
                                          {index + 1}.
                                        </span>
                                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                                          <span className="text-sm font-semibold text-foreground">
                                            {question.question_title}
                                          </span>
                                          <span className="text-[11px] text-muted-foreground">
                                            {question.points}{' '}
                                            {question.points === 1 ? 'mark' : 'marks'} {'·'}{' '}
                                            {question.options.length === 0
                                              ? 'written answer'
                                              : `${question.options.length} options`}
                                          </span>
                                          {question.options.length > 0 && (
                                            <div className="flex flex-col gap-0.5">
                                              {question.options.map((option) => (
                                                <span
                                                  key={option.id}
                                                  className={cn(
                                                    'text-[11px]',
                                                    option.correct
                                                      ? 'font-bold text-emerald-600 dark:text-emerald-400'
                                                      : 'text-muted-foreground',
                                                  )}
                                                >
                                                  {option.correct ? '✓ ' : '· '}
                                                  {option.answer}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          aria-label={`Edit question ${index + 1}`}
                                          className="size-7 text-muted-foreground"
                                          onClick={() =>
                                            setQuestionDraft({
                                              id: question.id,
                                              question_title: question.question_title ?? '',
                                              points: String(question.points),
                                              options: question.options.map((o) => ({
                                                answer: o.answer,
                                                correct: o.correct,
                                              })),
                                            })
                                          }
                                        >
                                          <FileText className="size-3.5" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          aria-label={`Remove question ${index + 1}`}
                                          className="size-7 text-muted-foreground hover:text-destructive"
                                          disabled={saving}
                                          onClick={() =>
                                            void removeQuestion(assessment.id, question.id)
                                          }
                                        >
                                          <Trash2 className="size-3.5" />
                                        </Button>
                                      </li>
                                    ))}
                                  </ol>
                                )}

                                {questionDraft === null ? (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-fit gap-2 font-semibold"
                                      onClick={() =>
                                        setQuestionDraft({
                                          id: null,
                                          question_title: '',
                                          points: '1',
                                          // Two blank options is the shape most
                                          // authors want; clearing both makes it
                                          // a written answer instead.
                                          options: [
                                            { answer: '', correct: true },
                                            { answer: '', correct: false },
                                          ],
                                        })
                                      }
                                    >
                                      <Plus className="size-4" /> Add question
                                    </Button>

                                    {/*
                                      * ── WRITE THE QUIZ FROM THE COURSE ────
                                      *
                                      * Nothing generated questions for a course
                                      * quiz before this. The three AI question
                                      * generators the product has are all
                                      * job-role shaped and cannot be pointed at
                                      * a course, so "generate a quiz for this
                                      * course" had no data route at all — every
                                      * quiz in the product was typed by hand,
                                      * one question at a time.
                                      *
                                      * The model is given this course's own
                                      * modules and lesson text as the source,
                                      * and the capabilities it is mapped to as
                                      * the target, so each question can name the
                                      * capability it tests — which is what lets
                                      * passing move that capability.
                                      */}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-fit gap-2 font-semibold"
                                      disabled={saving}
                                      onClick={() => {
                                        void generateQuestions(assessment.id, 5, ['mcq'])
                                      }}
                                    >
                                      <Sparkles className="size-4" /> Write 5 with AI
                                    </Button>

                                    <span className="text-xs text-muted-foreground">
                                      {modules.length === 0
                                        ? 'Add modules in step 2 first — questions are written from the course content.'
                                        : competencyCount === 0
                                          ? 'Questions come from this course’s lessons. Map a capability below to have them measure one.'
                                          : 'Questions are written from this course’s lessons and tied to the capabilities above.'}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-background p-3">
                                    <Textarea
                                      rows={2}
                                      placeholder="Question"
                                      value={questionDraft.question_title}
                                      onChange={(event) =>
                                        setQuestionDraft({
                                          ...questionDraft,
                                          question_title: event.target.value,
                                        })
                                      }
                                    />

                                    <div className="flex flex-wrap items-center gap-2">
                                      <label className="text-xs font-bold text-foreground">
                                        Marks
                                      </label>
                                      <Input
                                        type="number"
                                        min={1}
                                        className="h-8 w-20"
                                        value={questionDraft.points}
                                        onChange={(event) =>
                                          setQuestionDraft({
                                            ...questionDraft,
                                            points: event.target.value,
                                          })
                                        }
                                      />
                                      <span className="text-[11px] text-muted-foreground">
                                        {questionDraft.options.length === 0
                                          ? 'Written answer — marked by AI, held for a person when it cannot be.'
                                          : 'Tick every option that is correct.'}
                                      </span>
                                    </div>

                                    {questionDraft.options.map((option, index) => (
                                      <div key={index} className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          className="size-4 shrink-0"
                                          checked={option.correct}
                                          aria-label={`Option ${index + 1} is correct`}
                                          onChange={(event) =>
                                            setQuestionDraft({
                                              ...questionDraft,
                                              options: questionDraft.options.map((o, i) =>
                                                i === index
                                                  ? { ...o, correct: event.target.checked }
                                                  : o,
                                              ),
                                            })
                                          }
                                        />
                                        <Input
                                          className="h-8"
                                          placeholder={`Option ${index + 1}`}
                                          value={option.answer}
                                          onChange={(event) =>
                                            setQuestionDraft({
                                              ...questionDraft,
                                              options: questionDraft.options.map((o, i) =>
                                                i === index
                                                  ? { ...o, answer: event.target.value }
                                                  : o,
                                              ),
                                            })
                                          }
                                        />
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          aria-label={`Remove option ${index + 1}`}
                                          className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                                          onClick={() =>
                                            setQuestionDraft({
                                              ...questionDraft,
                                              options: questionDraft.options.filter(
                                                (_, i) => i !== index,
                                              ),
                                            })
                                          }
                                        >
                                          <X className="size-3.5" />
                                        </Button>
                                      </div>
                                    ))}

                                    <div className="flex flex-wrap items-center gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1.5"
                                        onClick={() =>
                                          setQuestionDraft({
                                            ...questionDraft,
                                            options: [
                                              ...questionDraft.options,
                                              { answer: '', correct: false },
                                            ],
                                          })
                                        }
                                      >
                                        <Plus className="size-3.5" /> Option
                                      </Button>

                                      <Button
                                        size="sm"
                                        className="gap-1.5 font-semibold"
                                        disabled={saving || !questionDraft.question_title.trim()}
                                        onClick={() => {
                                          const payload = {
                                            question_title: questionDraft.question_title.trim(),
                                            points: Number(questionDraft.points) || 1,
                                            // Blank options are dropped rather
                                            // than sent: an author who cleared
                                            // them meant a written answer.
                                            options: questionDraft.options
                                              .filter((o) => o.answer.trim())
                                              .map((o) => ({
                                                answer: o.answer.trim(),
                                                correct: o.correct,
                                              })),
                                          }

                                          const action =
                                            questionDraft.id === null
                                              ? addQuestion(assessment.id, payload)
                                              : updateQuestion(
                                                  assessment.id,
                                                  questionDraft.id,
                                                  payload,
                                                )

                                          void action.then((result) => {
                                            if (result.ok) setQuestionDraft(null)
                                          })
                                        }}
                                      >
                                        {saving && <Loader2 className="size-3.5 animate-spin" />}
                                        {questionDraft.id === null
                                          ? 'Add question'
                                          : 'Save changes'}
                                      </Button>

                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setQuestionDraft(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
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

                    {/*
                      * ── WHAT THIS COURSE BUILDS ─────────────────────────────
                      *
                      * CourseCompetencyInlinePanel was imported by this file and
                      * never rendered, so the primary authoring flow could not
                      * map a course to a capability at all — only the
                      * catalogue's edit sheet could, after the fact. That made
                      * two things impossible: a pass could not move any rating
                      * (there was nothing to move), and the course could not be
                      * suggested to anyone with a matching gap, which is exactly
                      * what the edit sheet's own label promises this mapping
                      * does.
                      *
                      * It sits here rather than in Publish Settings because the
                      * setting directly beneath it is meaningless without it.
                      */}
                    <div className="space-y-2 border-t border-border/40 pt-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Capabilities this course builds
                      </h4>
                      <CourseCompetencyInlinePanel
                        courseId={courseId}
                        onCountChange={setCompetencyCount}
                      />
                    </div>

                    {/*
                      * ── WHAT PASSING ACTUALLY DOES ──────────────────────────
                      *
                      * The column behind this has existed since 2026-09-05 and
                      * had no writer anyone could reach: only an artisan seeder
                      * ever set it, so the quiz -> capability loop was off for
                      * every course in the product and no author could turn it
                      * on. This is that switch.
                      *
                      * Off by default, and it says what it does rather than
                      * naming the flag: an admin deciding this needs to know a
                      * record changes without them, not what the column is
                      * called.
                      */}
                    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/10 p-4">
                      <Checkbox
                        id="auto-apply-rating"
                        className="mt-0.5"
                        checked={form.auto_apply_rating}
                        onCheckedChange={(checked) =>
                          setField('auto_apply_rating', Boolean(checked))
                        }
                      />
                      <div className="flex flex-col gap-0.5">
                        <label
                          htmlFor="auto-apply-rating"
                          className="cursor-pointer text-sm font-bold text-foreground"
                        >
                          Update capability records when a learner passes
                        </label>
                        <span className="text-xs leading-snug text-muted-foreground">
                          A passing score raises the learner&rsquo;s rating on the capabilities this
                          course is mapped to, closing their gap without waiting for a review. Every
                          change is recorded with the attempt that caused it. A rating an assessor
                          set by hand is never overwritten, and a result that would <em>lower</em>{' '}
                          someone still goes to review.
                        </span>
                        {form.auto_apply_rating && competencyCount === 0 && (
                          <span className="mt-1 text-xs font-medium text-warning">
                            This course isn&rsquo;t mapped to any capability yet, so passing it will
                            not move anything. Map one in Publish Settings.
                          </span>
                        )}
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

                  {/*
                    ASSIGNING IS NOT RESTRICTING.
                    The block below controls who MAY enrol themselves. This one
                    hands the course to people directly. They were conflated
                    before — there was no way to assign from the create flow at
                    all, so "restrict to Nursing" was mistaken for "give it to
                    Nursing", which it never did.
                  */}
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold">
                      <Users className="size-4" /> Assign this course
                    </h3>
                    <p className="-mt-2 text-xs text-muted-foreground">
                      Hands the course to people now. They will see it in My Learning.
                    </p>
                    <CourseAudiencePanel
                      courseId={courseId}
                      // Every other write in this wizard passes the caller's
                      // profile; this one did not, so assignAudience went out
                      // unauthenticated on the profile gate.
                      profileName={builder.profileName}
                      departments={departments}
                      jobRoles={jobRoles}
                    />
                  </div>

                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold">
                      <Users className="size-4" /> Who may enrol themselves
                    </h3>
                    <p className="-mt-2 text-xs text-muted-foreground">
                      Only applies when visibility is set to Restricted. Does not assign anyone.
                    </p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Restrict to departments ({form.restrict_departments.length || 'All'})
                        </label>
                        {/*
                          * Was a chip list plus a Select that appended one at a
                          * time, with no search - unusable against a real role
                          * list. One control now, searchable, with the chips
                          * inside it.
                          */}
                        <MultiSelect
                          aria-label="Restrict to departments"
                          options={departments.map((entry) => ({
                            value: String(entry.id),
                            label: entry.department,
                          }))}
                          values={form.restrict_departments.map(String)}
                          onChange={(values) =>
                            setField('restrict_departments', values.map(Number).filter(Boolean))
                          }
                          placeholder="All departments"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Restrict to job roles ({form.restrict_roles.length || 'All'})
                        </label>
                        <MultiSelect
                          aria-label="Restrict to job roles"
                          options={jobRoles.map((role) => ({
                            value: role.jobrole,
                            label: role.jobrole,
                            hint: departments.find((d) => d.id === role.department_id)?.department,
                          }))}
                          values={form.restrict_roles}
                          onChange={(values) => setField('restrict_roles', values)}
                          placeholder="All job roles"
                        />
                      </div>
                    </div>
                  </div>

                  {/*
                    * ── MOVED HERE FROM BASIC INFORMATION ──────────────────
                    *
                    * These are decisions about how the course is RELEASED, not
                    * facts about the course, so they belong with the rest of the
                    * publish settings. Sitting in step 1 beside a second,
                    * different department picker is what made the two steps read
                    * as duplicates.
                    *
                    * The descriptions say what each actually does. "Mandatory
                    * Course - automatically assign and enforce completion rules"
                    * described behaviour the flag does not have: nothing reads
                    * is_mandatory to assign anybody.
                    */}
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold">
                      <CheckCircle2 className="size-4" /> How this course behaves
                    </h3>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/10 p-4">
                        <Checkbox
                          id="mandatory"
                          className="mt-0.5"
                          checked={form.is_mandatory}
                          onCheckedChange={(checked) => setField('is_mandatory', Boolean(checked))}
                        />
                        <div className="flex flex-col gap-0.5">
                          <label htmlFor="mandatory" className="cursor-pointer text-sm font-bold text-foreground">
                            Required training
                          </label>
                          <span className="text-xs leading-snug text-muted-foreground">
                            Marks the course as required rather than optional, so it is flagged as
                            such wherever it is listed. It does not assign anyone on its own — use
                            &ldquo;Assign this course&rdquo; above for that.
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/10 p-4">
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
                            Allow questions
                          </label>
                          <span className="text-xs leading-snug text-muted-foreground">
                            Adds a Discussions tab inside the course where learners can ask
                            questions and an administrator can answer them.
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/10 p-4 md:col-span-2">
                        <span className="text-sm font-bold text-foreground">Who can see it</span>
                        <RadioGroup
                          value={form.visibility}
                          onValueChange={(value) => setField('visibility', value as CourseVisibility)}
                          className="flex items-center gap-4"
                        >
                          <Radio value="all" label="Anyone in the organisation" size="sm" />
                          <Radio value="restricted" label="Only the departments and roles above" size="sm" />
                        </RadioGroup>
                        <span className="text-xs text-muted-foreground">
                          The restrictions above only take effect when this is set to restricted.
                        </span>
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

      {/*
        * The SAME Build-with-AI form the catalogue opens.
        *
        * Reached from the slide option in step 2, which is the point at which
        * an author actually wants a deck. It publishes a course of its own with
        * the generated presentation attached as a pptx lesson, so the author
        * can link it here or send learners straight to it.
        */}
      <AiCourseSheet
        open={aiOpen}
        onOpenChange={setAiOpen}
        filterOptions={null}
        onPublished={() => {
          setAiOpen(false)
          if (courseId) void reloadModules(courseId)
        }}
      />
    </div>
  )
}
