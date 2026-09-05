'use client'

/**
 * The three LMS reports.
 *
 * One component per menu row (Employee Analysis, Quiz Progress, Question-wise),
 * sharing a shell so the three read as one family rather than three screens
 * that happen to sit together.
 *
 * ── WHAT THESE ARE FOR ──────────────────────────────────────────────────────
 *
 * Not a dashboard. A dashboard says how things are going; these say what to DO:
 * who has stalled, which quiz nobody can pass, which question measures nothing.
 * Every column is chosen to answer one of those, and anything that would only
 * decorate the page is left out.
 */

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Download, GraduationCap, ListChecks, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  lmsReportService,
  type EmployeeAnalysisMeta,
  type EmployeeAnalysisRow,
  type QuestionWiseMeta,
  type QuestionWiseRow,
  type QuizProgressMeta,
  type QuizProgressRow,
} from '@/services/lms'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString()
}

/** Client-side CSV of what is on screen — there is no export endpoint. */
function exportCsv(name: string, headers: string[], rows: (string | number | null)[][]) {
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const body = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n')

  const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

/* ─── Shell ────────────────────────────────────────────────────────────────── */

function ReportShell({
  title,
  description,
  stats,
  loading,
  error,
  onRetry,
  onExport,
  children,
}: {
  title: string
  description: string
  stats: { label: string; value: string | number; warn?: boolean }[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onExport?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {onExport && (
          <Button variant="outline" className="gap-2" onClick={onExport} disabled={loading}>
            <Download className="size-4" /> Export
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label} className="rounded-xl border-border/80 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground">{stat.label}</p>
              {loading ? (
                <Skeleton className="mt-1.5 h-7 w-12" />
              ) : (
                <h3
                  className={cn(
                    'mt-1 text-2xl font-black tracking-tight',
                    stat.warn && stat.value !== 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-foreground',
                  )}
                >
                  {stat.value}
                </h3>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {error ? (
        <ErrorState title={`Couldn't load ${title}`} description={error} retry={onRetry} />
      ) : loading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          {children}
        </div>
      )}
    </div>
  )
}

/** One hook shape for all three, so they load and fail identically. */
function useReport<T, M>(load: (context: ReturnType<typeof getLaravelContext>) => Promise<{ data: T[]; meta: M }>) {
  const { user } = useAuth()
  const [rows, setRows] = useState<T[]>([])
  const [meta, setMeta] = useState<M | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async () => {
    const context = getLaravelContext(user)

    if (!isLaravelContextReady(context)) {
      setLoading(false)
      setError('Your session has expired. Sign in again.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await load(context)
      setRows(response.data ?? [])
      setMeta(response.meta)
    } catch (loadError) {
      setError(toMessage(loadError, 'The report could not be built.'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [load, user])

  useEffect(() => {
    queueMicrotask(() => {
      void run()
    })
  }, [run])

  return { rows, meta, loading, error, retry: run }
}

/* ─── 1. Employee analysis ─────────────────────────────────────────────────── */

export function LmsEmployeeAnalysisReport() {
  const load = useCallback(
    (context: ReturnType<typeof getLaravelContext>) => lmsReportService.employeeAnalysis(context),
    [],
  )
  const { rows, meta, loading, error, retry } = useReport<EmployeeAnalysisRow, EmployeeAnalysisMeta>(load)

  return (
    <ReportShell
      title="Employee Analysis"
      description="What each learner has been given, what they have finished, and when they were last learning."
      loading={loading}
      error={error}
      onRetry={retry}
      onExport={() =>
        exportCsv(
          'employee-analysis',
          ['Learner', 'Employee no', 'Department', 'Enrolled', 'Completed', 'Completion %',
            'Lessons', 'Hours', 'Quiz attempts', 'Quizzes passed', 'Certificates', 'Last activity'],
          rows.map((r) => [
            r.learner_name, r.employee_no, r.department, r.enrolled, r.completed, r.completion_rate,
            r.lessons_completed, r.hours_spent, r.quiz_attempts, r.quizzes_passed, r.certificates,
            r.last_activity,
          ]),
        )
      }
      stats={[
        { label: 'Learners', value: meta?.learners ?? 0 },
        { label: 'Enrolments', value: meta?.enrolled ?? 0 },
        { label: 'Completed', value: meta?.completed ?? 0 },
        { label: 'Hours learned', value: meta?.hours_spent ?? 0 },
        { label: 'Certificates', value: meta?.certificates ?? 0 },
      ]}
    >
      {rows.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" />}
          title="Nobody is enrolled yet"
          description="Once learners are enrolled on courses, their progress appears here."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold">Learner</TableHead>
                <TableHead className="font-semibold">Department</TableHead>
                <TableHead className="text-right font-semibold">Enrolled</TableHead>
                <TableHead className="text-right font-semibold">Completed</TableHead>
                <TableHead className="text-right font-semibold">Lessons</TableHead>
                <TableHead className="text-right font-semibold">Hours</TableHead>
                <TableHead className="text-right font-semibold">Quizzes passed</TableHead>
                <TableHead className="text-right font-semibold">Certificates</TableHead>
                <TableHead className="font-semibold">Last active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.user_id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{row.learner_name}</span>
                      {row.employee_no && (
                        <span className="text-xs text-muted-foreground">{row.employee_no}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.department ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.enrolled}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="font-semibold">{row.completed}</span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({row.completion_rate}%)
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.lessons_completed}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.hours_spent}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.quizzes_passed}
                    {row.quiz_attempts > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        / {row.quiz_attempts}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.certificates}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(row.last_activity)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </ReportShell>
  )
}

/* ─── 2. Quiz progress ─────────────────────────────────────────────────────── */

export function LmsQuizProgressReport() {
  const load = useCallback(
    (context: ReturnType<typeof getLaravelContext>) => lmsReportService.quizProgress(context),
    [],
  )
  const { rows, meta, loading, error, retry } = useReport<QuizProgressRow, QuizProgressMeta>(load)

  return (
    <ReportShell
      title="Quiz Progress"
      description="How each quiz is performing — and which ones cannot be sat at all."
      loading={loading}
      error={error}
      onRetry={retry}
      onExport={() =>
        exportCsv(
          'quiz-progress',
          ['Quiz', 'Course', 'Questions', 'Marks', 'Pass mark', 'Attempts', 'Learners',
            'Passes', 'Pass rate %', 'Mean %', 'Best %', 'Worst %', 'Awaiting review'],
          rows.map((r) => [
            r.paper_name, r.course_name, r.questions, r.total_marks, r.passing_score, r.attempts,
            r.learners, r.passes, r.pass_rate, r.mean_percent, r.best_percent, r.worst_percent,
            r.awaiting_review,
          ]),
        )
      }
      stats={[
        { label: 'Quizzes', value: meta?.papers ?? 0 },
        { label: 'Unusable', value: meta?.unusable ?? 0, warn: true },
        { label: 'Attempts', value: meta?.attempts ?? 0 },
        { label: 'Passes', value: meta?.passes ?? 0 },
        { label: 'Awaiting marking', value: meta?.awaiting_review ?? 0, warn: true },
      ]}
    >
      {rows.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="size-8" />}
          title="No quizzes yet"
          description="Add a quiz to a course in the Course Builder and it will appear here."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold">Quiz</TableHead>
                <TableHead className="text-right font-semibold">Questions</TableHead>
                <TableHead className="text-right font-semibold">Attempts</TableHead>
                <TableHead className="text-right font-semibold">Learners</TableHead>
                <TableHead className="text-right font-semibold">Pass rate</TableHead>
                <TableHead className="text-right font-semibold">Mean</TableHead>
                <TableHead className="text-right font-semibold">Range</TableHead>
                <TableHead className="font-semibold">Last attempt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.paper_id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-foreground">{row.paper_name}</span>
                      {row.course_name && (
                        <span className="text-xs text-muted-foreground">{row.course_name}</span>
                      )}
                      {/*
                        * The single most useful thing this report can say. A
                        * quiz with no questions is not "unattempted" — it
                        * cannot be sat, and the author almost certainly thinks
                        * it works.
                        */}
                      {row.unusable && (
                        <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="size-3.5" />
                          No questions — learners cannot sit this
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.questions}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.attempts}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.learners}</TableCell>
                  <TableCell className="text-right">
                    {/* Null is "nobody has sat it", which is not 0%. */}
                    {row.pass_rate === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <StatusBadge
                        variant={row.pass_rate >= 70 ? 'active' : row.pass_rate >= 40 ? 'pending' : 'inactive'}
                        size="sm"
                      >
                        {row.pass_rate}%
                      </StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.mean_percent === null ? '—' : `${row.mean_percent}%`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.worst_percent === null
                      ? '—'
                      : `${row.worst_percent}–${row.best_percent}%`}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(row.last_attempt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </ReportShell>
  )
}

/* ─── 3. Question-wise ─────────────────────────────────────────────────────── */

export function LmsQuestionWiseReport() {
  const [paperId, setPaperId] = useState('')
  const [papers, setPapers] = useState<{ label: string; value: string }[]>([])
  const { user } = useAuth()

  const load = useCallback(
    (context: ReturnType<typeof getLaravelContext>) =>
      lmsReportService.questionWise(context, paperId ? Number(paperId) : undefined),
    [paperId],
  )
  const { rows, meta, loading, error, retry } = useReport<QuestionWiseRow, QuestionWiseMeta>(load)

  // The quiz list, so a report on 300 questions can be narrowed to one paper.
  useEffect(() => {
    const context = getLaravelContext(user)
    if (!isLaravelContextReady(context)) return

    void lmsReportService
      .quizProgress(context)
      .then((response) =>
        setPapers(
          (response.data ?? []).map((p) => ({
            label: p.paper_name ?? `Quiz #${p.paper_id}`,
            value: String(p.paper_id),
          })),
        ),
      )
      .catch(() => setPapers([]))
  }, [user])

  return (
    <ReportShell
      title="Question-wise Analysis"
      description="How often each question is answered correctly — the report that improves a quiz."
      loading={loading}
      error={error}
      onRetry={retry}
      onExport={() =>
        exportCsv(
          'question-wise',
          ['Quiz', 'Question', 'Marks', 'Answered', 'Correct', 'Correct %', 'Unmarked', 'Mean score'],
          rows.map((r) => [
            r.paper_name, r.question_title, r.points, r.answered, r.correct, r.correct_rate,
            r.unmarked, r.mean_score,
          ]),
        )
      }
      stats={[
        { label: 'Questions', value: meta?.questions ?? 0 },
        { label: 'Answers', value: meta?.answered ?? 0 },
        { label: 'Never answered', value: meta?.unanswered_questions ?? 0 },
        { label: 'Too easy', value: meta?.too_easy ?? 0, warn: true },
        { label: 'Too hard', value: meta?.too_hard ?? 0, warn: true },
      ]}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-border/60 bg-muted/10 p-4">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Quiz
        </span>
        <div className="w-full sm:w-80">
          <Select
            options={[{ label: 'All quizzes', value: '' }, ...papers]}
            value={paperId}
            onChange={(value) => setPaperId(String(value))}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="size-8" />}
          title="No questions to analyse"
          description={meta?.note ?? 'Questions appear here once a quiz has some.'}
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold">Question</TableHead>
                <TableHead className="text-right font-semibold">Marks</TableHead>
                <TableHead className="text-right font-semibold">Answered</TableHead>
                <TableHead className="text-right font-semibold">Correct</TableHead>
                <TableHead className="text-right font-semibold">Correct rate</TableHead>
                <TableHead className="font-semibold">Reading</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.question_id} className="hover:bg-muted/30">
                  <TableCell className="max-w-md">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-foreground">{row.question_title}</span>
                      {!paperId && row.paper_name && (
                        <span className="text-xs text-muted-foreground">{row.paper_name}</span>
                      )}
                      {row.unmarked > 0 && (
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                          {row.unmarked} answer{row.unmarked === 1 ? '' : 's'} awaiting marking —
                          not counted as wrong
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.points}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.answered}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.correct}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.correct_rate === null ? '—' : `${row.correct_rate}%`}
                  </TableCell>
                  <TableCell>
                    {/*
                      * Say what the number MEANS. A rate on its own leaves the
                      * author to work out whether 97% is good news; it is not,
                      * it means the question separates nobody from anybody.
                      */}
                    {row.correct_rate === null ? (
                      <span className="text-xs text-muted-foreground">Not yet answered</span>
                    ) : row.correct_rate >= 95 ? (
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        Too easy — measures nothing
                      </span>
                    ) : row.correct_rate <= 20 ? (
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        Almost nobody gets this — check the wording
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Discriminating well</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </ReportShell>
  )
}
