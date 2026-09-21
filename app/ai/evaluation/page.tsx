'use client'

/**
 * AI Evaluation — test sets, runs and scores.
 *
 * A static route, so it takes precedence over `app/ai/[capability]/page.tsx`.
 *
 * WHY THE PER-CASE VERDICT IS SHOWN AND NOT JUST THE SCORE
 *
 * A score of 0.67 tells an author that something regressed and nothing about what. The
 * verdict names the assertion that failed — "missing &ldquo;199&rdquo;", "contains
 * &ldquo;Priya&rdquo;, which it must not" — which is the difference between a number
 * somebody argues with and a number somebody acts on.
 *
 * WHY RUNNING WARNS ABOUT TIME
 *
 * Each case is one provider call, made in sequence with the request held open. There
 * is no queue behind this, so a twenty-case run genuinely takes a while, and a button
 * that looked instant would read as broken. The screen says so before the click.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'

import {
  createEvaluation,
  deleteEvaluation,
  fetchEvaluation,
  fetchEvaluationOptions,
  fetchEvaluations,
  runEvaluation,
  type EvaluationCase,
  type EvaluationCasePayload,
  type EvaluationSummary,
  type EvaluationTemplateOption,
} from '@/lib/intelligence/ai-evaluations'
import { describeAiError } from '@/lib/intelligence/client'

import { CapabilityShell } from '../_components/CapabilityShell'

export default function AiEvaluationPage() {
  return (
    <CapabilityShell slug="evaluation">
      <EvaluationConsole />
    </CapabilityShell>
  )
}

interface CaseDraft {
  label: string
  /** Newline-separated `key=value`, which is how an author actually types a bag. */
  variables: string
  /** One phrase per line. */
  expectContains: string
  expectAbsent: string
}

const BLANK_CASE: CaseDraft = { label: '', variables: '', expectContains: '', expectAbsent: '' }

function EvaluationConsole() {
  const [templates, setTemplates] = useState<EvaluationTemplateOption[]>([])
  const [maxCases, setMaxCases] = useState(25)
  const [rows, setRows] = useState<EvaluationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const [openId, setOpenId] = useState<number | null>(null)
  const [detail, setDetail] = useState<{ evaluation: EvaluationSummary; cases: EvaluationCase[] } | null>(null)
  const [running, setRunning] = useState(false)

  const [form, setForm] = useState<{
    name: string
    description: string
    templateKey: string
    cases: CaseDraft[]
  } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    Promise.all([fetchEvaluationOptions(), fetchEvaluations()])
      .then(([options, list]) => {
        if (cancelled) return
        setTemplates(options.templates)
        setMaxCases(options.max_cases)
        setRows(list.evaluations)
        setError('')
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(describeAiError(cause))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  /*
   * Matched against the selection at render time rather than cleared in the effect.
   * Clearing is a synchronous setState inside an effect, and matching also stops a
   * slow response for one evaluation rendering under another's heading.
   */
  useEffect(() => {
    if (openId === null) return

    let cancelled = false

    fetchEvaluation(openId)
      .then((data) => {
        if (!cancelled) setDetail(data)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(describeAiError(cause))
      })

    return () => {
      cancelled = true
    }
  }, [openId, reloadToken])

  /** The detail only counts as loaded when it is the one that was asked for. */
  const shownDetail = detail?.evaluation?.id === openId ? detail : null

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  const run = async (id: number) => {
    setRunning(true)
    setError('')
    setNotice('')

    try {
      const result = await runEvaluation(id)
      setNotice(
        result.evaluation.status === 'completed'
          ? `Run complete — ${result.evaluation.passed_count} of ${result.evaluation.case_count} passed.`
          : 'Run finished with failures.',
      )
      reload()
    } catch (cause) {
      setError(describeAiError(cause))
    } finally {
      setRunning(false)
    }
  }

  const remove = async (id: number) => {
    if (!window.confirm('Delete this evaluation and its cases? This cannot be undone.')) return

    try {
      await deleteEvaluation(id)
      setOpenId(null)
      setNotice('Evaluation deleted.')
      reload()
    } catch (cause) {
      setError(describeAiError(cause))
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form) return

    setSaving(true)
    setError('')

    try {
      await createEvaluation({
        name: form.name.trim(),
        description: form.description.trim() || null,
        template_key: form.templateKey,
        cases: form.cases.map(toCasePayload),
      })

      setForm(null)
      setNotice('Evaluation saved. Run it to get a score.')
      reload()
    } catch (cause) {
      setError(describeAiError(cause))
    } finally {
      setSaving(false)
    }
  }

  if (loading && rows.length === 0 && error === '') {
    return (
      <div className="mt-8 flex items-center gap-2 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading evaluations…
      </div>
    )
  }

  return (
    <section className="mt-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Evaluations</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            A set of cases against one published template. Each case says what a correct answer must
            contain and must not contain, so a score is reproducible and explainable.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            disabled={templates.length === 0}
            onClick={() =>
              setForm({
                name: '',
                description: '',
                templateKey: templates[0]?.template_key ?? '',
                cases: [{ ...BLANK_CASE }],
              })
            }
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <Plus className="size-3.5" />
            New evaluation
          </button>
        </div>
      </header>

      {templates.length === 0 && (
        <p className="mt-4 rounded-md border border-dashed border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
          There are no published templates to evaluate.{' '}
          <Link href="/ai/prompts" className="font-medium text-primary hover:underline">
            Publish one in Template Management
          </Link>{' '}
          first — evaluating a draft measures something nobody can run yet.
        </p>
      )}

      {notice && (
        <p className="mt-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <Check className="size-4" />
          {notice}
        </p>
      )}

      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {form && (
        <EvaluationForm
          form={form}
          setForm={setForm}
          templates={templates}
          maxCases={maxCases}
          saving={saving}
          onSubmit={submit}
          onCancel={() => setForm(null)}
        />
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {rows.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              No evaluations yet.
            </li>
          )}
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setOpenId(row.id)}
                className={`flex w-full items-start gap-2 px-4 py-3 text-left transition-colors hover:bg-muted ${
                  openId === row.id ? 'bg-muted' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{row.name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <RunStatus status={row.status} />
                    <ScoreChip score={row.score} passed={row.passed_count} total={row.case_count} />
                  </p>
                </div>
                <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>

        <div className="min-w-0">
          {openId === null || shownDetail === null ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground">
              Select an evaluation to see its cases and results.
            </p>
          ) : (
            <EvaluationDetail
              detail={shownDetail}
              running={running}
              maxCases={maxCases}
              onRun={() => run(shownDetail.evaluation.id)}
              onDelete={() => remove(shownDetail.evaluation.id)}
            />
          )}
        </div>
      </div>
    </section>
  )
}

function EvaluationDetail({
  detail,
  running,
  maxCases,
  onRun,
  onDelete,
}: {
  detail: { evaluation: EvaluationSummary; cases: EvaluationCase[] }
  running: boolean
  maxCases: number
  onRun: () => void
  onDelete: () => void
}) {
  const { evaluation, cases } = detail

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-card-foreground">{evaluation.name}</h3>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              {evaluation.template_key}
              {evaluation.template_version && ` v${evaluation.template_version}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onRun}
              disabled={running}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {running ? 'Running…' : 'Run'}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-destructive hover:bg-destructive/10"
              aria-label="Delete evaluation"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>

        {evaluation.description && (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{evaluation.description}</p>
        )}

        {/* Said before the click, not after. See the file note. */}
        <p className="mt-2 text-xs text-muted-foreground">
          Running makes one model call per case, in sequence — {cases.length} call
          {cases.length === 1 ? '' : 's'}. Up to {maxCases} cases per evaluation.
        </p>

        {evaluation.status !== 'draft' && (
          <dl className="mt-3 grid gap-2 sm:grid-cols-3">
            <Metric label="Score" value={evaluation.score === null ? '—' : evaluation.score.toFixed(2)} />
            <Metric label="Passed" value={`${evaluation.passed_count} / ${evaluation.case_count}`} />
            <Metric
              label="Model"
              value={evaluation.model ?? '—'}
            />
            <Metric
              label="Tokens"
              value={`${evaluation.total_input_tokens} in / ${evaluation.total_output_tokens} out`}
            />
            <Metric
              label="Duration"
              value={evaluation.duration_ms === null ? '—' : `${(evaluation.duration_ms / 1000).toFixed(1)}s`}
            />
            <Metric label="Finished" value={evaluation.finished_at?.slice(0, 16) ?? '—'} />
          </dl>
        )}

        {evaluation.error && (
          <p className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {evaluation.error}
          </p>
        )}
      </section>

      <section className="space-y-3">
        {cases.map((testCase) => (
          <article key={testCase.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h4 className="text-sm font-medium text-card-foreground">{testCase.label}</h4>
              {testCase.passed === null ? (
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Not run
                </span>
              ) : (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    testCase.passed
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-destructive/30 bg-destructive/10 text-destructive'
                  }`}
                >
                  {testCase.passed ? 'PASS' : 'FAIL'}
                  {testCase.score !== null && ` · ${testCase.score.toFixed(2)}`}
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              {testCase.expect_contains.length > 0 && (
                <span>must contain: {testCase.expect_contains.map((s) => `"${s}"`).join(', ')}</span>
              )}
              {testCase.expect_absent.length > 0 && (
                <span>must not contain: {testCase.expect_absent.map((s) => `"${s}"`).join(', ')}</span>
              )}
            </div>

            {/* The reason, not just the number. */}
            {testCase.verdict && (
              <p className="mt-2 text-xs leading-5 text-foreground">{testCase.verdict}</p>
            )}

            {testCase.error && (
              <p className="mt-2 text-xs leading-5 text-destructive">{testCase.error}</p>
            )}

            {testCase.output && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                  What the model returned
                  {testCase.output_tokens !== null && ` (${testCase.output_tokens} tokens)`}
                </summary>
                <pre className="mt-1.5 overflow-x-auto rounded-md border border-border bg-background p-3 text-[11px] leading-5 whitespace-pre-wrap text-muted-foreground">
                  {testCase.output}
                </pre>
              </details>
            )}
          </article>
        ))}
      </section>
    </div>
  )
}

function EvaluationForm({
  form,
  setForm,
  templates,
  maxCases,
  saving,
  onSubmit,
  onCancel,
}: {
  form: { name: string; description: string; templateKey: string; cases: CaseDraft[] }
  setForm: (next: { name: string; description: string; templateKey: string; cases: CaseDraft[] }) => void
  templates: EvaluationTemplateOption[]
  maxCases: number
  saving: boolean
  onSubmit: (event: React.FormEvent) => void
  onCancel: () => void
}) {
  const selected = templates.find((template) => template.template_key === form.templateKey)

  const patchCase = (index: number, changes: Partial<CaseDraft>) => {
    const cases = [...form.cases]
    cases[index] = { ...cases[index], ...changes }
    setForm({ ...form, cases })
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">New evaluation</h3>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Name</span>
          <input
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Competency summary grounding check"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Template under test</span>
          <select
            value={form.templateKey}
            onChange={(event) => setForm({ ...form, templateKey: event.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          >
            {templates.map((template) => (
              <option key={template.template_key} value={template.template_key}>
                {template.name} (v{template.version}) — {template.module_label}
              </option>
            ))}
          </select>
          {selected && selected.grounding_variables.length > 0 && (
            <span className="mt-1.5 block text-xs text-muted-foreground">
              Supply at least{' '}
              {selected.grounding_variables.map((key) => `${key}=…`).join(' and ')} in each case, or
              the template has nothing to work from.
            </span>
          )}
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-medium text-foreground">
          What this measures (optional)
        </span>
        <input
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        />
      </label>

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-foreground">
            Cases ({form.cases.length} of {maxCases})
          </h4>
          <button
            type="button"
            disabled={form.cases.length >= maxCases}
            onClick={() => setForm({ ...form, cases: [...form.cases, { ...BLANK_CASE }] })}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            Add case
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {form.cases.map((testCase, index) => (
            <div key={index} className="rounded-md border border-border bg-background p-3">
              <div className="flex items-center gap-2">
                <input
                  required
                  value={testCase.label}
                  onChange={(event) => patchCase(index, { label: event.target.value })}
                  placeholder="What this case checks"
                  className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-ring"
                />
                {form.cases.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setForm({ ...form, cases: form.cases.filter((_, i) => i !== index) })
                    }
                    className="shrink-0 rounded-md border border-border p-2 text-muted-foreground hover:text-foreground"
                    aria-label="Remove case"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] text-muted-foreground">
                    Variables (one key=value per line)
                  </span>
                  <textarea
                    rows={4}
                    value={testCase.variables}
                    onChange={(event) => patchCase(index, { variables: event.target.value })}
                    placeholder={'records=- Root Cause Analysis\nmetrics=Competencies: 199'}
                    className="w-full rounded-md border border-border bg-card px-2 py-1.5 font-mono text-[11px] outline-none focus:border-ring"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-muted-foreground">
                    Must contain (one per line)
                  </span>
                  <textarea
                    rows={4}
                    value={testCase.expectContains}
                    onChange={(event) => patchCase(index, { expectContains: event.target.value })}
                    placeholder={'199'}
                    className="w-full rounded-md border border-border bg-card px-2 py-1.5 font-mono text-[11px] outline-none focus:border-ring"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-muted-foreground">
                    Must NOT contain (one per line)
                  </span>
                  <textarea
                    rows={4}
                    value={testCase.expectAbsent}
                    onChange={(event) => patchCase(index, { expectAbsent: event.target.value })}
                    placeholder={'500'}
                    className="w-full rounded-md border border-border bg-card px-2 py-1.5 font-mono text-[11px] outline-none focus:border-ring"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

/**
 * A draft case as the API wants it.
 *
 * Variables are typed as `key=value` lines because that is how somebody writes a bag
 * of them by hand; a JSON textarea would make a malformed brace the most common
 * failure on this screen.
 */
function toCasePayload(draft: CaseDraft): EvaluationCasePayload {
  const variables: Record<string, string> = {}

  for (const line of draft.variables.split('\n')) {
    const separator = line.indexOf('=')

    if (separator <= 0) continue

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1)

    if (key !== '') variables[key] = value
  }

  const lines = (value: string) =>
    value
      .split('\n')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '')

  return {
    label: draft.label.trim(),
    variables,
    expect_contains: lines(draft.expectContains),
    expect_absent: lines(draft.expectAbsent),
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <dt className="text-[10px] tracking-widest text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}

function RunStatus({ status }: { status: string }) {
  const tone =
    status === 'completed'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : status === 'failed'
        ? 'border-destructive/30 bg-destructive/10 text-destructive'
        : status === 'running'
          ? 'border-primary/30 bg-primary/10 text-primary'
          : 'border-border bg-muted text-muted-foreground'

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${tone}`}>
      {status}
    </span>
  )
}

function ScoreChip({ score, passed, total }: { score: number | null; passed: number; total: number }) {
  if (score === null) {
    return <span className="text-muted-foreground">not run</span>
  }

  return (
    <span className="tabular-nums text-muted-foreground">
      {score.toFixed(2)} · {passed}/{total} passed
    </span>
  )
}
