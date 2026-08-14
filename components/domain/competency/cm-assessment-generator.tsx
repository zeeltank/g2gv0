'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { aiAssessmentService, type GenerateResult } from '@/services/competency/ai-assessment'

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
            <Button onClick={() => void generate()} disabled={!roleId || busy}>
              {busy ? 'Working…' : 'Generate'}
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
