'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  Layers,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  UserRound,
  XCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { recruitmentService } from '@/services/talent/recruitment'
import { CandidateAssessmentBlock } from '@/components/domain/talent/recruitment/candidate-assessment-block'
import type {
  AssessmentBlueprintApi,
  AssessmentBlueprintPayload,
  AssessmentJobRoleApi,
  CandidateAssessmentRowApi,
  CandidateAssessmentSummaryApi,
  InvitableApplicationApi,
} from '@/types/recruitment'

/**
 * HR — CANDIDATE ASSESSMENTS, the whole round on one tab.
 *
 * Everything behind this screen already existed and had no way in: the paper
 * generator, the magic-link mint, the AI marking, the pass/fail decision. What
 * was missing was the SETUP. An invitation looks up an "exam template" for the
 * posting's job role and refuses without one, and there was no screen to create
 * one — so the Invite button on the candidate card failed every single time it
 * was pressed, on every organisation.
 *
 * The tab therefore carries two halves and leads with the one that unblocks the
 * other:
 *
 *   Results    — every assessment sent, who sent it, and how it ended.
 *   Templates  — the standing decision per job role: which kinds of question,
 *                how many, out of how many marks, and the mark that qualifies.
 *
 * ── ONE TEMPLATE PER JOB ROLE ───────────────────────────────────────────────
 *
 * A database constraint, not a screen rule, so the form says so up front rather
 * than letting HR fill six fields and then rejecting the save.
 *
 * ── THE TEMPLATE IS NOT THE PAPER ───────────────────────────────────────────
 *
 * A fresh paper is written per invitation, so two candidates for the same role
 * never sit an identical exam they could pass between them. That is why this
 * screen shows a template's SHAPE (types, counts, marks) and never its
 * questions — the questions do not exist until somebody is invited.
 */

const OUTCOMES = [
  { value: '', label: 'Any outcome' },
  { value: 'pass', label: 'Qualified' },
  { value: 'fail', label: 'Not qualified' },
  { value: 'pending', label: 'Awaiting result' },
]

/**
 * Why an invite would fail, said before the button is pressed.
 *
 * Only the first two are dead ends. A posting with no job role, or a role with
 * no template, can still be assessed by choosing a template by hand - which
 * matters because not one posting in the installation had a job role recorded
 * against it until this release.
 */
const BLOCKERS: Record<string, { message: string; fatal: boolean }> = {
  no_email: { message: 'No email address on the application', fatal: true },
  no_posting: { message: 'Not linked to a job posting', fatal: true },
  no_jobrole: { message: 'Its posting has no job role — pick an exam below', fatal: false },
  no_blueprint: { message: 'No template for this role — pick one below', fatal: false },
}

const EMPTY_DRAFT: AssessmentBlueprintPayload = {
  jobrole_id: 0,
  title: '',
  test_types: ['aptitude'],
  question_count: 10,
  total_marks: 100,
  qualification_marks: 40,
  time_limit_minutes: 45,
  is_active: true,
}

function statusVariant(status: string) {
  switch (status) {
    case 'graded':
      return 'success' as const
    case 'submitted':
      return 'processing' as const
    case 'started':
      return 'active' as const
    default:
      return 'pending' as const
  }
}

/** "invited" is what the database calls it; "Link sent" is what HR calls it. */
function statusLabel(status: string) {
  switch (status) {
    case 'invited':
      return 'Link sent'
    case 'started':
      return 'In progress'
    case 'submitted':
      return 'Awaiting result'
    case 'graded':
      return 'Marked'
    default:
      return status
  }
}

function shortDate(value: string | null) {
  if (!value) return '—'
  const parsed = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10)
  return parsed.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

export function CmCandidateAssessments() {
  const [view, setView] = useState<'results' | 'templates'>('results')

  /* -- Report -- */
  const [rows, setRows] = useState<CandidateAssessmentRowApi[]>([])
  const [summary, setSummary] = useState<CandidateAssessmentSummaryApi | null>(null)
  const [jobs, setJobs] = useState<Array<{ id: number; title: string }>>([])
  const [statuses, setStatuses] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [outcome, setOutcome] = useState('')
  const [jobId, setJobId] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  /* -- Templates -- */
  const [blueprints, setBlueprints] = useState<AssessmentBlueprintApi[]>([])
  const [testTypes, setTestTypes] = useState<Record<string, string>>({})
  const [blueprintsLoading, setBlueprintsLoading] = useState(true)

  /* -- Dialogs -- */
  const [openApplicationId, setOpenApplicationId] = useState<number | null>(null)
  const [sendOpen, setSendOpen] = useState(false)
  const [draft, setDraft] = useState<AssessmentBlueprintPayload | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const bump = useCallback(() => setRefreshKey((key) => key + 1), [])

  /* ── the report ───────────────────────────────────────────────────────── */
  const loadReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await recruitmentService.getCandidateAssessments({
        search: search || undefined,
        status: status || undefined,
        outcome: outcome || undefined,
        job_id: jobId || undefined,
        per_page: 50,
      })
      setRows(response.data)
      setSummary(response.summary)
      setJobs(response.jobs)
      setStatuses(response.statuses)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The assessment report could not be loaded.')
      setRows([])
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [search, status, outcome, jobId])

  useEffect(() => {
    // Debounced, because the search box drives it on every keystroke.
    const timer = setTimeout(() => {
      void loadReport()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadReport, refreshKey])

  /* ── the templates ────────────────────────────────────────────────────── */
  const loadBlueprints = useCallback(async () => {
    setBlueprintsLoading(true)
    try {
      const response = await recruitmentService.getAssessmentBlueprints()
      setBlueprints(response.data)
      setTestTypes(response.test_types)
    } catch {
      setBlueprints([])
    } finally {
      setBlueprintsLoading(false)
    }
  }, [])

  useEffect(() => {
    // queueMicrotask, because react-hooks/set-state-in-effect is an ERROR in
    // this repo and loadBlueprints sets its loading flag on its first line.
    queueMicrotask(() => {
      void loadBlueprints()
    })
  }, [loadBlueprints, refreshKey])

  const saveDraft = useCallback(async () => {
    if (!draft) return
    setSaving(true)
    setFormError(null)
    try {
      await recruitmentService.saveAssessmentBlueprint(draft)
      setDraft(null)
      bump()
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'The template could not be saved.')
    } finally {
      setSaving(false)
    }
  }, [draft, bump])

  const removeBlueprint = useCallback(
    async (id: number) => {
      await recruitmentService.deleteAssessmentBlueprint(id)
      bump()
    },
    [bump],
  )

  const rolesWithoutTemplate = useMemo(
    () => rows.filter((row) => !row.blueprint).length,
    [rows],
  )

  return (
    <div className="flex flex-col gap-5">
      {/* ── Heading ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <ClipboardList className="size-5 text-primary" aria-hidden="true" />
            Candidate Assessments
          </h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Set the exam for a job role once, then send it to any candidate applying for that role.
            They sit it from a personal link with no account, and it is marked automatically against
            the qualifying mark you set.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={bump} disabled={loading}>
            <RefreshCw className={cn('mr-1.5 size-3.5', loading && 'animate-spin')} aria-hidden="true" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setSendOpen(true)}>
            <Send className="mr-1.5 size-3.5" aria-hidden="true" />
            Send assessment
          </Button>
        </div>
      </div>

      {/* ── The one thing that stops everything, said once and loudly ───── */}
      {!blueprintsLoading && blueprints.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-foreground">No exam templates yet</p>
              <p className="text-xs text-muted-foreground">
                An assessment cannot be sent until the job role has a template. It takes about a
                minute to set one up.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setView('templates')
              setDraft({ ...EMPTY_DRAFT })
            }}
          >
            <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
            Set up the first one
          </Button>
        </div>
      )}

      {/* ── Inner views ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 rounded-lg bg-muted/40 p-1 self-start">
        {([
          ['results', 'Results', rows.length],
          ['templates', 'Exam templates', blueprints.length],
        ] as const).map(([id, label, count]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={cn(
              'flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors',
              view === id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                view === id ? 'bg-primary/10 text-primary' : 'bg-muted-foreground/10',
              )}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {view === 'results' ? (
        <>
          {/* ── Tiles. Counted server-side over the SAME filtered set as the
                 table, so narrowing the filters narrows these too. ─────── */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {([
              ['Sent', summary?.total ?? 0, Mail, 'text-muted-foreground'],
              ['In progress', (summary?.invited ?? 0) + (summary?.started ?? 0), Clock, 'text-primary'],
              ['Awaiting result', summary?.submitted ?? 0, RefreshCw, 'text-warning-foreground'],
              ['Qualified', summary?.passed ?? 0, CheckCircle2, 'text-success'],
              ['Not qualified', summary?.failed ?? 0, XCircle, 'text-destructive'],
              [
                'Average score',
                summary?.avg_percent === null || summary?.avg_percent === undefined
                  ? '—'
                  : `${summary.avg_percent}%`,
                TrendingUp,
                'text-primary',
              ],
            ] as const).map(([label, value, Icon, tone]) => (
              <div
                key={label}
                className="flex flex-col gap-1 rounded-lg border border-border/60 bg-card p-3 shadow-sm"
              >
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Icon className={cn('size-3.5', tone)} aria-hidden="true" />
                  {label}
                </span>
                <span className="text-2xl font-bold tabular-nums text-foreground">{value}</span>
              </div>
            ))}
          </div>

          {/* ── Filters ─────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                className="h-9 pl-8 text-sm"
                placeholder="Search candidate, email or position…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="w-[170px]">
              <Select
                value={status}
                placeholder="Any stage"
                options={[
                  { value: '', label: 'Any stage' },
                  ...statuses.map((value) => ({ value, label: statusLabel(value) })),
                ]}
                onChange={setStatus}
              />
            </div>
            <div className="w-[170px]">
              <Select value={outcome} placeholder="Any outcome" options={OUTCOMES} onChange={setOutcome} />
            </div>
            <div className="w-[210px]">
              <Select
                value={jobId}
                placeholder="Any position"
                options={[
                  { value: '', label: 'Any position' },
                  ...jobs.map((job) => ({ value: String(job.id), label: job.title })),
                ]}
                onChange={setJobId}
              />
            </div>
            {(search || status || outcome || jobId) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setStatus('')
                  setOutcome('')
                  setJobId('')
                }}
              >
                <SlidersHorizontal className="mr-1.5 size-3.5" aria-hidden="true" />
                Clear
              </Button>
            )}
          </div>

          {error && (
            <p className="flex items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
              <Button variant="outline" size="sm" onClick={bump}>
                Try again
              </Button>
            </p>
          )}

          {/* ── The report ──────────────────────────────────────────────── */}
          <div className="overflow-x-auto rounded-lg border border-border/60 bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Exam</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="w-[190px]">Score</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Sent by</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Marked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading &&
                  rows.length === 0 &&
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={9}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}

                {!loading && rows.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9} className="py-14 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="size-8 text-muted-foreground/40" aria-hidden="true" />
                        <p className="text-sm font-semibold text-foreground">Nothing sent yet</p>
                        <p className="max-w-sm text-xs text-muted-foreground">
                          {blueprints.length === 0
                            ? 'Set up an exam template for a job role first, then candidates for that role can be invited.'
                            : 'Use Send assessment to invite a candidate. Their score and the marking will appear here.'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {rows.map((row) => {
                  const pct =
                    row.score !== null && row.max_score
                      ? Math.round((row.score / row.max_score) * 100)
                      : null
                  const passPct =
                    row.pass_mark !== null && row.max_score
                      ? Math.round((row.pass_mark / row.max_score) * 100)
                      : null

                  return (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => setOpenApplicationId(row.application_id)}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-foreground">{row.candidate}</span>
                          <span className="text-[11px] text-muted-foreground">{row.email ?? '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{row.job_title ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium">{row.blueprint ?? '—'}</span>
                          {row.test_types.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {row.test_types.map((type) => (
                                <span
                                  key={type}
                                  className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                                >
                                  {testTypes[type] ?? type}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={statusVariant(row.status)}>
                          {statusLabel(row.status)}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        {row.score === null || !row.max_score ? (
                          <span className="text-xs text-muted-foreground">Not marked</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-bold tabular-nums text-foreground">
                              {row.score}
                              <span className="text-xs font-normal text-muted-foreground">
                                {' '}
                                / {row.max_score}
                              </span>
                            </span>
                            {/* The pass mark is drawn ON the bar, so a near miss
                                reads as a near miss rather than a number. */}
                            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  'h-full rounded-full',
                                  row.qualified === false ? 'bg-destructive' : 'bg-success',
                                )}
                                style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
                              />
                              {passPct !== null && (
                                <span
                                  className="absolute top-0 h-full w-px bg-foreground/50"
                                  style={{ left: `${Math.min(passPct, 100)}%` }}
                                  title={`Qualifying mark: ${row.pass_mark}`}
                                />
                              )}
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {/* TRI-STATE. null is "being marked", never a fail. */}
                        {row.qualified === null ? (
                          <span className="text-xs text-muted-foreground">Awaiting result</span>
                        ) : row.qualified ? (
                          <StatusBadge variant="success">Qualified</StatusBadge>
                        ) : (
                          <StatusBadge variant="error">Not qualified</StatusBadge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-xs">
                          <UserRound className="size-3 text-muted-foreground" aria-hidden="true" />
                          {row.invited_by ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">{shortDate(row.invited_at)}</TableCell>
                      <TableCell className="text-xs tabular-nums">{shortDate(row.graded_at)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {rows.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {rows.length} of {summary?.total ?? rows.length} shown. Click any row to read the paper,
              the marks and the reasoning behind each one.
              {rolesWithoutTemplate > 0 && ' Rows with no exam name were sent before their template changed.'}
            </p>
          )}
        </>
      ) : (
        /* ── Templates ───────────────────────────────────────────────────── */
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="max-w-2xl text-sm text-muted-foreground">
              One template per job role. It decides what a candidate for that role is asked, and the
              mark they must reach to move on to an interview.
            </p>
            <Button size="sm" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
              <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
              New template
            </Button>
          </div>

          {blueprintsLoading && <Skeleton className="h-28 w-full" />}

          {!blueprintsLoading && blueprints.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-14 text-center">
              <Layers className="size-8 text-muted-foreground/40" aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground">No templates yet</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Pick a job role, choose which kinds of question it should ask, and set the qualifying
                mark. Every candidate for that role can then be assessed.
              </p>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {blueprints.map((blueprint) => (
              <div
                key={blueprint.id}
                className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-bold text-foreground">
                      {blueprint.title || blueprint.jobrole || 'Untitled template'}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {blueprint.jobrole ?? 'Unknown role'}
                      {blueprint.department_name ? ` · ${blueprint.department_name}` : ''}
                    </span>
                  </div>
                  <StatusBadge variant={blueprint.is_active ? 'success' : 'inactive'}>
                    {blueprint.is_active ? 'Active' : 'Paused'}
                  </StatusBadge>
                </div>

                <div className="flex flex-wrap gap-1">
                  {blueprint.test_types.map((type) => (
                    <span
                      key={type}
                      className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
                    >
                      {testTypes[type] ?? type}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-xs">
                  <span className="text-muted-foreground">
                    Questions <b className="text-foreground tabular-nums">{blueprint.question_count}</b>
                  </span>
                  <span className="text-muted-foreground">
                    Total marks <b className="text-foreground tabular-nums">{blueprint.total_marks}</b>
                  </span>
                  <span className="text-muted-foreground">
                    Qualifies at{' '}
                    <b className="text-foreground tabular-nums">{blueprint.qualification_marks}</b>
                  </span>
                  <span className="text-muted-foreground">
                    Time{' '}
                    <b className="text-foreground tabular-nums">
                      {blueprint.time_limit_minutes ? `${blueprint.time_limit_minutes} min` : 'Open'}
                    </b>
                  </span>
                </div>

                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setDraft({
                        id: blueprint.id,
                        department_id: blueprint.department_id,
                        jobrole_id: blueprint.jobrole_id,
                        title: blueprint.title,
                        test_types: blueprint.test_types,
                        question_count: blueprint.question_count,
                        total_marks: blueprint.total_marks,
                        qualification_marks: blueprint.qualification_marks,
                        time_limit_minutes: blueprint.time_limit_minutes,
                        is_active: blueprint.is_active,
                      })
                    }
                  >
                    <Pencil className="mr-1.5 size-3" aria-hidden="true" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => void removeBlueprint(blueprint.id)}
                  >
                    <Trash2 className="mr-1.5 size-3" aria-hidden="true" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── The paper, the marks and the reasoning ────────────────────────
          Reuses the block the candidate card already renders, rather than a
          second copy of the same result view that would drift from it. */}
      <Dialog
        open={openApplicationId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setOpenApplicationId(null)
            bump()
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assessment detail</DialogTitle>
            <DialogDescription>
              The score, the qualifying mark, and the reasoning recorded for every answer.
            </DialogDescription>
          </DialogHeader>
          {openApplicationId !== null && <CandidateAssessmentBlock applicationId={openApplicationId} />}
        </DialogContent>
      </Dialog>

      <SendAssessmentDialog
        blueprints={blueprints}
        open={sendOpen}
        onOpenChange={(open) => {
          setSendOpen(open)
          if (!open) bump()
        }}
      />

      <TemplateDialog
        draft={draft}
        testTypes={testTypes}
        saving={saving}
        error={formError}
        onChange={setDraft}
        onClose={() => {
          setDraft(null)
          setFormError(null)
        }}
        onSave={() => void saveDraft()}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Send an assessment
 * ------------------------------------------------------------------ */

function SendAssessmentDialog({
  open,
  onOpenChange,
  blueprints,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  blueprints: AssessmentBlueprintApi[]
}) {
  const [applications, setApplications] = useState<InvitableApplicationApi[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [hideDone, setHideDone] = useState(true)
  const [sendingId, setSendingId] = useState<number | null>(null)
  const [result, setResult] = useState<{ ok: boolean; message: string; url?: string } | null>(null)
  /* Template chosen by hand, per candidate, when their posting cannot say. */
  const [chosen, setChosen] = useState<Record<number, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await recruitmentService.getInvitableApplications({
        search: search || undefined,
        without_assessment: hideDone,
      })
      setApplications(response.data)
    } catch {
      setApplications([])
    } finally {
      setLoading(false)
    }
  }, [search, hideDone])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      void load()
    }, 250)
    return () => clearTimeout(timer)
  }, [open, load])

  const send = useCallback(
    async (application: InvitableApplicationApi, blueprintId?: number) => {
      setSendingId(application.id)
      setResult(null)
      try {
        const response = await recruitmentService.inviteAssessment(application.id, blueprintId)
        setResult({
          ok: true,
          message: response.message,
          url: response.data?.url,
        })
        await load()
      } catch (cause) {
        setResult({
          ok: false,
          message: cause instanceof Error ? cause.message : 'The assessment could not be sent.',
        })
      } finally {
        setSendingId(null)
      }
    },
    [load],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send an assessment</DialogTitle>
          <DialogDescription>
            A fresh paper is written for the candidate&rsquo;s job role and emailed to them as a
            personal link. They do not need an account, and the link expires in seven days.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="h-9 pl-8 text-sm"
              placeholder="Search candidates…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={hideDone} onCheckedChange={(checked) => setHideDone(checked === true)} />
            Not yet assessed
          </label>
        </div>

        {result && (
          <div
            className={cn(
              'flex flex-col gap-1 rounded-md border px-3 py-2 text-xs',
              result.ok
                ? 'border-success/40 bg-success/10 text-foreground'
                : 'border-destructive/40 bg-destructive/10 text-destructive',
            )}
          >
            <span className="font-semibold">{result.message}</span>
            {result.url && (
              <code className="break-all rounded bg-muted/60 px-2 py-1 text-[10px]">{result.url}</code>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {loading && <Skeleton className="h-24 w-full" />}

          {!loading && applications.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No candidates match. Applications arrive here from the careers page and from
              Recruitment.
            </p>
          )}

          {applications.map((application) => {
            const blocker = application.blocked_reason
              ? BLOCKERS[application.blocked_reason]
              : null
            const needsPick = blocker !== null && !blocker.fatal

            return (
            <div
              key={application.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold text-foreground">{application.name}</span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {application.job_title ?? 'No posting'}
                  {application.email ? ` · ${application.email}` : ''}
                </span>
              </div>

              {blocker?.fatal ? (
                /* Said BEFORE the button is pressed, not as a 422 afterwards. */
                <span className="flex items-center gap-1.5 text-[11px] text-warning-foreground">
                  <AlertTriangle className="size-3" aria-hidden="true" />
                  {blocker.message}
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  {application.has_assessment && (
                    <span className="text-[11px] text-muted-foreground">
                      Already sent · {statusLabel(application.assessment_status ?? '')}
                    </span>
                  )}

                  {/* Only when the posting cannot name the exam itself. Picking
                      one here is what makes a posting with no job role usable
                      without editing it first. */}
                  {needsPick && (
                    <div className="w-[210px]">
                      <Select
                        size="sm"
                        value={chosen[application.id] ?? ''}
                        placeholder={
                          blueprints.length === 0 ? 'No templates yet' : 'Choose an exam…'
                        }
                        disabled={blueprints.length === 0}
                        options={blueprints.map((blueprint) => ({
                          value: String(blueprint.id),
                          label: blueprint.title || blueprint.jobrole || `Template ${blueprint.id}`,
                        }))}
                        onChange={(value) =>
                          setChosen((current) => ({ ...current, [application.id]: value }))
                        }
                      />
                    </div>
                  )}

                  <Button
                    size="sm"
                    disabled={sendingId !== null || (needsPick && !chosen[application.id])}
                    onClick={() =>
                      void send(
                        application,
                        chosen[application.id] ? Number(chosen[application.id]) : undefined,
                      )
                    }
                  >
                    {sendingId === application.id ? (
                      <>
                        <RefreshCw className="mr-1.5 size-3 animate-spin" aria-hidden="true" />
                        Writing questions…
                      </>
                    ) : (
                      <>
                        <Send className="mr-1.5 size-3" aria-hidden="true" />
                        {application.has_assessment ? 'Send again' : 'Send'}
                      </>
                    )}
                  </Button>
                </div>
              )}

              {needsPick && (
                <p className="w-full text-[11px] text-warning-foreground">
                  <AlertTriangle className="mr-1 inline size-3" aria-hidden="true" />
                  {blocker?.message}
                </p>
              )}
            </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ *
 * Create or edit a template
 * ------------------------------------------------------------------ */

function TemplateDialog({
  draft,
  testTypes,
  saving,
  error,
  onChange,
  onClose,
  onSave,
}: {
  draft: AssessmentBlueprintPayload | null
  testTypes: Record<string, string>
  saving: boolean
  error: string | null
  onChange: (draft: AssessmentBlueprintPayload) => void
  onClose: () => void
  onSave: () => void
}) {
  const [roles, setRoles] = useState<AssessmentJobRoleApi[]>([])
  const [rolesLoading, setRolesLoading] = useState(false)

  useEffect(() => {
    if (!draft) return
    let active = true
    queueMicrotask(() => {
      if (!active) return
      setRolesLoading(true)
      recruitmentService
        .getAssessmentJobRoles()
        .then((response) => {
          if (active) setRoles(response.data)
        })
        .catch(() => {
          if (active) setRoles([])
        })
        .finally(() => {
          if (active) setRolesLoading(false)
        })
    })
    return () => {
      active = false
    }
    // Loaded when the dialog opens, not on every keystroke in it.
  }, [draft !== null]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!draft) return null

  const set = (patch: Partial<AssessmentBlueprintPayload>) => onChange({ ...draft, ...patch })

  const toggleType = (type: string) => {
    const next = draft.test_types.includes(type)
      ? draft.test_types.filter((value) => value !== type)
      : [...draft.test_types, type]
    set({ test_types: next })
  }

  /* Checked here so the reason is on screen beside the field, not in a toast. */
  const passTooHigh = draft.qualification_marks > draft.total_marks
  const noTypes = draft.test_types.length === 0
  const noRole = !draft.jobrole_id
  const invalid = passTooHigh || noTypes || noRole

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{draft.id ? 'Edit exam template' : 'New exam template'}</DialogTitle>
          <DialogDescription>
            This sets the shape of the exam, not its questions — a fresh paper is written for each
            candidate, so two people applying for the same role never sit an identical exam.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">Job role</span>
            <SearchableSelect
              value={draft.jobrole_id ? String(draft.jobrole_id) : ''}
              onChange={(value) => set({ jobrole_id: Number(value) })}
              disabled={rolesLoading || Boolean(draft.id)}
              placeholder={rolesLoading ? 'Loading roles…' : 'Search the role catalogue…'}
              options={roles.map((role) => ({
                value: String(role.id),
                label: role.sector ? `${role.jobrole} · ${role.sector}` : role.jobrole,
              }))}
            />
            <span className="text-[11px] text-muted-foreground">
              {draft.id
                ? 'The role cannot be changed on an existing template — create a new one instead.'
                : 'One template per role. If the role already has one, edit that rather than adding a second.'}
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">Name (optional)</span>
            <Input
              className="h-9 text-sm"
              placeholder="e.g. Aptitude round — Laravel Engineer"
              value={draft.title ?? ''}
              onChange={(event) => set({ title: event.target.value })}
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-foreground">What the exam asks</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(testTypes).map(([value, label]) => (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors',
                    draft.test_types.includes(value)
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border/60 text-muted-foreground hover:border-primary/40',
                  )}
                >
                  <Checkbox
                    checked={draft.test_types.includes(value)}
                    onCheckedChange={() => toggleType(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
            {noTypes && (
              <span className="text-[11px] text-destructive">Pick at least one kind of question.</span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">Questions</span>
              <Input
                type="number"
                min={1}
                max={50}
                className="h-9 text-sm"
                value={draft.question_count}
                onChange={(event) => set({ question_count: Number(event.target.value) })}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">Total marks</span>
              <Input
                type="number"
                min={1}
                max={1000}
                className="h-9 text-sm"
                value={draft.total_marks}
                onChange={(event) => set({ total_marks: Number(event.target.value) })}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">Qualifies at</span>
              <Input
                type="number"
                min={0}
                className={cn('h-9 text-sm', passTooHigh && 'border-destructive')}
                value={draft.qualification_marks}
                onChange={(event) => set({ qualification_marks: Number(event.target.value) })}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">Time limit (min)</span>
              <Input
                type="number"
                min={5}
                max={480}
                className="h-9 text-sm"
                placeholder="Open"
                value={draft.time_limit_minutes ?? ''}
                onChange={(event) =>
                  set({ time_limit_minutes: event.target.value ? Number(event.target.value) : null })
                }
              />
            </label>
          </div>

          {passTooHigh && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              The qualifying mark is above the total, so nobody could ever reach it. Lower it to{' '}
              {draft.total_marks} or less.
            </p>
          )}

          <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            A candidate scoring{' '}
            <b className="text-foreground tabular-nums">
              {draft.qualification_marks} of {draft.total_marks}
            </b>{' '}
            or more moves on to an interview automatically. Below that, they are held for you to
            review — nobody is rejected without a person looking.
          </p>

          <label className="flex items-center gap-2 text-xs text-foreground">
            <Checkbox
              checked={draft.is_active !== false}
              onCheckedChange={(checked) => set({ is_active: checked === true })}
            />
            Active — candidates for this role can be assessed
          </label>

          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" disabled={saving || invalid} onClick={onSave}>
              {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Create template'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
