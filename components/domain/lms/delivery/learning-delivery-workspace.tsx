'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Clock,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Pencil,
  Plus,
  Lock,
  MessageSquare,
  PlayCircle,
  Send,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/ui/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { useMyLearning, type FlatLesson } from '@/hooks/use-my-learning'
import {
  AuthoringDeleteDialog,
  ChapterFormSheet,
  type AuthoringTarget,
} from './course-authoring'
import {
  lmsCertificateService,
  type Discussion,
  type LearningAssessment,
  LearningCourseSummary,
  LearningNote,
} from '@/services/lms'
import { isHrAdmin } from '@/types/role'

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function formatDate(value: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : format(parsed, 'dd MMM yyyy')
}

/**
 * How a lesson renders, from its file_type.
 *
 * `office` is new. Slide decks and documents used to fall through to the
 * "opens in a new tab" card, so a PowerPoint lesson was a download rather than
 * something you could sit and read inside the course — and the Course Builder
 * did not offer the type at all, so there was no way to add one.
 *
 * The extension is also read off the media URL as a fallback, because
 * `file_type` is free text that older rows filled inconsistently: a .pptx
 * stored with a blank type should still present as a deck.
 */
function lessonKind(
  fileType: string | null,
  src?: string | null,
): 'video' | 'pdf' | 'image' | 'office' | 'link' | 'unknown' {
  const type = (fileType ?? '').toLowerCase()
  if (type === 'mp4' || type === 'video') return 'video'
  if (type === 'pdf') return 'pdf'
  if (type === 'jpg' || type === 'jpeg' || type === 'png' || type === 'image') return 'image'
  if (OFFICE_TYPES.includes(type)) return 'office'
  if (type === 'link' || type === 'url') return 'link'

  // Nothing recognised in file_type - fall back to the file's own extension.
  const extension = (src ?? '').split('?')[0].split('.').pop()?.toLowerCase() ?? ''
  if (extension === 'pdf') return 'pdf'
  if (OFFICE_TYPES.includes(extension)) return 'office'
  if (['mp4', 'webm', 'mov'].includes(extension)) return 'video'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) return 'image'

  return 'unknown'
}

/** Slide decks, documents and spreadsheets - anything Office can render. */
const OFFICE_TYPES = ['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'presentation', 'slides']

/**
 * Microsoft's viewer renders a deck or document in place, with no plugin and
 * no conversion step on our side.
 *
 * It fetches the file itself, so the URL has to be reachable from the public
 * internet — which is true of the CDN-hosted material and of Gamma exports,
 * and NOT true of anything behind a login. When it cannot load, the viewer
 * shows its own message, so the download link below the frame is always
 * offered rather than being a fallback the learner has to discover.
 */
function officeViewerUrl(src: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(src)}`
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="size-4 text-success" />,
  'in-progress': <PlayCircle className="size-4 text-primary" />,
  'not-started': <Circle className="size-4 text-muted-foreground/40" />,
}

/* ─── Course picker ────────────────────────────────────────────────────────── */

function CoursePicker({
  courses,
  loading,
  error,
  onSelect,
  onRetry,
}: {
  courses: LearningCourseSummary[]
  loading: boolean
  error: string | null
  onSelect: (id: number) => void
  onRetry: () => void
}) {
  if (error && !loading && courses.length === 0) {
    return <ErrorState title="Couldn't load your courses" description={error} retry={onRetry} />
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">My Learning</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a course to continue where you left off.
        </p>
      </div>

      {loading ? (
        <div className="grid w-full min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="size-8" />}
          title="No enrolled courses"
          description="Enrol from the learning catalogue to start learning."
        />
      ) : (
        <div className="grid w-full min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {courses.map((course) => {
            const due = formatDate(course.end_date)
            const overdue =
              course.end_date &&
              new Date(course.end_date) < new Date() &&
              course.enrollment_status !== 'completed'

            return (
              <button
                key={course.id}
                type="button"
                onClick={() => onSelect(course.id)}
                className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-muted">
                    {course.display_image && course.display_image !== '/' ? (
                       
                      <img src={course.display_image} alt="" className="size-full object-cover" />
                    ) : (
                      <ImageIcon className="size-5 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                      {course.display_name ?? 'Untitled course'}
                    </h3>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {[course.subject_type, course.standard_name].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className="text-muted-foreground">
                      {course.completed_content}/{course.total_content} lessons
                    </span>
                    <span className="text-foreground">{course.progress_percent}%</span>
                  </div>
                  <Progress
                    value={course.progress_percent}
                    className="h-1.5 bg-muted-foreground/20 [&>div]:bg-primary"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <StatusBadge
                    variant={
                      course.enrollment_status === 'completed'
                        ? 'success'
                        : overdue
                          ? 'error'
                          : 'processing'
                    }
                    size="sm"
                    className="text-[10px] font-bold uppercase tracking-wider"
                  >
                    {course.enrollment_status === 'completed'
                      ? 'Completed'
                      : overdue
                        ? 'Overdue'
                        : 'In Progress'}
                  </StatusBadge>
                  {due && <span className="text-[11px] text-muted-foreground">Due {due}</span>}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─── Lesson viewer ────────────────────────────────────────────────────────── */

/*
 * The full-screen interactive course (deck, videos, checklist, resources) is a page on the course storage that opens in its own tab.
 * It is opened WITH its opener link on purpose: that page reports how far the learner got (postMessage), and this tab saves it through the
 * same progress call every other lesson uses, so a learner who finishes the course in the other tab finds this lesson ticked without pressing
 * anything. Only the course storage host is trusted for this; any other link keeps the plain "opens in a new tab" card.
 */
const COURSE_PLAYER_HOSTS = ['s3-triz.fra1.digitaloceanspaces.com']
const COURSE_PLAYER_PATH = '/interactive/_player/course.html'

function interactiveCourseOrigin(src: string): string | null {
  try {
    const url = new URL(src)
    const trusted = url.protocol === 'https:' && COURSE_PLAYER_HOSTS.includes(url.hostname)
    return trusted && url.pathname.endsWith(COURSE_PLAYER_PATH) ? url.origin : null
  } catch {
    return null
  }
}

function InteractiveCourseLauncher({
  lesson,
  src,
  origin,
  onProgress,
  onComplete,
}: {
  lesson: FlatLesson
  src: string
  origin: string
  onProgress: () => void
  onComplete: () => void
}) {
  const [percent, setPercent] = useState<number | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const lastStep = useRef(-1)
  const box = useRef<HTMLDivElement>(null)
  const completed = lesson.status === 'completed'

  // The player is told which lesson it belongs to and where to report; it only ever reports to this page's own address.
  const withContext = React.useCallback(
    (embed: boolean) => {
      const url = new URL(src)
      url.searchParams.set('lesson', String(lesson.id))
      url.searchParams.set('from', window.location.origin)
      if (embed) url.searchParams.set('embed', '1')
      return url.toString()
    },
    [src, lesson.id],
  )

  const frameSrc = typeof window === 'undefined' ? null : withContext(true)

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== origin) return
      const data = event.data as { src?: string; lesson?: string | number; type?: string; percent?: number; step?: number } | null
      if (!data || data.src !== 'g2g-course' || String(data.lesson) !== String(lesson.id)) return
      if (typeof data.percent === 'number') setPercent(data.percent)
      if (data.type === 'completed') {
        if (!completed) onComplete()
        return
      }
      // One save per step, and never once the lesson is already complete (it must not slip back to "in progress").
      if (data.type === 'progress' && !completed && typeof data.step === 'number' && data.step !== lastStep.current) {
        lastStep.current = data.step
        onProgress()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [origin, lesson.id, completed, onProgress, onComplete])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === box.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void box.current?.requestFullscreen?.()
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {completed ? <CheckCircle2 className="size-4 text-emerald-500" /> : <PlayCircle className="size-4 text-primary" />}
          Interactive course
          {percent !== null && !completed ? <span className="text-xs font-normal text-muted-foreground">{percent}% done</span> : null}
          {completed ? <span className="text-xs font-normal text-emerald-600">Completed</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={toggleFullscreen}>
            <Maximize2 className="size-3.5" /> Full screen
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.open(withContext(false), '_blank')}>
            <ExternalLink className="size-3.5" /> New tab
          </Button>
        </div>
      </div>
      <div ref={box} className="w-full min-w-0 overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm">
        {frameSrc ? (
          <iframe
            title={lesson.title ?? 'Interactive course'}
            src={frameSrc}
            allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
            className={fullscreen ? 'h-screen w-screen' : 'h-[74vh] min-h-[540px] w-full'}
          />
        ) : (
          <Skeleton className="h-[74vh] min-h-[540px] w-full" />
        )}
      </div>
      {percent !== null && !completed ? <Progress value={percent} className="h-1.5" /> : null}
      <p className="text-xs text-muted-foreground">
        Learn here or in full screen. Your place is saved, and the lesson is marked complete for you when you finish.
      </p>
    </div>
  )
}

function LessonViewer({
  lesson,
  onComplete,
  onPositionSave,
}: {
  lesson: FlatLesson
  onComplete: () => void
  onPositionSave: (seconds: number) => void
}) {
  const src = lesson.filename || lesson.url || ''
  const kind = lessonKind(lesson.file_type, src)

  if (!src) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/30">
        <p className="text-sm text-muted-foreground">This lesson has no attached media.</p>
      </div>
    )
  }

  if (kind === 'video') {
    return (
      <video
        key={lesson.id}
        controls
        className="aspect-video w-full rounded-xl bg-foreground/95"
        // Resume from where the learner stopped.
        onLoadedMetadata={(event) => {
          const el = event.currentTarget
          if (lesson.last_position_seconds) el.currentTime = lesson.last_position_seconds
        }}
        onPause={(event) => onPositionSave(Math.floor(event.currentTarget.currentTime))}
        onEnded={onComplete}
      >
        <source src={src} />
        Your browser does not support embedded video.
      </video>
    )
  }

  if (kind === 'image') {
    return (
       
      <img src={src} alt={lesson.title ?? ''} className="w-full rounded-xl border border-border/60" />
    )
  }

  if (kind === 'pdf') {
    return (
      <div className="flex flex-col gap-2">
        <iframe src={src} title={lesson.title ?? 'Lesson'} className="aspect-video w-full rounded-xl border border-border/60" />
        <a href={src} target="_blank" rel="noopener noreferrer" className="self-start">
          <Button variant="outline" size="sm" className="gap-2">
            <ExternalLink className="size-3.5" /> Open in a new tab
          </Button>
        </a>
      </div>
    )
  }

  /*
   * Slide decks and documents, rendered in place.
   *
   * These used to fall through to the "opens in a new tab" card, so a
   * PowerPoint lesson was a download — the learner left the course to read it
   * and nothing brought them back. The viewer keeps them inside the lesson,
   * with the same shape as the PDF branch above.
   *
   * The download link is always shown rather than being an error fallback:
   * the viewer needs the file to be publicly reachable, and when it is not,
   * its own message appears inside the frame. Better a link that was never
   * needed than a learner staring at a viewer that will not load.
   */
  if (kind === 'office') {
    return (
      <div className="flex flex-col gap-2">
        <iframe
          src={officeViewerUrl(src)}
          title={lesson.title ?? 'Lesson'}
          className="aspect-video w-full rounded-xl border border-border/60 bg-background"
        />
        <a href={src} target="_blank" rel="noopener noreferrer" className="self-start">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="size-3.5" /> Download the file
          </Button>
        </a>
      </div>
    )
  }

  const courseOrigin = interactiveCourseOrigin(src)
  if (courseOrigin) {
    return (
      <InteractiveCourseLauncher
        lesson={lesson}
        src={src}
        origin={courseOrigin}
        onProgress={() => onPositionSave(0)}
        onComplete={onComplete}
      />
    )
  }

  // `link` covers externally hosted files - the CDN stores some PDFs this way.
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-10">
      <FileText className="size-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">This lesson opens in a new tab.</p>
      <a href={src} target="_blank" rel="noopener noreferrer">
        <Button className="gap-2">
          <ExternalLink className="size-4" /> Open lesson
        </Button>
      </a>
    </div>
  )
}

/* ─── Notes tab ────────────────────────────────────────────────────────────── */

function NotesTab({
  notes,
  loading,
  currentLesson,
  onCreate,
  onUpdate,
  onDelete,
}: {
  notes: LearningNote[]
  loading: boolean
  currentLesson: FlatLesson | null
  onCreate: (note: string, contentId: number | null, chapterId: number | null) => void
  onUpdate: (id: number, note: string) => void
  onDelete: (id: number) => void
}) {
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-xl border border-border/60 p-4">
        <label htmlFor="new-note" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          New note{currentLesson ? ` on "${currentLesson.title}"` : ''}
        </label>
        <Textarea
          id="new-note"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          placeholder="Write a note…"
        />
        <Button
          size="sm"
          className="self-end"
          disabled={!draft.trim()}
          onClick={() => {
            onCreate(draft.trim(), currentLesson?.id ?? null, currentLesson?.chapterId ?? null)
            setDraft('')
          }}
        >
          Save note
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={<StickyNote className="size-8" />}
          title="No notes yet"
          description="Notes you take while learning are saved to your account."
        />
      ) : (
        <div className="flex w-full min-w-0 flex-col gap-3">
          {notes.map((note) => (
            <div key={note.id} className="flex flex-col gap-2 rounded-lg border border-border/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-xs font-semibold text-foreground">
                    {note.content_title ?? 'Course note'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(note.created_at) ?? ''}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setEditingId(note.id)
                      setEditDraft(note.note)
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-destructive hover:text-destructive"
                    onClick={() => onDelete(note.id)}
                    aria-label="Delete note"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              {editingId === note.id ? (
                <div className="flex flex-col gap-2">
                  <Textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} rows={3} />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={!editDraft.trim()}
                      onClick={() => {
                        onUpdate(note.id, editDraft.trim())
                        setEditingId(null)
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm text-foreground">{note.note}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Assessments tab ──────────────────────────────────────────────────────── */

function AssessmentsTab({
  assessments,
  loading,
  onTakeQuiz,
  onDownloadCertificate,
  downloadingCert,
}: {
  assessments: LearningAssessment[]
  loading: boolean
  onTakeQuiz: () => void
  onDownloadCertificate?: () => void
  downloadingCert?: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-lg" />
        ))}
      </div>
    )
  }

  if (assessments.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardCheck className="size-8" />}
        title="No assessments for this course"
        description="Question papers linked to this course will appear here."
      />
    )
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      {assessments.map((assessment) => (
        <div key={assessment.id} className="flex flex-col gap-3 rounded-lg border border-border/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <h4 className="truncate text-sm font-semibold text-foreground">
                {assessment.paper_name ?? 'Untitled paper'}
              </h4>
              {assessment.paper_desc && (
                <p className="line-clamp-2 text-xs text-muted-foreground">{assessment.paper_desc}</p>
              )}
            </div>
            {/*
              * Passed is not the same as attempted, and the certificate gate
              * cares about the difference. Showing "Attempted" for a failed
              * attempt told the learner they were done when they were not.
              */}
            <StatusBadge
              variant={
                assessment.passed
                  ? 'success'
                  : assessment.status === 'completed'
                    ? 'pending'
                    : 'inactive'
              }
              size="sm"
              className="shrink-0 text-[10px] font-bold uppercase tracking-wider"
            >
              {assessment.passed
                ? 'Passed'
                : assessment.status === 'completed'
                  ? 'Attempted'
                  : 'Not started'}
            </StatusBadge>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] font-medium text-muted-foreground">
            <span>{assessment.total_ques ?? 0} questions</span>
            <span>{assessment.total_marks ?? 0} marks</span>
            {assessment.timelimit_enable === 1 && assessment.time_allowed && (
              <span>{assessment.time_allowed} min</span>
            )}
            {assessment.attempt_allowed && <span>{assessment.attempt_allowed} attempt(s) allowed</span>}
            <span>{assessment.attempt_count} taken</span>
            {assessment.best_score !== null && (
              <span className="text-foreground">Best: {assessment.best_score}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={assessment.passed ? 'outline' : 'default'}
              className="w-fit gap-2"
              onClick={onTakeQuiz}
            >
              <ClipboardCheck className="size-3.5" />
              {assessment.passed
                ? 'Review your result'
                : assessment.attempt_count > 0
                  ? 'Try again'
                  : 'Take this assessment'}
            </Button>
            {assessment.passed && onDownloadCertificate && (
              <Button
                size="sm"
                variant="default"
                className="w-fit gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={downloadingCert}
                onClick={onDownloadCertificate}
              >
                {downloadingCert ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                Download certificate
              </Button>
            )}
          </div>

          {assessment.attempts.length > 0 && (
            <div className="flex flex-col gap-1 rounded-md bg-muted/30 p-2">
              {assessment.attempts.slice(0, 3).map((attempt) => (
                <div key={`${attempt.source ?? 'legacy'}-${attempt.id}`} className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">{formatDate(attempt.created_at) ?? '—'}</span>
                  {/*
                    * The two sources record different things. A quiz attempt
                    * has a percentage and a pass flag; a legacy exam row has a
                    * right/wrong split and neither. Rendering one shape for
                    * both meant printing "0 right / 0 wrong" against a quiz
                    * the learner had scored 100% on.
                    */}
                  <span className="font-semibold text-foreground">
                    {attempt.source === 'quiz' ? (
                      <>
                        {attempt.obtain_marks ?? 0} marks
                        {attempt.percent != null && ` · ${Math.round(attempt.percent)}%`}
                        {attempt.passed != null && (attempt.passed ? ' · passed' : ' · not passed')}
                      </>
                    ) : (
                      <>
                        {attempt.obtain_marks ?? 0} marks · {attempt.total_right ?? 0} right /{' '}
                        {attempt.total_wrong ?? 0} wrong
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ─── Certificate panel ────────────────────────────────────────────────────── */

/**
 * A certificate is earned by completing every lesson. The server enforces that
 * too, so the button is a convenience rather than the gate.
 */
/* ─── Discussions tab ──────────────────────────────────────────────────────── */

function DiscussionsTab({
  discussions,
  loading,
  currentUserId,
  canModerate,
  onPost,
  onReply,
  onDelete,
}: {
  discussions: Discussion[]
  loading: boolean
  currentUserId: string | undefined
  canModerate: boolean
  onPost: (message: string) => void
  onReply: (id: number, message: string) => void
  onDelete: (id: number) => void
}) {
  const [draft, setDraft] = useState('')
  const [replyingTo, setReplyingTo] = useState<number | null>(null)
  const [replyDraft, setReplyDraft] = useState('')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-xl border border-border/60 p-4">
        <label htmlFor="new-discussion" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Ask the group
        </label>
        <Textarea
          id="new-discussion"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          placeholder="Ask a question or share something you learned…"
        />
        <Button
          size="sm"
          className="self-end gap-2"
          disabled={!draft.trim()}
          onClick={() => {
            onPost(draft.trim())
            setDraft('')
          }}
        >
          <Send className="size-3.5" /> Post
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : discussions.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="size-8" />}
          title="No discussion yet"
          description="Be the first to ask a question about this course."
        />
      ) : (
        <div className="flex w-full min-w-0 flex-col gap-3">
          {discussions.map((thread) => {
            const isAuthor = String(thread.user_id) === String(currentUserId)

            return (
              <div key={thread.id} className="flex flex-col gap-3 rounded-lg border border-border/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {thread.author_name || 'Unknown'}
                      </span>
                      {thread.is_instructor && (
                        <StatusBadge variant="processing" size="sm" className="text-[10px] font-bold uppercase">
                          Instructor
                        </StatusBadge>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(thread.created_at) ?? ''}
                      {thread.content_title ? ` · ${thread.content_title}` : ''}
                    </span>
                  </div>
                  {(isAuthor || canModerate) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => onDelete(thread.id)}
                      aria-label="Delete discussion"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>

                {thread.title && <p className="text-sm font-semibold text-foreground">{thread.title}</p>}
                <p className="whitespace-pre-wrap text-sm text-foreground">{thread.message}</p>

                {thread.replies.length > 0 && (
                  <div className="flex flex-col gap-2 border-l-2 border-border/60 pl-3">
                    {thread.replies.map((reply) => (
                      <div key={reply.id} className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            {reply.author_name || 'Unknown'}
                          </span>
                          {Boolean(reply.is_instructor) && (
                            <StatusBadge variant="processing" size="sm" className="text-[9px] font-bold uppercase">
                              Instructor
                            </StatusBadge>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(reply.created_at) ?? ''}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-xs text-muted-foreground">{reply.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                {replyingTo === thread.id ? (
                  <div className="flex flex-col gap-2">
                    <Textarea
                      value={replyDraft}
                      onChange={(event) => setReplyDraft(event.target.value)}
                      rows={2}
                      placeholder="Write a reply…"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setReplyingTo(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={!replyDraft.trim()}
                        onClick={() => {
                          onReply(thread.id, replyDraft.trim())
                          setReplyDraft('')
                          setReplyingTo(null)
                        }}
                      >
                        Reply
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 self-start text-xs"
                    onClick={() => {
                      setReplyingTo(thread.id)
                      setReplyDraft('')
                    }}
                  >
                    Reply{thread.reply_count > 0 ? ` (${thread.reply_count})` : ''}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─── Workspace ────────────────────────────────────────────────────────────── */

export function LearningDeliveryWorkspace() {
  const {
    courses, coursesLoading, coursesError,
    courseId, selectCourse, detail, detailLoading, detailError, reload,
    lessons, currentLesson, selectLesson, goNext, goPrevious, hasNext, hasPrevious,
    savingProgress, markLesson,
    assessments, assessmentsLoading,
    notes, notesLoading, createNote, updateNote, deleteNote,
    discussions, discussionsLoading, postDiscussion, replyToDiscussion, deleteDiscussion,
    authoringSaving, saveChapter, saveContent, removeChapter, removeContent,
    certificates, courseCertificate, claimCertificate, claimingCertificate,
    message, error, dismiss,
  } = useMyLearning()
  const { user } = useAuth()
  const [downloadingCert, setDownloadingCert] = useState(false)

  const handleDownloadCertificate = async () => {
    if (!courseId) return
    const context = getLaravelContext(user)
    if (!isLaravelContextReady(context)) return

    setDownloadingCert(true)
    try {
      let targetId = courseCertificate?.id
      if (!targetId) {
        const claimRes = await claimCertificate()
        if (!claimRes.ok) return
        const listRes = await lmsCertificateService.list(context, { courseId })
        const found = listRes.data?.find((c) => c.course_id === courseId)
        targetId = found?.id
      }
      if (targetId) {
        window.open(lmsCertificateService.downloadUrl(context, targetId), '_blank', 'noopener')
      }
    } finally {
      setDownloadingCert(false)
    }
  }

  /*
   * ?course_id=N opens a specific course directly, bypassing the picker.
   *
   * Deep-linked from two places that cannot assume the learner would ever
   * find it by browsing: the notification bell's `action_url` on
   * `learning.auto_assigned` (services/notifications.ts already turns that
   * into a router.push with the query string intact), and the capability-gap
   * learning panel's "Open course" button
   * (cm-gap-learning-panel.tsx). Only acts once, and only while nothing is
   * selected yet — it must not fight a learner who has since picked a
   * different course from the list.
   */
  const searchParams = useSearchParams()
  useEffect(() => {
    if (courseId) return
    const requested = Number(searchParams.get('course_id'))
    if (Number.isInteger(requested) && requested > 0) {
      selectCourse(requested)
    }
    // Intentionally only re-runs when the param itself changes - selectCourse
    // and courseId are read, not depended on, so picking a DIFFERENT course
    // manually afterwards does not get silently overridden on a re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const { user } = useAuth()
  const router = useRouter()

  // Admin/HR may author content; the API enforces the same rule.
  const canModerate = isHrAdmin(user?.role)
  // The learning screen is view-only for everyone: chapters and lessons are edited in the Course Builder, not while someone is learning.
  const canAuthor = false
  const [activeTab, setActiveTab] = useState('learn')

  // When a lesson is completed while the learner is on it, show a clear Next button and move on after a short countdown.
  const [advance, setAdvance] = useState<{ lessonId: number; secs: number } | null>(null)
  const advanceIn = advance && currentLesson && advance.lessonId === currentLesson.id ? advance.secs : null
  const goNextRef = useRef(goNext)
  const currentIdRef = useRef<number | null>(null)
  useEffect(() => {
    goNextRef.current = goNext
    currentIdRef.current = currentLesson?.id ?? null
  })
  useEffect(() => {
    if (!advance) return
    const timer = setTimeout(() => {
      if (advance.secs <= 1) {
        setAdvance(null)
        // Only move on if the learner is still on the lesson that just finished.
        if (advance.lessonId === currentIdRef.current) goNextRef.current()
      } else {
        setAdvance({ ...advance, secs: advance.secs - 1 })
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [advance])
  const completeLesson = async (lesson: FlatLesson) => {
    const saved = await markLesson(lesson, 'completed')
    if (!saved) return
    if (hasNext) setAdvance({ lessonId: lesson.id, secs: 5 })
    // The quiz is a focused next step after the last lesson, rather than a
    // competing card beside the course player. The server still enforces this
    // completion gate when the dedicated page starts an attempt.
    else if ((assessments?.length ?? 0) > 0) {
      router.push(`/module/lms/learning/my-learning/quiz?course_id=${courseId}`)
    }
  }

  const goToQuiz = React.useCallback(() => {
    router.push(`/module/lms/learning/my-learning/quiz?course_id=${courseId}`)
  }, [courseId, router])
  const [authoringTarget, setAuthoringTarget] = useState<AuthoringTarget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: 'chapter' | 'content'; id: number; label: string } | null
  >(null)

  if (!courseId) {
    return (
      <div className="w-full min-w-0 pt-2">
        <CoursePicker
          courses={courses}
          loading={coursesLoading}
          error={coursesError}
          onSelect={selectCourse}
          onRetry={reload}
        />
      </div>
    )
  }

  if (detailError && !detailLoading) {
    return (
      <div className="w-full min-w-0 pt-2">
        <ErrorState title="Couldn't load this course" description={detailError} retry={reload} />
      </div>
    )
  }

  const course = detail?.course
  const due = formatDate(detail?.enrollment?.end_date ?? null)
  const courseComplete =
    (detail?.total_content ?? 0) > 0 && (detail?.completed_content ?? 0) === (detail?.total_content ?? 0)

  const tabs = [
    { id: 'learn', label: 'Learn', icon: PlayCircle },
    { id: 'contents', label: 'Contents', icon: BookOpen },
    { id: 'assessments', label: 'Assessments', icon: ClipboardCheck },
    { id: 'notes', label: 'Notes', icon: StickyNote },
    { id: 'discussions', label: 'Discussions', icon: MessageSquare },
  ]

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 pt-2">
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 shrink-0"
            onClick={() => selectCourse(null)}
            aria-label="Back to my courses"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0">
            {detailLoading && !course ? (
              <Skeleton className="h-7 w-72" />
            ) : (
              <h1 className="truncate text-xl font-bold tracking-tight text-foreground">
                {course?.display_name ?? 'Course'}
              </h1>
            )}
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {[course?.subject_type, course?.subject_code, course?.standard_name]
                .filter(Boolean)
                .join(' · ') || '—'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {(courseCertificate || courseComplete || detail?.certificate_available) && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/50"
              disabled={downloadingCert || claimingCertificate}
              onClick={() => void handleDownloadCertificate()}
            >
              {downloadingCert || claimingCertificate ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Award className="size-3.5 text-emerald-600" />
              )}
              {courseCertificate ? 'Download certificate' : 'Claim certificate'}
            </Button>
          )}
          {due && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Clock className="size-3.5" /> Due {due}
            </div>
          )}
        </div>
      </div>

      {message && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm font-medium text-success">
          <span className="flex items-center gap-2"><CheckCircle2 className="size-4" />{message}</span>
          <button type="button" onClick={dismiss} aria-label="Dismiss"><X className="size-3.5" /></button>
        </div>
      )}
      {error && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive">
          <span className="flex items-center gap-2"><AlertTriangle className="size-4" />{error}</span>
          <button type="button" onClick={dismiss} aria-label="Dismiss"><X className="size-3.5" /></button>
        </div>
      )}

      <div className="flex w-full min-w-0 flex-col gap-4">
          <div className="flex w-full min-w-0 items-center gap-6 overflow-x-auto border-b border-border/60">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center gap-1.5 whitespace-nowrap pb-3 text-sm font-semibold outline-none transition-colors',
                  activeTab === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <tab.icon className="size-4" />
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute inset-x-0 bottom-[-1px] h-[2px] rounded-t-full bg-primary" />
                )}
              </button>
            ))}
          </div>

          {detailLoading && !detail ? (
            <Skeleton className="aspect-video w-full rounded-xl" />
          ) : lessons.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="size-8" />}
              title="No content yet"
              description="This course has no chapters or lessons published."
            />
          ) : (
            <>
              {activeTab === 'learn' && currentLesson && (
                <div className="flex w-full min-w-0 flex-col gap-4">
                  <LessonViewer
                    lesson={currentLesson}
                    onComplete={() => void completeLesson(currentLesson)}
                    onPositionSave={(seconds) => void markLesson(currentLesson, 'in-progress', seconds)}
                  />

                  {courseComplete && (
                    <Card className="w-full min-w-0 overflow-hidden border-emerald-500/20 bg-gradient-to-r from-emerald-500/[0.08] via-card to-card shadow-sm">
                      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                            <Award className="size-4" />
                          </span>
                          <div>
                            <p className="text-sm font-bold text-foreground">Course complete</p>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {courseCertificate
                                ? 'Congratulations! Your certificate of completion has been issued and is available for download.'
                                : 'You have completed all lessons in this course. You can now download your certificate of completion.'}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            className="shrink-0 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={downloadingCert || claimingCertificate}
                            onClick={() => void handleDownloadCertificate()}
                          >
                            {downloadingCert || claimingCertificate ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Download className="size-4" />
                            )}
                            Download certificate
                          </Button>
                          {(assessments?.length ?? 0) > 0 && (
                            <Button variant="outline" className="shrink-0 gap-2" onClick={goToQuiz}>
                              {courseCertificate ? 'Review assessment' : 'Start assessment'} <ChevronRight className="size-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {currentLesson.status === 'completed' && hasNext && (
                    <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/40">
                      <div className="flex items-center gap-2 text-sm font-medium text-emerald-900 dark:text-emerald-100">
                        <CheckCircle2 className="size-4 text-emerald-600" />
                        Lesson complete{advanceIn !== null ? `. The next lesson starts in ${advanceIn}s` : ''}
                      </div>
                      <div className="flex items-center gap-2">
                        {advanceIn !== null && (
                          <Button variant="ghost" size="sm" onClick={() => setAdvance(null)}>
                            Stay here
                          </Button>
                        )}
                        <Button size="sm" className="gap-1" onClick={() => { setAdvance(null); goNext() }}>
                          Next lesson <ChevronRight className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex w-full min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        {currentLesson.chapterName}
                      </p>
                      <h3 className="text-base font-bold leading-snug text-foreground">
                        {currentLesson.title ?? 'Untitled lesson'}
                      </h3>
                      {currentLesson.description && (
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {currentLesson.description}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button variant="outline" size="sm" disabled={!hasPrevious} onClick={goPrevious} className="gap-1">
                        <ChevronLeft className="size-3.5" /> Previous
                      </Button>
                      <Button size="sm" disabled={!hasNext} onClick={goNext} className="gap-1">
                        Next <ChevronRight className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <Button
                    variant={currentLesson.status === 'completed' ? 'outline' : 'default'}
                    className="gap-2 self-start"
                    disabled={savingProgress || currentLesson.status === 'completed'}
                    onClick={() => void completeLesson(currentLesson)}
                  >
                    {savingProgress ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    {currentLesson.status === 'completed' ? 'Completed' : 'Mark as complete'}
                  </Button>
                </div>
              )}

              {activeTab === 'contents' && (
                <div className="flex w-full min-w-0 flex-col gap-4">
                  {canAuthor && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 self-start"
                      onClick={() => setAuthoringTarget({ kind: 'chapter', mode: 'create' })}
                    >
                      <Plus className="size-3.5" /> Add chapter
                    </Button>
                  )}

                  {detail?.chapters.map((chapter) => (
                    <div key={chapter.id} className="overflow-hidden rounded-lg border border-border/60">
                      <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-4 py-2.5">
                        <h4 className="truncate text-sm font-bold text-foreground">
                          {chapter.chapter_name ?? 'Untitled chapter'}
                        </h4>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            {chapter.completed_content}/{chapter.total_content}
                          </span>
                          {canAuthor && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="size-7 p-0"
                                aria-label="Add lesson"
                                onClick={() =>
                                  setAuthoringTarget({
                                    kind: 'content',
                                    mode: 'create',
                                    chapterId: chapter.id,
                                  })
                                }
                              >
                                <Plus className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="size-7 p-0"
                                aria-label="Edit chapter"
                                onClick={() =>
                                  setAuthoringTarget({ kind: 'chapter', mode: 'edit', chapter })
                                }
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="size-7 p-0 text-destructive hover:text-destructive"
                                aria-label="Delete chapter"
                                onClick={() =>
                                  setDeleteTarget({
                                    kind: 'chapter',
                                    id: chapter.id,
                                    label: chapter.chapter_name ?? 'this chapter',
                                  })
                                }
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col divide-y divide-border/50">
                        {chapter.content.length === 0 ? (
                          <p className="px-4 py-3 text-xs text-muted-foreground">No lessons in this chapter.</p>
                        ) : (
                          chapter.content.map((item) => (
                            <div key={item.id} className="flex items-center">
                            <button
                              type="button"
                              disabled={item.is_locked}
                              title={
                                item.is_locked
                                  ? 'Finish the previous lesson to unlock this one.'
                                  : undefined
                              }
                              onClick={() => {
                                selectLesson(item.id)
                                setActiveTab('learn')
                              }}
                              className={cn(
                                'flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                                item.is_locked
                                  ? 'cursor-not-allowed opacity-55'
                                  : 'hover:bg-muted/40',
                                currentLesson?.id === item.id && 'bg-primary/5',
                              )}
                            >
                              {item.is_locked ? (
                                <Lock className="size-4 text-muted-foreground/50" />
                              ) : (
                                STATUS_ICON[item.status]
                              )}
                              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                                {item.title ?? 'Untitled lesson'}
                              </span>
                              {item.content_category && (
                                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  {item.content_category}
                                </span>
                              )}
                            </button>

                            {canAuthor && (
                              <div className="flex shrink-0 items-center gap-1 pr-3">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="size-7 p-0"
                                  aria-label="Edit lesson"
                                  onClick={() =>
                                    setAuthoringTarget({
                                      kind: 'content',
                                      mode: 'edit',
                                      chapterId: chapter.id,
                                      content: item,
                                    })
                                  }
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="size-7 p-0 text-destructive hover:text-destructive"
                                  aria-label="Delete lesson"
                                  onClick={() =>
                                    setDeleteTarget({
                                      kind: 'content',
                                      id: item.id,
                                      label: item.title ?? 'this lesson',
                                    })
                                  }
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'assessments' && (
                <AssessmentsTab
                  assessments={assessments}
                  loading={assessmentsLoading}
                  onTakeQuiz={goToQuiz}
                  onDownloadCertificate={() => void handleDownloadCertificate()}
                  downloadingCert={downloadingCert || claimingCertificate}
                />
              )}

              {activeTab === 'notes' && (
                <NotesTab
                  notes={notes}
                  loading={notesLoading}
                  currentLesson={currentLesson}
                  onCreate={(note, contentId, chapterId) =>
                    void createNote({ note, content_id: contentId, chapter_id: chapterId })
                  }
                  onUpdate={(id, note) => void updateNote(id, note)}
                  onDelete={(id) => void deleteNote(id)}
                />
              )}

              {activeTab === 'discussions' && (
                <DiscussionsTab
                  discussions={discussions}
                  loading={discussionsLoading}
                  currentUserId={user?.id}
                  canModerate={canModerate}
                  onPost={(body) => void postDiscussion(body)}
                  onReply={(id, body) => void replyToDiscussion(id, body)}
                  onDelete={(id) => void deleteDiscussion(id)}
                />
              )}
            </>
          )}
      </div>

      <ChapterFormSheet
        open={authoringTarget !== null}
        onOpenChange={(next) => !next && setAuthoringTarget(null)}
        target={authoringTarget}
        categories={detail?.content_categories ?? []}
        saving={authoringSaving}
        onSubmit={async (values) => {
          if (!authoringTarget) return { ok: false, message: 'Nothing to save.' }

          return authoringTarget.kind === 'chapter'
            ? saveChapter(values, authoringTarget.chapter?.id)
            : saveContent(values, authoringTarget.chapterId, authoringTarget.content?.id)
        }}
      />

      <AuthoringDeleteDialog
        target={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            if (deleteTarget.kind === 'chapter') void removeChapter(deleteTarget.id)
            else void removeContent(deleteTarget.id)
          }
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}
