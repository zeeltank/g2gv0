'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
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
 * NO NEW PRIMITIVE. Card, Button, Select, Spinner, and a plain table styled from
 * the design tokens — the same construction as kasba-rating-panel.
 */
export function CmAssessmentGenerator() {
  /**
   * SELF-CONTAINED. It fetches its own roles from
   * GET /competency/ai-assessment/jobroles, which was added for exactly this —
   * previously no endpoint returned the tenant's job roles WITH ids, so the list
   * had to be passed in. It no longer does, so this component takes no props and
   * can be mounted anywhere an admin or HR user can reach.
   */
  const { user } = useAuth()
  const [roles, setRoles] = useState<{ id: number; name: string; competency_count: number }[]>([])
  const [rolesNote, setRolesNote] = useState<string | null>(null)
  const [roleId, setRoleId] = useState<string>('')
  const [perItem, setPerItem] = useState<string>('1')
  const [format, setFormat] = useState<string>('both')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [published, setPublished] = useState<string | null>(null)

  /*
   * WHAT THE TEST IS ABOUT.
   *
   * The API has accepted three scopes for a while; this form only ever sent a
   * job role, so "every KASBA item of every competency this role requires" was
   * the only test anybody could build. That is the right default and a poor
   * only option: it is also the most expensive generation and the longest sitting.
   */
  const [scopeType, setScopeType] = useState<'jobrole' | 'competency' | 'kasba_item'>('jobrole')
  const [competencyId, setCompetencyId] = useState('')
  const [kasbaItemId, setKasbaItemId] = useState('')
  const [scope, setScope] = useState<ScopeOptions | null>(null)
  const [scopeLoading, setScopeLoading] = useState(false)
  // Blank on purpose, all three. See the notes beside each control.
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

  useEffect(() => {
    void loadRoles()
  }, [loadRoles])

  // One request per role, holding everything the pickers need. The largest role
  // on either database has 5 competencies and 20 items, so there is nothing to
  // paginate and nothing to search.
  useEffect(() => {
    if (!roleId) { setScope(null); return }
    let active = true
    setScopeLoading(true)
    setCompetencyId('')
    setKasbaItemId('')
    aiAssessmentService.scopeOptions(Number(roleId), getLaravelContext(user))
      .then((r) => { if (active) setScope(r.data) })
      .catch(() => { if (active) setScope(null) })
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

  async function generate() {
    if (!roleId) return
    setBusy(true)
    setError(null)
    setResult(null)
    setPublished(null)
    try {
      const res = await aiAssessmentService.generate(
        {
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
        },
        getLaravelContext(user),
      )
      setResult(res)
    } catch (e) {
      // The server refuses BEFORE calling the model when a job role has no
      // competencies mapped, and says so in words. That message is shown as-is
      // rather than replaced with a generic failure, because it names the fix:
      // add them in Role Requirements.
      setError(e instanceof Error ? e.message : 'The assessment could not be generated.')
    } finally {
      setBusy(false)
    }
  }

  async function publish() {
    if (!result) return
    setBusy(true)
    setError(null)
    try {
      const res = await aiAssessmentService.publish({ test_id: result.test_id }, getLaravelContext(user))
      // `superseded` MUST be shown. Publishing retires the previous test for
      // this job role, and a screen that does that silently lies about what the
      // button did.
      setPublished(res.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The assessment could not be published.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold">Generate a capability assessment</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Questions are written only for capability items this job role actually requires. A role
              with nothing mapped is refused rather than given a test about nothing.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <Select
              options={[
                { label: 'Select a job role', value: '' },
                ...roles.map((r) => ({ label: r.competency_count > 0 ? r.name + ' (' + r.competency_count + ')' : r.name + ' — no competencies', value: String(r.id) })),
              ]}
              value={roleId}
              onChange={setRoleId}
              placeholder="Job role"
              className="h-9 w-64 bg-background"
            />
            <Select
              options={[
                { label: 'Multiple choice and written', value: 'both' },
                { label: 'Multiple choice only', value: 'mcq' },
                { label: 'Written only', value: 'short_answer' },
              ]}
              value={format}
              onChange={setFormat}
              placeholder="Question types"
              className="h-9 w-56 bg-background"
            />
            <Select
              options={[1, 2, 3].map((n) => ({ label: `${n} question per item`, value: String(n) }))}
              value={perItem}
              onChange={setPerItem}
              placeholder="Per item"
              className="h-9 w-44 bg-background"
            />
          </div>

          {/* ── WHAT THE TEST IS ABOUT ──────────────────────────────────── */}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs font-semibold text-foreground">What should this assessment cover?</p>

            <div className="flex w-fit items-center rounded-lg border bg-background p-0.5 text-xs font-medium">
              {([
                ['jobrole', 'The whole job role'],
                ['competency', 'One competency'],
                ['kasba_item', 'One KASBA item'],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" disabled={!roleId}
                  onClick={() => { setScopeType(value); setCompetencyId(''); setKasbaItemId('') }}
                  className={cn('rounded-md px-3 py-1.5 transition disabled:opacity-40',
                    scopeType === value ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  {label}
                </button>
              ))}
            </div>

            {scopeType !== 'jobrole' && (
              <div className="flex flex-wrap items-end gap-2">
                <Select
                  options={[
                    { label: scopeLoading ? 'Loading…' : 'Select a competency', value: '' },
                    ...competencies.map((c) => ({
                      label: `${c.name} (${c.items.length} item${c.items.length === 1 ? '' : 's'})`,
                      value: String(c.id),
                    })),
                  ]}
                  value={competencyId}
                  onChange={(v) => { setCompetencyId(v); setKasbaItemId('') }}
                  /* Disabled until a role is chosen: an enabled empty select
                     reads as "there is nothing" rather than "choose the thing
                     above first". */
                  disabled={!roleId || scopeLoading}
                  placeholder="Competency"
                  className="h-9 w-72 bg-background"
                />

                {scopeType === 'kasba_item' && (
                  <Select
                    options={[
                      { label: 'Select a KASBA item', value: '' },
                      ...(chosenCompetency?.items ?? []).map((it) => ({
                        label: `[${it.kasba_type}] ${it.label}`,
                        value: String(it.id),
                      })),
                    ]}
                    value={kasbaItemId}
                    onChange={setKasbaItemId}
                    disabled={!competencyId}
                    placeholder="KASBA item"
                    className="h-9 w-96 bg-background"
                  />
                )}
              </div>
            )}

            {/* The size of what is about to be asked for, before it is asked. */}
            {roleId && (
              <p className="text-xs text-muted-foreground">
                {itemCount > 0
                  ? <>This will ask for <strong className="text-foreground">{itemCount} item(s) × {Number(perItem) || 1} = {questionCount} question(s)</strong>. Generation calls a paid model.</>
                  : scopeLoading ? 'Reading what this role covers…'
                    : scopeType === 'jobrole' ? 'This role has nothing mapped to assess.'
                      : 'Choose the part of the role to assess.'}
              </p>
            )}
          </div>

          {/* ── HOW IT IS SAT ───────────────────────────────────────────── */}
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/20 p-3">
            <label className="text-xs font-medium text-muted-foreground">
              Time limit (minutes)
              <input type="number" min={1} max={480} value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)} placeholder="untimed"
                className="mt-1 block h-9 w-32 rounded-md border bg-background px-2 text-sm" />
              <span className="mt-0.5 block text-[11px]">Blank = no limit.</span>
            </label>

            <label className="text-xs font-medium text-muted-foreground">
              Pass mark (%)
              <input type="number" min={0} max={100} value={passPercent}
                onChange={(e) => setPassPercent(e.target.value)} placeholder="none"
                className="mt-1 block h-9 w-32 rounded-md border bg-background px-2 text-sm" />
              {/* Blank and zero are different tests, and a placeholder cannot
                  carry that on its own. */}
              <span className="mt-0.5 block text-[11px]">Blank = reports a score, claims no pass or fail.</span>
            </label>

            <label className="flex items-center gap-2 pb-1 text-xs font-medium text-muted-foreground">
              <input type="checkbox" checked={isOpen} onChange={(e) => setIsOpen(e.target.checked)} />
              <span>
                Open to everyone
                <span className="block text-[11px] font-normal">
                  Off = the target job role, plus anyone assigned.
                </span>
              </span>
            </label>
          </div>

          <div>
            <Button
              onClick={() => void generate()}
              /* Cannot be pressed into a request the server would refuse. */
              disabled={busy || !roleId
                || (scopeType === 'competency' && !competencyId)
                || (scopeType === 'kasba_item' && !kasbaItemId)}
            >
              {busy ? 'Working…' : questionCount > 0 ? `Generate ${questionCount} question(s)` : 'Generate'}
            </Button>
          </div>
        </div>
      </Card>

      {rolesNote && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">{rolesNote}</p>
      )}

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {result && (
        <Card className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">
                Draft ready — {result.questions_saved} question(s)
              </h3>
              <span className="font-mono text-xs text-muted-foreground">
                model {result.model ?? 'unknown'} · test #{result.test_id}
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[30rem] text-sm">
                <tbody>
                  <tr className="border-b border-border">
                    <td className="px-3 py-2 text-muted-foreground">Capability items available</td>
                    <td className="px-3 py-2 tabular-nums">{result.items_available}</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="px-3 py-2 text-muted-foreground">Questions requested</td>
                    <td className="px-3 py-2 tabular-nums">{result.questions_requested}</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="px-3 py-2 text-muted-foreground">Questions saved</td>
                    <td className="px-3 py-2 tabular-nums">{result.questions_saved}</td>
                  </tr>
                  <tr>
                    {/* NEVER SILENT. A dropped question named an item that does
                        not exist, or was a multiple-choice question whose correct
                        answer was not among its own options. */}
                    <td className="px-3 py-2 text-muted-foreground">Rejected by the server</td>
                    <td className="px-3 py-2 tabular-nums">
                      {result.questions_dropped}
                      {result.questions_dropped > 0 && (
                        <span className="ml-2 text-xs text-warning">
                          questions that named an unknown item or could not be scored
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void publish()} disabled={busy || !!published}>
                {published ? 'Published' : 'Publish to employees'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Read the questions before publishing. Nothing reaches an employee until you do.
              </p>
            </div>

            {published && (
              <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm">
                {published}
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
