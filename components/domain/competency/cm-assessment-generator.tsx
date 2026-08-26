'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, Check, ChevronRight, Layers, Send, Sparkles, Target,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { aiAssessmentService, type GenerateResult, type ScopeOptions } from '@/services/competency/ai-assessment'

/**
 * HR / ADMIN — GENERATE, REVIEW, PUBLISH an AI capability assessment.
 *
 * SECURITY: both endpoints behind this are route-guarded `profile:admin,hr`. An
 * employee reaching this component is refused by middleware before any handler
 * runs — this file renders controls, it does not decide who may use them. The
 * tenant comes from the caller's token, so the job role list and every write are
 * already scoped without this component asking for a tenant.
 *
 * PUBLISHING IS DELIBERATELY A SECOND STEP. An LLM wrote these questions and a
 * person should read them before an employee is assessed on them. generate()
 * creates a DRAFT and nothing reaches anybody until publish is pressed.
 *
 * ── WHY THE SCOPE IS A LIST AND NOT A DROPDOWN ──────────────────────────────
 *
 * KASBA items are sentences — "Building scalable server-side systems and
 * services" — and a <Select> renders one truncated line. The whole point of the
 * item scope is choosing the RIGHT item, which cannot be done from
 * "Building scalable server-side sys…". Rows wrap, so the choice stays readable,
 * and the role's structure is visible without opening anything. It fits because
 * it is small: the largest role on either database holds 5 competencies and
 * 20 items — measured, not assumed.
 *
 * NO NEW PRIMITIVE, AND NOTHING UNDER components/ui IS TOUCHED — the design
 * docs forbid it. SearchableSelect, Select, Input, StatusBadge, Skeleton and
 * Button are composed exactly as they ship.
 */
export function CmAssessmentGenerator() {
  const { user } = useAuth()
  const [roles, setRoles] = useState<{ id: number; name: string; department?: string | null; competency_count: number }[]>([])
  const [rolesNote, setRolesNote] = useState<string | null>(null)
  const [roleId, setRoleId] = useState<string>('')
  const [perItem, setPerItem] = useState<string>('1')
  const [format, setFormat] = useState<string>('both')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [published, setPublished] = useState<string | null>(null)

  const [scopeType, setScopeType] = useState<'jobrole' | 'competency' | 'kasba_item'>('jobrole')
  const [competencyId, setCompetencyId] = useState('')
  const [kasbaItemId, setKasbaItemId] = useState('')
  const [scope, setScope] = useState<ScopeOptions | null>(null)
  const [scopeLoading, setScopeLoading] = useState(false)
  const [scopeFailed, setScopeFailed] = useState(false)
  // Blank on purpose, all three. See the helper text beside each.
  const [timeLimit, setTimeLimit] = useState('')
  const [passPercent, setPassPercent] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const loadRoles = useCallback(async () => {
    try {
      const res = await aiAssessmentService.jobroles(getLaravelContext(user))
      setRoles(res.roles ?? [])
      // Said BEFORE the button is pressed. A role with no competencies is
      // refused by generate(), and offering it then failing is worse than
      // explaining first.
      setRolesNote(res.empty_is_expected ? res.empty_reason : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Job roles could not be loaded.')
    }
  }, [user])

  useEffect(() => { void loadRoles() }, [loadRoles])

  // One request per role, holding everything both pickers need.
  useEffect(() => {
    if (!roleId) { setScope(null); setScopeFailed(false); return }
    let active = true
    setScopeLoading(true); setScopeFailed(false)
    setCompetencyId(''); setKasbaItemId('')
    aiAssessmentService.scopeOptions(Number(roleId), getLaravelContext(user))
      .then((r) => { if (active) setScope(r.data) })
      // A failed lookup is NOT an empty role — the two are said differently below.
      .catch(() => { if (active) { setScope(null); setScopeFailed(true) } })
      .finally(() => { if (active) setScopeLoading(false) })
    return () => { active = false }
  }, [roleId, user])

  const competencies = scope?.competencies ?? []
  const chosenCompetency = competencies.find((c) => String(c.id) === competencyId)

  /*
   * HOW MANY QUESTIONS THIS WILL ASK FOR, BEFORE IT ASKS.
   *
   * Generation calls a paid model. A whole role at 3 questions per item is 60
   * questions; one KASBA item at 1 is one. Those are very different requests
   * and the difference was invisible until the bill arrived.
   */
  const itemCount = scopeType === 'kasba_item'
    ? (kasbaItemId ? 1 : 0)
    : scopeType === 'competency'
      ? (chosenCompetency?.items.length ?? 0)
      : (scope?.total_items ?? 0)
  const questionCount = itemCount * (Number(perItem) || 1)

  const ready = Boolean(roleId)
    && (scopeType !== 'competency' || Boolean(competencyId))
    && (scopeType !== 'kasba_item' || Boolean(kasbaItemId))

  async function generate() {
    if (!roleId) return
    setBusy(true); setError(null); setResult(null); setPublished(null)
    try {
      const res = await aiAssessmentService.generate({
        jobrole_id: Number(roleId),
        formats: format === 'both' ? ['mcq', 'short_answer'] : [format as 'mcq' | 'short_answer'],
        questions_per_item: Number(perItem) || 1,
        scope_type: scopeType,
        competency_id: scopeType === 'competency' ? Number(competencyId) : null,
        kasba_item_id: scopeType === 'kasba_item' ? Number(kasbaItemId) : null,
        // Empty string means "not set", which is not the same as zero.
        time_limit_minutes: timeLimit ? Number(timeLimit) : null,
        pass_percent: passPercent === '' ? null : Number(passPercent),
        is_open: isOpen,
      }, getLaravelContext(user))
      setResult(res)
    } catch (e) {
      // The server refuses BEFORE calling the model when a job role has no
      // competencies mapped, and says so in words. That message is shown as-is
      // rather than replaced with a generic failure, because it names the fix.
      setError(e instanceof Error ? e.message : 'The assessment could not be generated.')
    } finally { setBusy(false) }
  }

  async function publish() {
    if (!result) return
    setBusy(true); setError(null)
    try {
      const res = await aiAssessmentService.publish({ test_id: result.test_id }, getLaravelContext(user))
      // `superseded` MUST be shown. Publishing retires the previous test for
      // this job role, and a screen that does that silently lies about what the
      // button did.
      setPublished(res.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The assessment could not be published.')
    } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-primary/10 bg-card/90 p-5 shadow-sm backdrop-blur-2xl">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Generate a capability assessment
            </h2>
            <p className="text-xs text-muted-foreground">
              Questions are written only for capability items the job role actually requires.
            </p>
          </div>
          <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Draft first — nothing reaches anyone until you publish
          </span>
        </div>

        <div className="flex flex-col gap-5">
          {/* ─────────────────── 1 · WHO IT IS FOR ─────────────────── */}
          <Step number={1} title="Who it is for" icon={Target}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="gen-role">
                  Job role<span className="text-destructive"> *</span>
                </label>
                <SearchableSelect
                  value={roleId}
                  onChange={setRoleId}
                  options={roles.map((r) => ({
                    value: String(r.id),
                    label: r.name,
                    // The second line disambiguates namesakes, and
                    // SearchableSelect matches on it as well as the label.
                    hint: [r.department, r.competency_count > 0
                      ? `${r.competency_count} competenc${r.competency_count === 1 ? 'y' : 'ies'}`
                      : 'nothing mapped yet'].filter(Boolean).join(' · '),
                  }))}
                  placeholder="Search job roles…"
                  aria-label="Job role"
                  className="bg-background"
                />
                <p className="text-xs text-muted-foreground">
                  {roles.length > 0
                    ? `${roles.length} job role${roles.length === 1 ? '' : 's'} in this organisation.`
                    : 'No job roles recorded for this organisation yet.'}
                </p>
              </div>

              <div className="space-y-2">
                <span className="block text-sm font-semibold text-foreground">This role covers</span>
                {!roleId ? (
                  <p className="flex h-9 items-center text-sm text-muted-foreground">
                    Choose a job role to see what it covers.
                  </p>
                ) : scopeLoading ? (
                  <Skeleton className="h-9 w-56 rounded-lg" />
                ) : scope ? (
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium tabular-nums text-primary">
                      {scope.competencies.length} competenc{scope.competencies.length === 1 ? 'y' : 'ies'}
                    </span>
                    <span className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium tabular-nums text-primary">
                      {scope.total_items} KASBA item{scope.total_items === 1 ? '' : 's'}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {scopeFailed
                      ? 'What this role covers could not be read. This is a connection problem, not an empty role.'
                      : 'Nothing is mapped to this job role yet.'}
                  </p>
                )}
              </div>
            </div>
          </Step>

          {/* ─────────────────── 2 · WHAT IT COVERS ─────────────────── */}
          <Step number={2} title="What it covers" icon={Layers}>
            {!roleId ? (
              /* NOT THREE GREYED BUTTONS. A disabled control with no reason
                 beside it reads as a broken screen rather than a next step. */
              <p className="text-sm text-muted-foreground">Choose a job role first.</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {([
                    ['jobrole', 'The whole job role', 'Every item of every competency it requires'],
                    ['competency', 'One competency', 'Every item of a single competency'],
                    ['kasba_item', 'One KASBA item', 'A single knowledge, skill or behaviour'],
                  ] as const).map(([value, label, detail]) => {
                    const active = scopeType === value
                    return (
                      <button key={value} type="button" aria-pressed={active}
                        onClick={() => { setScopeType(value); setCompetencyId(''); setKasbaItemId('') }}
                        className={cn('flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                          active ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-accent')}>
                        <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg',
                          active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                          {active && <Check className="size-3.5" aria-hidden="true" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">{label}</span>
                          <span className="block text-xs text-muted-foreground">{detail}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>

                {scopeType !== 'jobrole' && (
                  <div className="rounded-xl border border-border bg-background p-3">
                    {scopeLoading ? (
                      <div className="flex flex-col gap-2">
                        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
                      </div>
                    ) : scopeFailed ? (
                      <p className="text-sm text-muted-foreground">
                        What this role covers could not be read. This is a connection problem, not an
                        empty role.
                      </p>
                    ) : competencies.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nothing is mapped to this job role, so there is nothing to narrow to.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Competency
                        </p>
                        <ul className="flex flex-col gap-1.5">
                          {competencies.map((c) => {
                            const active = String(c.id) === competencyId
                            return (
                              <li key={c.id}>
                                <button type="button" aria-pressed={active}
                                  onClick={() => { setCompetencyId(String(c.id)); setKasbaItemId('') }}
                                  className={cn('flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                                    active ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent')}>
                                  <span className="min-w-0 flex-1">
                                    <span className={cn('block text-sm font-medium',
                                      active ? 'text-primary' : 'text-foreground')}>{c.name}</span>
                                    <span className="block text-xs tabular-nums text-muted-foreground">
                                      {c.items.length} item{c.items.length === 1 ? '' : 's'}
                                      {c.required_proficiency ? ` · needs level ${c.required_proficiency}` : ''}
                                    </span>
                                  </span>
                                  <ChevronRight className={cn('size-4 shrink-0',
                                    active ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                                </button>
                              </li>
                            )
                          })}
                        </ul>

                        {scopeType === 'kasba_item' && (
                          <>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              KASBA item
                            </p>
                            {!chosenCompetency ? (
                              /* The two kinds of empty say which they are. */
                              <p className="text-sm text-muted-foreground">Choose a competency above first.</p>
                            ) : (
                              <ul className="flex flex-col gap-1.5">
                                {chosenCompetency.items.map((it) => {
                                  const active = String(it.id) === kasbaItemId
                                  return (
                                    <li key={it.id}>
                                      <button type="button" aria-pressed={active}
                                        onClick={() => setKasbaItemId(String(it.id))}
                                        className={cn('flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                                          active ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent')}>
                                        <StatusBadge
                                          variant={active ? 'primary' : 'default'}
                                          label={it.kasba_type} size="sm"
                                          className="mt-0.5 shrink-0 capitalize"
                                        />
                                        {/* WRAPS. This is the reason this is a
                                            list and not a dropdown. */}
                                        <span className={cn('text-sm', active ? 'text-primary' : 'text-foreground')}>
                                          {it.label}
                                        </span>
                                      </button>
                                    </li>
                                  )
                                })}
                              </ul>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </Step>

          {/* ─────────────────── 3 · HOW IT IS SAT ─────────────────── */}
          <Step number={3} title="How it is sat" icon={Send}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="gen-format">Question types</label>
                <Select id="gen-format" value={format} onChange={setFormat} aria-label="Question types"
                  className="h-9 border-border bg-background"
                  options={[
                    { label: 'Multiple choice and written', value: 'both' },
                    { label: 'Multiple choice only', value: 'mcq' },
                    { label: 'Written only', value: 'short_answer' },
                  ]} />
                <p className="text-xs text-muted-foreground">Written answers are marked by AI, then reviewable.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="gen-per-item">Questions per item</label>
                <Select id="gen-per-item" value={perItem} onChange={setPerItem} aria-label="Questions per item"
                  className="h-9 border-border bg-background"
                  options={[1, 2, 3].map((n) => ({
                    label: `${n} question${n === 1 ? '' : 's'} per item`, value: String(n),
                  }))} />
                <p className="text-xs text-muted-foreground">More questions per item, more reliable the result.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="gen-time">
                  Time limit <span className="font-normal text-muted-foreground">(minutes)</span>
                </label>
                <Input id="gen-time" type="number" min={1} max={480} value={timeLimit}
                  onChange={(e) => setTimeLimit(e.target.value)} placeholder="untimed"
                  className="h-9 border-border bg-background" />
                <p className="text-xs text-muted-foreground">Blank means no limit.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="gen-pass">
                  Pass mark <span className="font-normal text-muted-foreground">(%)</span>
                </label>
                <Input id="gen-pass" type="number" min={0} max={100} value={passPercent}
                  onChange={(e) => setPassPercent(e.target.value)} placeholder="none"
                  className="h-9 border-border bg-background" />
                {/* Blank and zero are different tests. */}
                <p className="text-xs text-muted-foreground">Blank reports a score and claims no pass or fail.</p>
              </div>

              <label className="flex items-start gap-2.5 md:col-span-2 xl:col-span-4">
                <input type="checkbox" checked={isOpen} onChange={(e) => setIsOpen(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-border" />
                <span>
                  <span className="block text-sm font-semibold text-foreground">Open to everyone</span>
                  <span className="block text-xs text-muted-foreground">
                    Off means the target job role, plus anyone you assign it to.
                  </span>
                </span>
              </label>
            </div>
          </Step>
        </div>

        {/* ─────────────────── THE COST, THEN THE BUTTON ─────────────────── */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            {!roleId ? 'Choose a job role to begin.'
              : scopeLoading ? 'Reading what this role covers…'
              : itemCount > 0 ? (
                <>
                  <strong className="tabular-nums text-foreground">{itemCount}</strong> item
                  {itemCount === 1 ? '' : 's'} × <strong className="tabular-nums text-foreground">{Number(perItem) || 1}</strong>
                  {' = '}
                  <strong className="tabular-nums text-foreground">
                    {questionCount} question{questionCount === 1 ? '' : 's'}
                  </strong>
                  <span> · this calls a paid model</span>
                </>
              ) : scopeType === 'jobrole' ? 'This role has nothing mapped to assess.'
              : 'Choose the part of the role to assess.'}
          </p>
          <Button onClick={() => void generate()} disabled={busy || !ready}
            className="h-10 gap-2 rounded-xl px-5 font-bold shadow-md shadow-primary/20">
            <Sparkles className="size-4 stroke-[3]" aria-hidden="true" />
            {busy ? 'Working…'
              : questionCount > 0 ? `Generate ${questionCount} question${questionCount === 1 ? '' : 's'}`
              : 'Generate'}
          </Button>
        </div>
      </section>

      {rolesNote && (
        <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {rolesNote}
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {result && (
        <section className="rounded-2xl border border-primary/10 bg-card/90 p-5 shadow-sm backdrop-blur-2xl">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Draft ready</h2>
              <p className="text-xs text-muted-foreground">
                Read the questions in the Assessments tab below before publishing.
              </p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {result.model ?? 'unknown model'} · test #{result.test_id}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Items available" value={result.items_available} />
            <Stat label="Questions requested" value={result.questions_requested} />
            <Stat label="Questions saved" value={result.questions_saved} />
            {/* NEVER SILENT. A dropped question named an item that does not
                exist, or was multiple-choice with a correct answer that was not
                among its own options. */}
            <Stat label="Rejected by the server" value={result.questions_dropped} tone="warning" />
          </div>

          {result.questions_dropped > 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {result.questions_dropped} question(s) named an unknown capability item, or could not be
              scored, and were not saved.
            </p>
          )}

          {published ? (
            <p className="mt-4 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-medium text-success">
              {published}
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={() => void publish()} disabled={busy || result.questions_saved === 0}
                className="h-10 gap-2 rounded-xl px-5 font-bold">
                <Send className="size-4" aria-hidden="true" />
                {busy ? 'Publishing…' : 'Publish to employees'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Read the questions before publishing. Publishing retires any previous assessment for
                this job role.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

/** A numbered section of the form. */
function Step({ number, title, icon: Icon, children }: {
  number: number
  title: string
  icon: typeof Target
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold tabular-nums text-primary">
          {number}
        </span>
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          {title}
        </p>
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'warning' }) {
  return (
    <div className="rounded-xl border border-primary/10 bg-card/60 p-3 shadow-sm backdrop-blur-xl">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums',
        tone === 'warning' && value > 0 ? 'text-warning' : 'text-foreground')}>
        {value}
      </p>
    </div>
  )
}
