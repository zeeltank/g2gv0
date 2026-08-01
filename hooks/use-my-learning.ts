'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  lmsCertificateService,
  lmsDiscussionService,
  lmsLearningService,
  type ContentStatus,
  type Discussion,
  type LearningCertificate,
  type CreateNotePayload,
  type LearningAssessment,
  type LearningContent,
  type LearningCourseDetail,
  type LearningCourseSummary,
  type LearningNote,
} from '@/services/lms'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function useLaravelContext() {
  const { user } = useAuth()
  return useCallback(() => getLaravelContext(user), [user])
}

/** How often the open lesson reports elapsed study time, in seconds. */
const HEARTBEAT_SECONDS = 30

/** A lesson flattened out of its chapter, with its position in the whole course. */
export interface FlatLesson extends LearningContent {
  chapterId: number
  chapterName: string
  index: number
}

export interface MyLearningState {
  /* Course picker */
  courses: LearningCourseSummary[]
  coursesLoading: boolean
  coursesError: string | null

  /* Selected course */
  courseId: number | null
  selectCourse: (id: number | null) => void
  detail: LearningCourseDetail | null
  detailLoading: boolean
  detailError: string | null
  reload: () => void

  /* Lesson navigation */
  lessons: FlatLesson[]
  currentLesson: FlatLesson | null
  selectLesson: (contentId: number) => void
  goNext: () => void
  goPrevious: () => void
  hasNext: boolean
  hasPrevious: boolean

  /* Progress */
  savingProgress: boolean
  markLesson: (lesson: FlatLesson, status: ContentStatus, positionSeconds?: number) => Promise<void>

  /* Assessments */
  assessments: LearningAssessment[]
  assessmentsLoading: boolean

  /* Notes */
  notes: LearningNote[]
  notesLoading: boolean
  createNote: (payload: Omit<CreateNotePayload, 'course_id'>) => Promise<{ ok: boolean; message: string }>
  updateNote: (id: number, note: string) => Promise<{ ok: boolean; message: string }>
  deleteNote: (id: number) => Promise<{ ok: boolean; message: string }>

  /* Certificates */
  certificates: LearningCertificate[]
  courseCertificate: LearningCertificate | null
  claimCertificate: () => Promise<{ ok: boolean; message: string }>
  claimingCertificate: boolean

  /* Discussions */
  discussions: Discussion[]
  discussionsLoading: boolean
  postDiscussion: (message: string, title?: string) => Promise<{ ok: boolean; message: string }>
  replyToDiscussion: (id: number, message: string) => Promise<{ ok: boolean; message: string }>
  deleteDiscussion: (id: number) => Promise<{ ok: boolean; message: string }>

  /* Authoring (admin/HR) - the API enforces the same gate. */
  authoringSaving: boolean
  saveChapter: (
    values: Record<string, string>,
    chapterId?: number,
  ) => Promise<{ ok: boolean; message: string }>
  saveContent: (
    values: Record<string, string>,
    chapterId: number,
    contentId?: number,
  ) => Promise<{ ok: boolean; message: string }>
  removeChapter: (id: number) => Promise<{ ok: boolean; message: string }>
  removeContent: (id: number) => Promise<{ ok: boolean; message: string }>

  message: string | null
  error: string | null
  dismiss: () => void
}

export function useMyLearning(): MyLearningState {
  const resolveContext = useLaravelContext()
  // The backend flags instructor posts and gates moderation on the raw Laravel
  // profile, not this frontend's mapped Role.
  const { user } = useAuth()
  const profileName = user?.profileName

  const [courses, setCourses] = useState<LearningCourseSummary[]>([])
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [coursesError, setCoursesError] = useState<string | null>(null)

  const [courseId, setCourseId] = useState<number | null>(null)
  const [detail, setDetail] = useState<LearningCourseDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [currentContentId, setCurrentContentId] = useState<number | null>(null)
  const [savingProgress, setSavingProgress] = useState(false)

  const [assessments, setAssessments] = useState<LearningAssessment[]>([])
  const [assessmentsLoading, setAssessmentsLoading] = useState(false)

  const [notes, setNotes] = useState<LearningNote[]>([])
  const [notesLoading, setNotesLoading] = useState(false)

  const [certificates, setCertificates] = useState<LearningCertificate[]>([])
  const [claimingCertificate, setClaimingCertificate] = useState(false)

  const [discussions, setDiscussions] = useState<Discussion[]>([])
  const [discussionsLoading, setDiscussionsLoading] = useState(false)

  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  /* ---------------- Course list ---------------- */

  const loadCourses = useCallback(async () => {
    const context = resolveContext()

    if (!isLaravelContextReady(context)) {
      setCoursesLoading(false)
      setCoursesError('Your session has expired. Sign in again to continue learning.')
      return
    }

    setCoursesLoading(true)
    setCoursesError(null)

    try {
      const response = await lmsLearningService.getMyCourses(context)
      setCourses(response.data ?? [])
    } catch (loadError) {
      setCoursesError(toMessage(loadError, 'Failed to load your courses.'))
      setCourses([])
    } finally {
      setCoursesLoading(false)
    }
  }, [resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      void loadCourses()
    })
  }, [loadCourses])

  /* ---------------- Selected course ---------------- */

  const loadDetail = useCallback(async () => {
    if (!courseId) {
      setDetail(null)
      return
    }

    const context = resolveContext()
    if (!isLaravelContextReady(context)) return

    setDetailLoading(true)
    setDetailError(null)

    try {
      const response = await lmsLearningService.getCourse(context, courseId)
      setDetail(response.data ?? null)

      // Resume where the learner left off: first unfinished lesson.
      const flat = (response.data?.chapters ?? []).flatMap((chapter) => chapter.content)
      const resume = flat.find((item) => item.status !== 'completed') ?? flat[0]
      setCurrentContentId(resume?.id ?? null)
    } catch (loadError) {
      setDetailError(toMessage(loadError, 'Failed to load this course.'))
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [courseId, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      void loadDetail()
    })
  }, [loadDetail])

  /* ---------------- Assessments + notes for the selected course ---------------- */

  useEffect(() => {
    queueMicrotask(() => {
      if (!courseId) {
        setAssessments([])
        setNotes([])
        return
      }

      const context = resolveContext()
      if (!isLaravelContextReady(context)) return

      setAssessmentsLoading(true)
      lmsLearningService
        .getAssessments(context, courseId)
        .then((response) => setAssessments(response.data ?? []))
        .catch(() => setAssessments([]))
        .finally(() => setAssessmentsLoading(false))

      setNotesLoading(true)
      lmsLearningService
        .getNotes(context, courseId)
        .then((response) => setNotes(response.data ?? []))
        .catch(() => setNotes([]))
        .finally(() => setNotesLoading(false))

      setDiscussionsLoading(true)
      lmsDiscussionService
        .list(context, courseId)
        .then((response) => setDiscussions(response.data ?? []))
        .catch(() => setDiscussions([]))
        .finally(() => setDiscussionsLoading(false))

      lmsCertificateService
        .list(context)
        .then((response) => setCertificates(response.data ?? []))
        .catch(() => setCertificates([]))
    })
  }, [courseId, resolveContext])

  /* ---------------- Lesson navigation ---------------- */

  const lessons = useMemo<FlatLesson[]>(() => {
    if (!detail) return []

    let index = 0
    return detail.chapters.flatMap((chapter) =>
      chapter.content.map((item) => ({
        ...item,
        chapterId: chapter.id,
        chapterName: chapter.chapter_name ?? 'Untitled chapter',
        index: index++,
      })),
    )
  }, [detail])

  const currentIndex = lessons.findIndex((lesson) => lesson.id === currentContentId)
  const currentLesson = currentIndex >= 0 ? lessons[currentIndex] : (lessons[0] ?? null)
  // Next is only offered when the following lesson is actually reachable.
  const hasNext =
    currentIndex >= 0 &&
    currentIndex < lessons.length - 1 &&
    !lessons[currentIndex + 1].is_locked
  const hasPrevious = currentIndex > 0

  /* ---------------- Progress ---------------- */

  const markLesson = useCallback(
    async (lesson: FlatLesson, status: ContentStatus, positionSeconds?: number) => {
      if (!courseId) return

      const context = resolveContext()
      setSavingProgress(true)

      try {
        const response = await lmsLearningService.saveProgress(context, {
          course_id: courseId,
          content_id: lesson.id,
          chapter_id: lesson.chapterId,
          status,
          last_position_seconds: positionSeconds ?? null,
        })

        // Patch locally so the tick and the radial move without a full refetch.
        setDetail((current) => {
          if (!current) return current

          const chapters = current.chapters.map((chapter) => ({
            ...chapter,
            content: chapter.content.map((item) =>
              item.id === lesson.id
                ? { ...item, status: response.data.status, last_position_seconds: positionSeconds ?? item.last_position_seconds }
                : item,
            ),
          })).map((chapter) => ({
            ...chapter,
            completed_content: chapter.content.filter((i) => i.status === 'completed').length,
          }))

          return {
            ...current,
            chapters,
            completed_content: response.data.completed_content,
            progress_percent: response.data.progress_percent,
          }
        })

        // Keep the picker's percentage in step.
        setCourses((current) =>
          current.map((course) =>
            course.id === courseId
              ? {
                  ...course,
                  completed_content: response.data.completed_content,
                  progress_percent: response.data.progress_percent,
                }
              : course,
          ),
        )
      } catch (saveError) {
        setError(toMessage(saveError, 'Failed to save your progress.'))
      } finally {
        setSavingProgress(false)
      }
    },
    [courseId, resolveContext],
  )

  /**
   * Time-spent heartbeat.
   *
   * Reports elapsed seconds on the open lesson every 30s so the sidebar figure
   * reflects real study time rather than only the moments a video was paused.
   * Pauses when the tab is hidden, so a backgrounded tab does not inflate it,
   * and stops once the lesson is completed.
   */
  useEffect(() => {
    if (!courseId || !currentLesson || currentLesson.status === 'completed') return

    const lesson = currentLesson
    const context = resolveContext()
    if (!isLaravelContextReady(context)) return

    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return

      void lmsLearningService
        .saveProgress(context, {
          course_id: courseId,
          content_id: lesson.id,
          chapter_id: lesson.chapterId,
          // The backend never downgrades a completed item, so this is safe to
          // send repeatedly.
          status: 'in-progress',
          time_spent_delta: HEARTBEAT_SECONDS,
        })
        .catch(() => {
          // A dropped heartbeat is not worth surfacing - the next tick retries.
        })
    }, HEARTBEAT_SECONDS * 1000)

    return () => clearInterval(timer)
  }, [courseId, currentLesson, resolveContext])

  const selectLesson = useCallback(
    (contentId: number) => {
      const lesson = lessons.find((item) => item.id === contentId)
      if (!lesson) return

      // Sequential unlocking is enforced here as well as in the payload, so a
      // locked lesson cannot be reached by Next/Previous either.
      if (lesson.is_locked) {
        setError('Finish the previous lesson to unlock this one.')
        return
      }

      setCurrentContentId(contentId)

      // Opening an untouched lesson starts it.
      if (lesson.status === 'not-started') {
        void markLesson(lesson, 'in-progress')
      }
    },
    [lessons, markLesson],
  )

  const goNext = useCallback(() => {
    if (hasNext) selectLesson(lessons[currentIndex + 1].id)
  }, [hasNext, lessons, currentIndex, selectLesson])

  const goPrevious = useCallback(() => {
    if (hasPrevious) selectLesson(lessons[currentIndex - 1].id)
  }, [hasPrevious, lessons, currentIndex, selectLesson])

  /* ---------------- Notes ---------------- */

  const createNote = useCallback(
    async (payload: Omit<CreateNotePayload, 'course_id'>) => {
      if (!courseId) return { ok: false, message: 'No course selected.' }

      const context = resolveContext()
      try {
        const response = await lmsLearningService.createNote(context, { ...payload, course_id: courseId })
        setNotes((current) => [response.data, ...current])
        setMessage('Note saved.')
        return { ok: true, message: 'Note saved.' }
      } catch (noteError) {
        const failure = toMessage(noteError, 'Failed to save the note.')
        setError(failure)
        return { ok: false, message: failure }
      }
    },
    [courseId, resolveContext],
  )

  const updateNote = useCallback(
    async (id: number, note: string) => {
      const context = resolveContext()
      try {
        const response = await lmsLearningService.updateNote(context, id, note)
        setNotes((current) => current.map((item) => (item.id === id ? response.data : item)))
        setMessage('Note updated.')
        return { ok: true, message: 'Note updated.' }
      } catch (noteError) {
        const failure = toMessage(noteError, 'Failed to update the note.')
        setError(failure)
        return { ok: false, message: failure }
      }
    },
    [resolveContext],
  )

  /* ---------------- Certificates ---------------- */

  const courseCertificate =
    certificates.find((certificate) => certificate.course_id === courseId) ?? null

  const claimCertificate = useCallback(async () => {
    if (!courseId) return { ok: false, message: 'No course selected.' }

    const context = resolveContext()
    setClaimingCertificate(true)
    setError(null)

    try {
      const response = await lmsCertificateService.issue(context, courseId)
      setCertificates((current) => {
        const without = current.filter((c) => c.course_id !== courseId)
        return [response.data, ...without]
      })
      // Issuing also completes the enrolment server-side, so refresh the list.
      void loadCourses()
      setMessage('Certificate issued.')
      return { ok: true, message: 'Certificate issued.' }
    } catch (claimError) {
      const failure = toMessage(claimError, 'Failed to issue the certificate.')
      setError(failure)
      return { ok: false, message: failure }
    } finally {
      setClaimingCertificate(false)
    }
  }, [courseId, resolveContext, loadCourses])

  /* ---------------- Discussions ---------------- */

  const postDiscussion = useCallback(
    async (body: string, title?: string) => {
      if (!courseId) return { ok: false, message: 'No course selected.' }

      const context = resolveContext()
      try {
        await lmsDiscussionService.create(
          context,
          {
            course_id: courseId,
            content_id: currentContentId,
            title: title ?? null,
            message: body,
          },
          profileName,
        )
        // Refetch so the thread arrives with its author name resolved.
        const refreshed = await lmsDiscussionService.list(context, courseId)
        setDiscussions(refreshed.data ?? [])
        setMessage('Posted to the discussion.')
        return { ok: true, message: 'Posted to the discussion.' }
      } catch (postError) {
        const failure = toMessage(postError, 'Failed to post.')
        setError(failure)
        return { ok: false, message: failure }
      }
    },
    [courseId, currentContentId, resolveContext, profileName],
  )

  const replyToDiscussion = useCallback(
    async (id: number, body: string) => {
      if (!courseId) return { ok: false, message: 'No course selected.' }

      const context = resolveContext()
      try {
        await lmsDiscussionService.reply(context, id, body, profileName)
        const refreshed = await lmsDiscussionService.list(context, courseId)
        setDiscussions(refreshed.data ?? [])
        return { ok: true, message: 'Reply posted.' }
      } catch (replyError) {
        const failure = toMessage(replyError, 'Failed to reply.')
        setError(failure)
        return { ok: false, message: failure }
      }
    },
    [courseId, resolveContext, profileName],
  )

  const deleteDiscussion = useCallback(
    async (id: number) => {
      const context = resolveContext()
      try {
        await lmsDiscussionService.remove(context, id, profileName)
        setDiscussions((current) => current.filter((thread) => thread.id !== id))
        setMessage('Discussion deleted.')
        return { ok: true, message: 'Discussion deleted.' }
      } catch (deleteError) {
        const failure = toMessage(deleteError, 'Failed to delete.')
        setError(failure)
        return { ok: false, message: failure }
      }
    },
    [resolveContext, profileName],
  )

  /* ---------------- Authoring ---------------- */

  const [authoringSaving, setAuthoringSaving] = useState(false)

  /** Shared wrapper: run a write, then refetch the course so the tree updates. */
  const runAuthoring = useCallback(
    async (operation: () => Promise<void>, successMessage: string, fallback: string) => {
      setAuthoringSaving(true)
      setError(null)

      try {
        await operation()
        await loadDetail()
        setMessage(successMessage)
        return { ok: true, message: successMessage }
      } catch (authoringError) {
        const failure = toMessage(authoringError, fallback)
        setError(failure)
        return { ok: false, message: failure }
      } finally {
        setAuthoringSaving(false)
      }
    },
    [loadDetail],
  )

  const saveChapter = useCallback(
    (values: Record<string, string>, chapterId?: number) =>
      runAuthoring(
        async () => {
          const context = resolveContext()
          const payload = {
            chapter_name: values.chapter_name,
            chapter_desc: values.chapter_desc || null,
            sort_order: values.sort_order ? Number(values.sort_order) : 1,
          }

          if (chapterId) {
            await lmsLearningService.updateChapter(context, chapterId, payload, profileName)
          } else {
            await lmsLearningService.createChapter(
              context,
              { ...payload, subject_id: courseId ?? undefined },
              profileName,
            )
          }
        },
        chapterId ? 'Chapter updated.' : 'Chapter created.',
        'Failed to save the chapter.',
      ),
    [runAuthoring, resolveContext, profileName, courseId],
  )

  const saveContent = useCallback(
    (values: Record<string, string>, chapterId: number, contentId?: number) =>
      runAuthoring(
        async () => {
          const context = resolveContext()
          const payload = {
            title: values.title,
            description: values.description || null,
            filename: values.filename || null,
            file_type: values.file_type || null,
            content_category: values.content_category || null,
            sort_order: values.sort_order ? Number(values.sort_order) : 1,
          }

          if (contentId) {
            await lmsLearningService.updateContent(context, contentId, payload, profileName)
          } else {
            await lmsLearningService.createContent(
              context,
              { ...payload, chapter_id: chapterId },
              profileName,
            )
          }
        },
        contentId ? 'Lesson updated.' : 'Lesson created.',
        'Failed to save the lesson.',
      ),
    [runAuthoring, resolveContext, profileName],
  )

  const removeChapter = useCallback(
    (id: number) =>
      runAuthoring(
        async () => {
          await lmsLearningService.deleteChapter(resolveContext(), id, profileName)
        },
        'Chapter deleted.',
        'Failed to delete the chapter.',
      ),
    [runAuthoring, resolveContext, profileName],
  )

  const removeContent = useCallback(
    (id: number) =>
      runAuthoring(
        async () => {
          await lmsLearningService.deleteContent(resolveContext(), id, profileName)
        },
        'Lesson deleted.',
        'Failed to delete the lesson.',
      ),
    [runAuthoring, resolveContext, profileName],
  )

  const deleteNote = useCallback(
    async (id: number) => {
      const context = resolveContext()
      try {
        await lmsLearningService.deleteNote(context, id)
        setNotes((current) => current.filter((item) => item.id !== id))
        setMessage('Note deleted.')
        return { ok: true, message: 'Note deleted.' }
      } catch (noteError) {
        const failure = toMessage(noteError, 'Failed to delete the note.')
        setError(failure)
        return { ok: false, message: failure }
      }
    },
    [resolveContext],
  )

  return {
    courses,
    coursesLoading,
    coursesError,

    courseId,
    selectCourse: setCourseId,
    detail,
    detailLoading,
    detailError,
    // Refetch whichever view is active - the course list, or the open course.
    reload: () => {
      void loadCourses()
      if (courseId) void loadDetail()
    },

    lessons,
    currentLesson,
    selectLesson,
    goNext,
    goPrevious,
    hasNext,
    hasPrevious,

    savingProgress,
    markLesson,

    assessments,
    assessmentsLoading,

    notes,
    notesLoading,
    createNote,
    updateNote,
    deleteNote,

    certificates,
    courseCertificate,
    claimCertificate,
    claimingCertificate,

    discussions,
    discussionsLoading,
    postDiscussion,
    replyToDiscussion,
    deleteDiscussion,

    authoringSaving,
    saveChapter,
    saveContent,
    removeChapter,
    removeContent,

    message,
    error,
    dismiss: () => {
      setMessage(null)
      setError(null)
    },
  }
}
