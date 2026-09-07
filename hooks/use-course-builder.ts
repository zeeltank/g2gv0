'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  lmsCatalogService,
  lmsCourseBuilderService,
  type AssessmentPayload,
  type BuilderAssessment,
  type BuilderCoursePayload,
  type PaperQuestion,
  type QuestionPayload,
  type BuilderModule,
  type CatalogDepartment,
  type CatalogJobRole,
  type ContentKind,
  type CourseSettings,
  type CoursePrerequisite,
  type CourseVisibility,
  type EnrollmentRule,
} from '@/services/lms'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/* ─── Form shape ───────────────────────────────────────────────────────────── */

/**
 * Every wizard field in one flat object.
 *
 * Numeric inputs are held as strings while editing so a half-typed value does
 * not get coerced to NaN, and are parsed only at submit.
 */
export interface CourseBuilderForm {
  // Step 1
  display_name: string
  subject_code: string
  description: string
  subject_type: string
  duration: string
  subject_category: string
  language: string
  is_mandatory: boolean
  discussion_enabled: boolean
  visibility: CourseVisibility
  standard_id: string
  jobrole: string
  thumbnail: File | null

  // Step 3
  passing_score: string
  max_attempts: string

  // Step 4
  issue_certificate: boolean
  certificate_template: string
  certificate_validity_months: string
  recert_alerts: boolean
  /** Passing this course writes the capability rating without a review step. */
  auto_apply_rating: boolean

  // Step 5
  enrollment_rule: EnrollmentRule
  restrict_departments: number[]
  restrict_roles: string[]
  available_from: string
  available_until: string
}

const EMPTY_FORM: CourseBuilderForm = {
  display_name: '',
  subject_code: '',
  description: '',
  subject_type: '',
  duration: '',
  subject_category: '',
  language: '',
  is_mandatory: false,
  discussion_enabled: false,
  visibility: 'all',
  standard_id: '',
  jobrole: '',
  thumbnail: null,
  passing_score: '',
  max_attempts: '',
  issue_certificate: true,
  certificate_template: '',
  certificate_validity_months: '',
  recert_alerts: false,
  auto_apply_rating: false,
  enrollment_rule: 'open',
  restrict_departments: [],
  restrict_roles: [],
  available_from: '',
  available_until: '',
}

export const BUILDER_STEPS = [
  { id: 1, label: 'Basic Information' },
  { id: 2, label: 'Content & Modules' },
  { id: 3, label: 'Assessments' },
  { id: 4, label: 'Certification' },
  { id: 5, label: 'Publish Settings' },
] as const

/** Field-level errors keyed by form field, mirroring Laravel's rules. */
export type BuilderErrors = Partial<Record<keyof CourseBuilderForm, string>>

/**
 * "HH:MM" or plain minutes to a minute count.
 *
 * The design labels the duration input HH:MM, but the column stores minutes.
 */
function parseDuration(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (trimmed.includes(':')) {
    const [hours, minutes] = trimmed.split(':').map((part) => Number(part))
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
    return hours * 60 + minutes
  }

  const minutes = Number(trimmed)
  return Number.isFinite(minutes) ? minutes : null
}

function formatDuration(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return ''
  const hours = Math.floor(minutes / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * The wizard form for a course that already exists.
 *
 * Everything the wizard edits lives in one of two places — a handful of
 * sub_std_map columns and one lms_course_settings row — and GET
 * /api/lms/courses/{id} returns both. Nothing here is guesswork; the only
 * shaping is the string-while-editing convention EMPTY_FORM already uses.
 *
 * `thumbnail` stays null: the stored image is a URL on the course row, and a
 * File input cannot be seeded from one. Leaving it null means "unchanged" —
 * saving an edit does not clear the existing cover.
 */
function formFromCourse(
  course: Record<string, unknown>,
  settings: CourseSettings | null,
): CourseBuilderForm {
  const text = (value: unknown) => (value === null || value === undefined ? '' : String(value))

  return {
    display_name: text(course.display_name),
    subject_code: text(course.subject_code),
    description: text(settings?.description),
    subject_type: text(course.subject_type),
    duration: formatDuration(settings?.duration_minutes ?? null),
    subject_category: text(course.subject_category),
    language: text(settings?.language),
    is_mandatory: Boolean(settings?.is_mandatory),
    discussion_enabled: Boolean(settings?.discussion_enabled),
    visibility: settings?.visibility ?? 'all',
    standard_id: text(course.standard_id),
    jobrole: text(course.jobrole),
    thumbnail: null,
    passing_score: text(settings?.passing_score),
    max_attempts: text(settings?.max_attempts),
    // A course with no settings row has never been through the wizard. Default
    // to issuing a certificate, matching EMPTY_FORM, rather than to `false` —
    // which would silently turn certification off on the first save.
    issue_certificate: settings ? Boolean(settings.issue_certificate) : true,
    certificate_template: text(settings?.certificate_template),
    certificate_validity_months: text(course.certificate_validity_months),
    recert_alerts: Boolean(settings?.recert_alerts),
    auto_apply_rating: Boolean(settings?.auto_apply_rating),
    enrollment_rule: settings?.enrollment_rule ?? 'open',
    restrict_departments: settings?.restrict_departments ?? [],
    restrict_roles: settings?.restrict_roles ?? [],
    // The API returns dates as 'YYYY-MM-DD' or a full timestamp; the date input
    // only accepts the first ten characters of either.
    available_from: text(settings?.available_from).slice(0, 10),
    available_until: text(settings?.available_until).slice(0, 10),
  }
}

/**
 * @param initialCourseId open an existing course instead of starting a new one.
 *   The builder was create-only: `save` branched on a courseId that nothing
 *   could ever set from the outside, so a course made in the catalogue — or by
 *   AI publish — could never be opened here, and since this wizard is the only
 *   writer of lms_course_settings, such a course could never acquire a passing
 *   score, an enrolment rule or a visibility restriction at all.
 */
export function useCourseBuilder(initialCourseId?: number | null) {
  const { user } = useAuth()
  const resolveContext = useCallback(() => getLaravelContext(user), [user])
  const profileName = user?.profileName

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<CourseBuilderForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<BuilderErrors>({})

  /** Set once the draft exists; steps 2 and 3 attach to it. */
  const [courseId, setCourseId] = useState<number | null>(initialCourseId ?? null)
  /** True while an existing course is being fetched, so the form is not shown empty. */
  const [loadingCourse, setLoadingCourse] = useState(Boolean(initialCourseId))
  /**
   * sub_std_map.status as last persisted — 0 draft, 1 published, null unsaved.
   * The preview called every saved course a "Draft", which is wrong the moment
   * the wizard can open a published one.
   */
  const [savedStatus, setSavedStatus] = useState<number | null>(null)
  const [prerequisites, setPrerequisites] = useState<CoursePrerequisite[]>([])

  const [modules, setModules] = useState<BuilderModule[]>([])
  const [assessments, setAssessments] = useState<BuilderAssessment[]>([])
  /**
   * The questions on ONE paper — whichever the author has open.
   *
   * Loaded per paper rather than for all of them at once: a course can carry
   * several quizzes, and only one is being edited at a time.
   */
  const [openPaperId, setOpenPaperId] = useState<number | null>(null)
  const [paperQuestions, setPaperQuestions] = useState<PaperQuestion[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(false)

  const [categories, setCategories] = useState<string[]>([])
  const [types, setTypes] = useState<string[]>([])
  const [departments, setDepartments] = useState<CatalogDepartment[]>([])
  // The organisation's real roles. The Job Role field used to be a bare text
  // input with no options at all.
  const [jobRoles, setJobRoles] = useState<CatalogJobRole[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [certificateTemplates, setCertificateTemplates] = useState<
    { value: string; label: string }[]
  >([])
  const [courseOptions, setCourseOptions] = useState<CoursePrerequisite[]>([])

  const [loadingOptions, setLoadingOptions] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const setField = useCallback(
    <K extends keyof CourseBuilderForm>(key: K, value: CourseBuilderForm[K]) => {
      setForm((current) => ({ ...current, [key]: value }))
      // Clear the field's error as soon as the user edits it.
      setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current))
    },
    [],
  )

  /* ── Reference data ── */

  const loadOptions = useCallback(async () => {
    const context = resolveContext()

    if (!isLaravelContextReady(context)) {
      setLoadingOptions(false)
      setError('Your session has expired. Sign in again to build a course.')
      return
    }

    setLoadingOptions(true)

    try {
      // Filter options give the real category/type/department values already in
      // use in this tenant, so the selects are never a hardcoded guess. The
      // course list feeds the prerequisite picker.
      const [filters, courses] = await Promise.all([
        lmsCatalogService.getFilterOptions(context),
        lmsCatalogService.getCourses(context, { perPage: 200, sortBy: 'title', sortDir: 'asc' }),
      ])

      setCategories(filters.data?.categories ?? [])
      setTypes(filters.data?.subject_types ?? [])
      setDepartments(filters.data?.departments ?? [])
      setJobRoles(filters.data?.job_roles ?? [])
      // Served from config('lms.*) rather than hardcoded in the component, so
      // adding a language or template is a server-side change only.
      setLanguages(filters.data?.languages ?? [])
      setCertificateTemplates(filters.data?.certificate_templates ?? [])
      setCourseOptions(
        (courses.data ?? []).map((course) => ({ id: course.id, title: course.display_name })),
      )
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the course options.'))
    } finally {
      setLoadingOptions(false)
    }
  }, [resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      void loadOptions()
    })
  }, [loadOptions])

  /* ── Validation, mirroring the Laravel rules ── */

  const validateStep = useCallback(
    (target: number): BuilderErrors => {
      const found: BuilderErrors = {}

      if (target === 1) {
        // required|string|max:191 on the controller.
        if (!form.display_name.trim()) found.display_name = 'Course title is required.'
        else if (form.display_name.length > 191) found.display_name = 'Keep the title under 191 characters.'

        // required|integer, and the controller checks the department exists.
        if (!form.standard_id) found.standard_id = 'Select a department.'

        if (form.description.length > 2000) found.description = 'Keep the description under 2000 characters.'

        if (form.duration.trim() && parseDuration(form.duration) === null) {
          found.duration = 'Use HH:MM, or a number of minutes.'
        }
      }

      if (target === 3) {
        const score = toNumberOrNull(form.passing_score)
        if (form.passing_score.trim() && (score === null || score < 0 || score > 100)) {
          found.passing_score = 'Passing score must be between 0 and 100.'
        }

        const attempts = toNumberOrNull(form.max_attempts)
        if (form.max_attempts.trim() && (attempts === null || attempts < 1 || attempts > 100)) {
          found.max_attempts = 'Attempts must be between 1 and 100.'
        }
      }

      if (target === 4) {
        const months = toNumberOrNull(form.certificate_validity_months)
        if (
          form.certificate_validity_months.trim() &&
          (months === null || months < 1 || months > 600)
        ) {
          found.certificate_validity_months = 'Validity must be between 1 and 600 months.'
        }
      }

      if (target === 5) {
        // after_or_equal:settings.available_from on the controller.
        if (
          form.available_from &&
          form.available_until &&
          form.available_until < form.available_from
        ) {
          found.available_until = 'The end date cannot be before the start date.'
        }
      }

      return found
    },
    [form],
  )

  /* ── Saving ── */

  const buildPayload = useCallback(
    (status: number): BuilderCoursePayload => ({
      display_name: form.display_name.trim(),
      standard_id: Number(form.standard_id),
      subject_category: form.subject_category || null,
      subject_code: form.subject_code || null,
      subject_type: form.subject_type || null,
      jobrole: form.jobrole || null,
      certificate_validity_months: toNumberOrNull(form.certificate_validity_months),
      status,
      settings: {
        description: form.description || null,
        duration_minutes: parseDuration(form.duration),
        language: form.language || null,
        is_mandatory: form.is_mandatory,
        discussion_enabled: form.discussion_enabled,
        visibility: form.visibility,
        passing_score: toNumberOrNull(form.passing_score),
        max_attempts: toNumberOrNull(form.max_attempts),
        issue_certificate: form.issue_certificate,
        certificate_template: form.certificate_template || null,
        recert_alerts: form.recert_alerts,
        auto_apply_rating: form.auto_apply_rating,
        enrollment_rule: form.enrollment_rule,
        restrict_departments: form.restrict_departments.length ? form.restrict_departments : null,
        restrict_roles: form.restrict_roles.length ? form.restrict_roles : null,
        available_from: form.available_from || null,
        available_until: form.available_until || null,
      },
      prerequisites: prerequisites.map((item) => item.id),
    }),
    [form, prerequisites],
  )

  /**
   * Create the draft on first save, update it after.
   *
   * The wizard must persist before step 2 because chapters attach to a
   * course_id that does not exist until the row does.
   */
  const save = useCallback(
    async (status: number, successMessage: string) => {
      const context = resolveContext()

      if (!isLaravelContextReady(context)) {
        const failure = 'Your session has expired. Sign in again to save.'
        setError(failure)
        return { ok: false, message: failure }
      }

      // Step 1 is the only step whose fields the course row itself requires,
      // so it is validated on every save regardless of which step is showing.
      const found = validateStep(1)
      if (Object.keys(found).length > 0) {
        setErrors(found)
        setStep(1)
        const failure = 'Check the highlighted fields on Basic Information.'
        setError(failure)
        return { ok: false, message: failure }
      }

      setSaving(true)
      setError(null)
      setMessage(null)

      try {
        const payload = buildPayload(status)

        /*
         * ── THE COVER IMAGE ON AN UPDATE ────────────────────────────────────
         *
         * `update()` is JSON and cannot carry a file, so a thumbnail chosen
         * after the first save was collected, previewed in the right rail, and
         * silently dropped — while the screen reported "Draft saved."
         *
         * The wizard auto-saves a draft the moment you leave step 1, so this
         * hit almost every author who set the image second, and every author
         * editing an existing course.
         *
         * Told, not swallowed. The course still saves; the message says the
         * image did not, and the catalogue's own form is where a cover can be
         * set (it hides the field in edit mode for exactly this reason).
         */
        const thumbnailDropped = Boolean(courseId && form.thumbnail)

        const response = courseId
          ? await lmsCourseBuilderService.update(context, courseId, payload, profileName)
          : form.thumbnail
            ? await lmsCourseBuilderService.createWithImage(
                context,
                payload,
                form.thumbnail,
                profileName,
              )
            : await lmsCourseBuilderService.create(context, payload, profileName)

        const savedId = response.course_id ?? courseId
        if (savedId) setCourseId(savedId)
        if (response.prerequisites) setPrerequisites(response.prerequisites)
        setSavedStatus(status)

        const finalMessage = thumbnailDropped
          ? `${successMessage} The cover image was not applied — a cover can only be set when the course is created.`
          : successMessage

        setMessage(finalMessage)
        return { ok: true, message: finalMessage, courseId: savedId }
      } catch (saveError) {
        const failure = toMessage(saveError, 'Failed to save the course.')
        setError(failure)
        return { ok: false, message: failure }
      } finally {
        setSaving(false)
      }
    },
    [resolveContext, validateStep, buildPayload, courseId, form.thumbnail, profileName],
  )

  const saveDraft = useCallback(() => save(0, 'Draft saved.'), [save])
  const publish = useCallback(() => save(1, 'Course published.'), [save])

  /* ── Modules and content ── */

  const reloadModules = useCallback(
    async (id: number) => {
      try {
        const response = await lmsCourseBuilderService.modules(resolveContext(), id)
        setModules(response.data?.chapters ?? [])
      } catch {
        setModules([])
      }
    },
    [resolveContext],
  )

  /** Shared wrapper for module/content/assessment writes. */
  /**
   * `success` may be null, in which case the operation's own returned string is
   * shown instead.
   *
   * Most writes have one honest outcome — "Module added." — and a fixed string
   * is right for them. Generation does not: "5 questions written, 2 discarded"
   * is a different fact from "5 questions written", and flattening both to
   * "Questions generated." would hide the discard from the person who then
   * ships the quiz.
   */
  const run = useCallback(
    async (
      operation: () => Promise<void | string>,
      success: string | null,
      fallback: string,
    ) => {
      setSaving(true)
      setError(null)
      setMessage(null)

      try {
        const returned = await operation()
        const outcome = success ?? (typeof returned === 'string' ? returned : 'Done.')
        setMessage(outcome)
        return { ok: true, message: outcome }
      } catch (writeError) {
        const failure = toMessage(writeError, fallback)
        setError(failure)
        return { ok: false, message: failure }
      } finally {
        setSaving(false)
      }
    },
    [],
  )

  const addModule = useCallback(
    (name: string) =>
      run(
        async () => {
          if (!courseId) throw new Error('Save the course before adding modules.')
          await lmsCourseBuilderService.createModule(
            resolveContext(),
            courseId,
            { chapter_name: name, sort_order: modules.length + 1 },
            profileName,
          )
          await reloadModules(courseId)
        },
        `"${name}" added.`,
        'Failed to add the module.',
      ),
    [run, resolveContext, courseId, modules.length, profileName, reloadModules],
  )

  const renameModule = useCallback(
    (moduleId: number, name: string) =>
      run(
        async () => {
          await lmsCourseBuilderService.updateModule(
            resolveContext(),
            moduleId,
            { chapter_name: name },
            profileName,
          )
          if (courseId) await reloadModules(courseId)
        },
        'Module renamed.',
        'Failed to rename the module.',
      ),
    [run, resolveContext, courseId, profileName, reloadModules],
  )

  const removeModule = useCallback(
    (moduleId: number) =>
      run(
        async () => {
          await lmsCourseBuilderService.deleteModule(resolveContext(), moduleId, profileName)
          if (courseId) await reloadModules(courseId)
        },
        'Module removed.',
        'Failed to remove the module.',
      ),
    [run, resolveContext, courseId, profileName, reloadModules],
  )

  /**
   * Upload a lesson file and hand back what the content row needs.
   *
   * Returns the url and the server-derived file_type rather than creating the
   * lesson: the author still names it, and a failed upload must not leave a
   * half-made lesson behind.
   */
  const uploadLessonFile = useCallback(
    async (file: File): Promise<{ ok: boolean; url?: string; fileType?: string; message: string }> => {
      const context = resolveContext()

      if (!isLaravelContextReady(context)) {
        return { ok: false, message: 'Your session has expired. Sign in again.' }
      }

      setSaving(true)
      setError(null)

      try {
        const response = await lmsCourseBuilderService.uploadContent(
          context,
          file,
          courseId ?? undefined,
        )

        return {
          ok: true,
          url: response.data?.url,
          fileType: response.data?.file_type,
          message: `\u201c${file.name}\u201d uploaded.`,
        }
      } catch (uploadError) {
        const failure = toMessage(uploadError, 'Failed to upload the file.')
        setError(failure)
        return { ok: false, message: failure }
      } finally {
        setSaving(false)
      }
    },
    [resolveContext, courseId],
  )

  const addContent = useCallback(
    (moduleId: number, kind: ContentKind, title: string, url: string) =>
      run(
        async () => {
          await lmsCourseBuilderService.createContent(
            resolveContext(),
            {
              chapter_id: moduleId,
              title,
              file_type: kind,
              /*
               * `filename` is the column the player reads first. The wizard
               * used to send only `url`, which the controller did not accept
               * and never wrote - so every lesson it created was stored with
               * BOTH media columns NULL and could not be opened. Sending
               * `filename` matches the other authoring surface, which has
               * always worked; `url` goes too, now that the server keeps it.
               */
              filename: url || null,
              url: url || null,
            },
            profileName,
          )
          if (courseId) await reloadModules(courseId)
        },
        `"${title}" added.`,
        'Failed to add the content item.',
      ),
    [run, resolveContext, courseId, profileName, reloadModules],
  )

  const removeContent = useCallback(
    (contentId: number) =>
      run(
        async () => {
          await lmsCourseBuilderService.deleteContent(resolveContext(), contentId, profileName)
          if (courseId) await reloadModules(courseId)
        },
        'Content removed.',
        'Failed to remove the content item.',
      ),
    [run, resolveContext, courseId, profileName, reloadModules],
  )

  /* ── Assessments ── */

  const reloadAssessments = useCallback(
    async (id: number) => {
      try {
        const response = await lmsCourseBuilderService.assessments(resolveContext(), id)
        setAssessments(response.data ?? [])
      } catch {
        setAssessments([])
      }
    },
    [resolveContext],
  )

  const addAssessment = useCallback(
    (payload: Omit<AssessmentPayload, 'course_id'>) =>
      run(
        async () => {
          if (!courseId) throw new Error('Save the course before adding assessments.')
          await lmsCourseBuilderService.createAssessment(
            resolveContext(),
            { ...payload, course_id: courseId },
            profileName,
          )
          await reloadAssessments(courseId)
        },
        `"${payload.paper_name}" added.`,
        'Failed to add the assessment.',
      ),
    [run, resolveContext, courseId, profileName, reloadAssessments],
  )

  const removeAssessment = useCallback(
    (id: number) =>
      run(
        async () => {
          await lmsCourseBuilderService.deleteAssessment(resolveContext(), id, profileName)
          if (courseId) await reloadAssessments(courseId)
        },
        'Assessment removed.',
        'Failed to remove the assessment.',
      ),
    [run, resolveContext, courseId, profileName, reloadAssessments],
  )

  /* ── Questions on a quiz ── */

  const reloadQuestions = useCallback(
    async (paperId: number) => {
      setQuestionsLoading(true)
      try {
        const response = await lmsCourseBuilderService.paperQuestions(resolveContext(), paperId)
        setPaperQuestions(response.data ?? [])
      } catch {
        setPaperQuestions([])
      } finally {
        setQuestionsLoading(false)
      }
    },
    [resolveContext],
  )

  /** Open a paper for question editing, or close the one that is open. */
  const openPaper = useCallback(
    (paperId: number | null) => {
      setOpenPaperId(paperId)
      setPaperQuestions([])
      if (paperId !== null) void reloadQuestions(paperId)
    },
    [reloadQuestions],
  )

  /**
   * Ask the AI to write this quiz from the course's content.
   *
   * Reports what actually happened rather than a flat "done": a run that wrote
   * three and discarded two has to say so, or the author trusts a quiz that is
   * shorter than they asked for.
   */
  const generateQuestions = useCallback(
    (paperId: number, count: number, formats: string[]) =>
      run(
        async () => {
          const response = await lmsCourseBuilderService.generateQuestions(
            resolveContext(),
            paperId,
            { count, formats },
            profileName,
          )
          await reloadQuestions(paperId)
          if (courseId) await reloadAssessments(courseId)
          return response.message
        },
        null,
        'The questions could not be generated.',
      ),
    [run, resolveContext, profileName, reloadQuestions, reloadAssessments, courseId],
  )

  const addQuestion = useCallback(
    (paperId: number, payload: QuestionPayload) =>
      run(
        async () => {
          await lmsCourseBuilderService.addQuestion(resolveContext(), paperId, payload, profileName)
          await reloadQuestions(paperId)
          // total_ques changed on the paper, so the list above it must agree.
          if (courseId) await reloadAssessments(courseId)
        },
        'Question added.',
        'Failed to add the question.',
      ),
    [run, resolveContext, profileName, reloadQuestions, reloadAssessments, courseId],
  )

  const updateQuestion = useCallback(
    (paperId: number, questionId: number, payload: QuestionPayload) =>
      run(
        async () => {
          await lmsCourseBuilderService.updateQuestion(
            resolveContext(), paperId, questionId, payload, profileName,
          )
          await reloadQuestions(paperId)
          if (courseId) await reloadAssessments(courseId)
        },
        'Question updated.',
        'Failed to update the question.',
      ),
    [run, resolveContext, profileName, reloadQuestions, reloadAssessments, courseId],
  )

  const removeQuestion = useCallback(
    (paperId: number, questionId: number) =>
      run(
        async () => {
          await lmsCourseBuilderService.deleteQuestion(
            resolveContext(), paperId, questionId, profileName,
          )
          await reloadQuestions(paperId)
          if (courseId) await reloadAssessments(courseId)
        },
        'Question removed.',
        'Failed to remove the question.',
      ),
    [run, resolveContext, profileName, reloadQuestions, reloadAssessments, courseId],
  )

  /**
   * Rename a quiz, or change its attempt limit.
   *
   * `updateAssessment` existed in the service with zero callers, so a quiz
   * could be created and deleted but never corrected — fixing a typo in its
   * name meant deleting it and every question inside.
   */
  const renameAssessment = useCallback(
    (id: number, payload: Omit<AssessmentPayload, 'course_id'>) =>
      run(
        async () => {
          if (!courseId) throw new Error('Save the course first.')
          await lmsCourseBuilderService.updateAssessment(
            resolveContext(), id, { ...payload, course_id: courseId }, profileName,
          )
          await reloadAssessments(courseId)
        },
        'Assessment updated.',
        'Failed to update the assessment.',
      ),
    [run, resolveContext, courseId, profileName, reloadAssessments],
  )

  /* ── Opening an existing course ── */

  /**
   * Hydrate the whole wizard from a saved course.
   *
   * One request for the course and its settings, then the module tree and the
   * assessment list — the same two calls step navigation already makes on
   * arrival, so an opened course looks exactly like one just authored.
   *
   * A failure here is fatal to the screen rather than cosmetic: an empty form
   * bearing an existing course's id would save as a blank overwrite. So the
   * error is surfaced and the form deliberately left untouched.
   */
  useEffect(() => {
    if (!initialCourseId) return

    let cancelled = false

    void (async () => {
      const context = resolveContext()

      if (!isLaravelContextReady(context)) {
        setLoadingCourse(false)
        setError('Your session has expired. Sign in again to edit this course.')
        return
      }

      try {
        const response = await lmsCourseBuilderService.load(context, initialCourseId)
        if (cancelled) return

        setForm(formFromCourse(response.data ?? {}, response.settings ?? null))
        setPrerequisites(response.prerequisites ?? [])
        setSavedStatus(Number(response.data?.status ?? 0))

        await Promise.all([
          reloadModules(initialCourseId),
          reloadAssessments(initialCourseId),
        ])
      } catch (loadError) {
        if (!cancelled) {
          setError(toMessage(loadError, 'Failed to open this course.'))
        }
      } finally {
        if (!cancelled) setLoadingCourse(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [initialCourseId, resolveContext, reloadModules, reloadAssessments])

  /* ── Step navigation ── */

  /**
   * Advance a step, saving first.
   *
   * Leaving step 1 persists the draft so the later steps have a course_id;
   * every later step saves too, so nothing is lost by navigating away.
   */
  const goNext = useCallback(async () => {
    const found = validateStep(step)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      setError('Check the highlighted fields before continuing.')
      return
    }

    const result = await save(0, 'Progress saved.')
    if (!result.ok) return

    const id = result.courseId
    if (id) {
      // Step 2 and 3 render server state, so fetch it as we arrive.
      if (step === 1) await reloadModules(id)
      if (step === 2) await reloadAssessments(id)
    }

    setStep((current) => Math.min(current + 1, BUILDER_STEPS.length))
  }, [validateStep, step, save, reloadModules, reloadAssessments])

  const goBack = useCallback(() => setStep((current) => Math.max(current - 1, 1)), [])

  const goToStep = useCallback((target: number) => {
    setStep(Math.min(Math.max(target, 1), BUILDER_STEPS.length))
  }, [])

  /* ── Derived: the right-rail panels ── */

  /** Live preview values, straight from the form rather than a placeholder. */
  const preview = useMemo(
    () => ({
      title: form.display_name.trim() || 'New Course Title',
      category: form.subject_category || '--',
      type: form.subject_type || '--',
      duration: form.duration.trim() || '--',
      language: form.language || '--',
      status: courseId ? (savedStatus === 1 ? 'Published' : 'Draft') : 'Unsaved',
      thumbnailName: form.thumbnail?.name ?? null,
    }),
    [form, courseId, savedStatus],
  )

  /** Checklist ticks reflect real saved state, not a hardcoded false. */
  const checklist = useMemo(
    () => [
      {
        id: 1,
        label: 'Basic information',
        completed: Boolean(form.display_name.trim() && form.standard_id),
      },
      { id: 2, label: 'Add content modules', completed: modules.length > 0 },
      { id: 3, label: 'Add assessments', completed: assessments.length > 0 },
      { id: 4, label: 'Configure certification', completed: !form.issue_certificate || Boolean(form.certificate_template) },
      {
        id: 5,
        label: 'Publish settings',
        /*
         * `available_from` is OPTIONAL — a course with no availability window
         * is open immediately, which is the normal case. Requiring it here
         * meant this item could never tick, so the checklist showed a course
         * as incomplete after it had been published.
         */
        completed: Boolean(form.enrollment_rule),
      },
    ],
    [form, modules.length, assessments.length],
  )

  const contentCount = useMemo(
    () => modules.reduce((total, module) => total + (module.content?.length ?? 0), 0),
    [modules],
  )

  return {
    step,
    steps: BUILDER_STEPS,
    goNext,
    goBack,
    goToStep,

    form,
    setField,
    errors,

    courseId,
    prerequisites,
    setPrerequisites,
    courseOptions,

    modules,
    contentCount,
    addModule,
    renameModule,
    removeModule,
    addContent,
    uploadLessonFile,
    /** Refetch the module tree - used after Build-with-AI publishes. */
    reloadModules,
    removeContent,

    assessments,
    addAssessment,
    removeAssessment,
    renameAssessment,

    openPaperId,
    openPaper,
    paperQuestions,
    questionsLoading,
    generateQuestions,
    addQuestion,
    updateQuestion,
    removeQuestion,

    categories,
    types,
    departments,
    jobRoles,
    languages,
    certificateTemplates,

    /** The caller's profile, for children that make their own writes. */
    profileName,

    loadingOptions,
    loadingCourse,
    /** True when the wizard is editing a course that already existed. */
    isEditing: Boolean(initialCourseId),
    saving,
    message,
    error,
    dismiss: () => {
      setMessage(null)
      setError(null)
    },

    saveDraft,
    publish,

    preview,
    checklist,
    formatDuration,
  }
}

export type CourseBuilderState = ReturnType<typeof useCourseBuilder>
export type { CourseSettings }
