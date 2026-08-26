'use client'

import { useCallback, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle, Check, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { CompetencyGap } from '@/services/competency/gap'
import { getLaravelContext } from '@/lib/laravel-context'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  competencyLibraryService,
  type CompetencyProficiencyLevel,
  type CompetencyLibraryItem,
  type CompetencyLibraryPayload,
} from '@/services/competency/library'
import { CompetencyForm } from '@/domain/competency/competency-form'
import { apiClient } from '@/services/core'
import { competencyLibrariesService } from '@/services/competency/libraries'
/**
 * ⚠ TWO TYPES DESCRIBE THIS ONE RESPONSE.
 *
 * `KasbaRatingItem` (imported below) and `RatableItem` in
 * `services/competency/kasba-rating` are both the item shape of
 * `GET /competency/kasba-rating`. This one is the more complete of the two — it
 * declares `title` and `title_missing`, which the other omitted even though the
 * API has always sent them.
 *
 * The drawer is this component's only consumer, so it takes the drawer's type.
 * Collapsing the two into one is worth doing and is NOT done here: it touches
 * every other caller of `RatableItem`, and a type refactor buried inside a UI
 * change is how unrelated things break together.
 */
import type { KasbaRatingItem } from '@/services/organization/employee-profile-service'

/**
 * COMPETENCY FIRST, KASBA UNDERNEATH.
 *
 * ── WHAT THIS REPLACES ──────────────────────────────────────────────────────
 *
 * The drawer had THREE competency surfaces: a rating tab built from
 * `/competency/kasba-rating`, an "Expected Competency" tab built from a
 * different controller entirely, and a job-role skill tab. Two competency
 * sources in one drawer, and **neither was the gap engine** — which is why
 * "expected competency" never agreed with anything.
 *
 * Both grouped by KASBA dimension into five flat lists. That is the atom view,
 * and it is backwards: a person is assessed AGAINST A COMPETENCY, and the atoms
 * are how that number was arrived at.
 *
 * ── THE TWO SOURCES, AND WHY BOTH ───────────────────────────────────────────
 *
 *   gap    -> the rolled-up level, state and coverage per competency
 *   items  -> the KASBA atoms, their targets and any existing rating
 *
 * The roll-up is **not** recomputed here. Averaging the item ratings in the
 * browser would be four lines and would be a SECOND IMPLEMENTATION of
 * `ProficiencyService::rollUp` — the exact defect that service exists to
 * prevent. The weighted average that excludes unmeasured items lives on the
 * server; this screen asks for it.
 *
 * ── UNMEASURED IS NOT ZERO ──────────────────────────────────────────────────
 *
 * The single easiest thing here to get wrong. `measured_level: null` means
 * nobody has assessed it — not that they scored 0, and not that they passed.
 * It renders as "Not assessed" everywhere, and `coverage` is shown whenever a
 * level speaks for only part of a competency.
 */

interface CompetencyAssessmentTabProps {
  gap: CompetencyGap | null
  items: KasbaRatingItem[]
  isLoading: boolean
  error: string | null
  onRetry: () => void
  /**
   * Persists one rating. Rejects with a readable message.
   *
   * THE WHOLE ITEM IS PASSED, not just an id, because the caller needs to
   * choose the write path. A KASBA atom is knowledge somebody has or has not —
   * so rating "Anatomy of the airway" must count in EVERY competency that
   * bundles it, which is what `/competency/kasba-rating/by-item` does, keyed on
   * (kasba_type, item_id). Rating by `kasba_item_id` instead would let one atom
   * hold different scores in different competencies, which is incoherent.
   *
   * Items with a NULL `item_id` are held labels that resolve to no library row,
   * and those can only be written by `kasba_item_id`. The caller decides.
   *
   * `note` is optional evidence for the assessment. Both write endpoints have
   * always validated it (`nullable|string|max:2000`); nothing ever sent one.
   */
  onSave: (item: KasbaRatingItem, rating: number, note?: string) => Promise<void>
  /**
   * Opens this competency in the Competency Library.
   *
   * The DEFINITION is not edited here on purpose: a competency's bundle,
   * weights and scale are shared by every employee assessed against it, so
   * changing one from inside one person's drawer would quietly change everyone
   * else's measurement. This is a way out to the screen that owns it.
   */
  onEditDefinition?: (competencyId: number) => void
  /**
   * May this user edit a competency's DEFINITION?
   *
   * ⚠ THIS ONLY HIDES UI. The route carries `profile:admin,hr` matched on the
   * exact `role_key`, and the server returns 403 whatever this screen renders.
   * The value here is derived by SUBSTRING from a profile display name
   * (`mapProfileNameToRole`) — the very matching the server stopped doing. It
   * is good enough to hide a button and must never become the thing that
   * decides.
   */
  canEditDefinition?: boolean
  /** Re-read after a definition change: weights move every rolled-up level. */
  onDefinitionSaved?: () => void
  /** True when empty is a normal state rather than a fault. */
  emptyIsExpected?: boolean
  emptyReason?: string | null
  ratingRange?: { min: number; max: number }
}

const DIMENSION_ORDER = ['knowledge', 'ability', 'skill', 'behaviour', 'attitude']

function dimensionRank(type: string) {
  const i = DIMENSION_ORDER.indexOf((type || '').toLowerCase())
  return i === -1 ? DIMENSION_ORDER.length : i
}

/** The name to show. `title` is resolved server-side; `item_label` is the fallback. */
function itemTitle(item: KasbaRatingItem): string {
  if (item.title_missing) return 'Library item missing'
  return item.title ?? item.item_label ?? 'Untitled'
}

/** `weight` arrives as a decimal string from the driver. 1 when absent. */
function itemWeight(item: KasbaRatingItem): number {
  const w = Number(item.weight)
  return Number.isFinite(w) && w > 0 ? w : 1
}

/**
 * THE ROLL-UP, WRITTEN OUT — not recomputed.
 *
 * `ProficiencyService` computes the level on the server and this component
 * shows that number, unchanged. What is built here is the *sentence* that
 * explains it: `(3×3 + 3×2) ÷ 6 = 2.5`.
 *
 * Deliberately NOT used as the value. If this string's arithmetic ever
 * disagreed with the server's level, the level is right and this is wrong —
 * which is exactly why the two are kept visibly side by side rather than one
 * being derived from the other.
 */
function rollUpWorking(items: KasbaRatingItem[]): string | null {
  const measured = items.filter((i) => i.rating != null)
  if (measured.length === 0) return null

  const terms = measured.map((i) => `${itemWeight(i)}×${i.rating}`).join(' + ')
  const denominator = measured.reduce((sum, i) => sum + itemWeight(i), 0)
  const numerator = measured.reduce((sum, i) => sum + itemWeight(i) * (i.rating as number), 0)

  return `(${terms}) ÷ ${denominator} = ${Number((numerator / denominator).toFixed(2))}`
}

/** "12 Aug 2026" from an ISO-ish timestamp, or null. */
function shortDate(value: string | null): string | null {
  if (!value) return null
  const d = new Date(value.replace(' ', 'T'))
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function CompetencyAssessmentTab({
  gap,
  items,
  isLoading,
  error,
  onRetry,
  onSave,
  onEditDefinition,
  canEditDefinition = false,
  onDefinitionSaved,
  emptyIsExpected,
  emptyReason,
  ratingRange = { min: 1, max: 5 },
}: CompetencyAssessmentTabProps) {
  const [openId, setOpenId] = useState<number | null>(null)
  const [savingItem, setSavingItem] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  /**
   * Which atom's note is being edited, and its draft text.
   *
   * One at a time: a note belongs to a single assessment, and keeping several
   * open invites saving the wrong one. `null` means no note editor is open.
   */
  const [noteFor, setNoteFor] = useState<number | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

  /**
   * L1–L5 descriptors per competency, fetched when one is expanded.
   *
   * ON DEMAND, not with the tab: most competencies are never expanded, and
   * five descriptors each across twenty competencies is a lot of text nobody
   * asked for. Cached by competency id so re-opening one costs nothing.
   *
   * A failure here is silent by design — the descriptors are context, and a
   * competency whose scale has not loaded still shows its target, level and
   * atoms. Blocking the assessment on optional prose would be the wrong trade.
   */
  const [levels, setLevels] = useState<Record<number, CompetencyProficiencyLevel[]>>({})

  /**
   * The competency being edited, fetched in full.
   *
   * The DEFINITION editor needs the whole record - bundle, weights, detail
   * columns, levels and now `usage` - which the gap payload does not carry.
   * So opening the editor re-reads it rather than assembling a partial record
   * that would then be saved back as a REPLACE and lose the rest.
   */
  const [editingDefinition, setEditingDefinition] = useState<CompetencyLibraryItem | null>(null)
  const [loadingDefinition, setLoadingDefinition] = useState<number | null>(null)
  const [savingDefinition, setSavingDefinition] = useState(false)
  const [definitionError, setDefinitionError] = useState<string | null>(null)
  /** Frameworks and library items the editor needs for its selects. */
  const [formMeta, setFormMeta] = useState<{
    frameworks: { id: number; name: string }[]
    itemOptionsByType: Record<string, { id: number; title: string }[]>
    departments: string[]
  }>({ frameworks: [], itemOptionsByType: {}, departments: [] })

  /**
   * Frameworks and the five KASBA libraries, loaded ONCE and only when an
   * admin actually opens the editor.
   *
   * Six requests is a lot to spend on a drawer most people open to read a
   * rating. Each dimension is loaded independently so one failure does not
   * blank the others - the same approach the Competency Library screen takes.
   * A dimension that fails simply offers no library items; the author can
   * still type a held label, which is a valid item.
   */
  const loadFormMeta = useCallback(async () => {
    if (formMeta.frameworks.length || Object.keys(formMeta.itemOptionsByType).length) return
    const ctx = getLaravelContext()

    apiClient
      .get<{ data?: { id: number; name: string }[] }>('/competency/frameworks', {
        sub_institute_id: ctx.subInstituteId,
        ...(ctx.token ? { type: 'api', token: ctx.token } : {}),
      })
      .then((res) => setFormMeta((m) => ({
        ...m,
        frameworks: (res?.data ?? []).map((f) => ({ id: Number(f.id), name: String(f.name) })),
      })))
      .catch(() => setFormMeta((m) => ({ ...m, frameworks: [] })))

    for (const kind of ['skill', 'knowledge', 'ability', 'attitude', 'behaviour'] as const) {
      competencyLibrariesService
        .list(ctx, kind, { per_page: 500 })
        .then((res: { data?: Array<Record<string, unknown>> }) => {
          const opts = (res?.data ?? [])
            .map((r) => ({ id: Number(r.id), title: String(r.title ?? '') }))
            .filter((o) => o.id && o.title)
          setFormMeta((m) => ({ ...m, itemOptionsByType: { ...m.itemOptionsByType, [kind]: opts } }))
        })
        .catch(() => setFormMeta((m) => ({ ...m, itemOptionsByType: { ...m.itemOptionsByType, [kind]: [] } })))
    }
  }, [formMeta.frameworks.length, formMeta.itemOptionsByType])

  const openDefinition = useCallback(async (competencyId: number) => {
    setLoadingDefinition(competencyId); setDefinitionError(null)
    void loadFormMeta()
    try {
      const res = await competencyLibraryService.get(getLaravelContext(), competencyId)
      setEditingDefinition(res.data)
    } catch (err) {
      setDefinitionError(err instanceof Error ? err.message : 'Could not open this competency.')
    } finally {
      setLoadingDefinition(null)
    }
  }, [loadFormMeta])

  const saveDefinition = useCallback(async (payload: CompetencyLibraryPayload) => {
    if (!editingDefinition) return { ok: false, message: 'Nothing to save.' }
    setSavingDefinition(true); setDefinitionError(null)
    try {
      await competencyLibraryService.update(getLaravelContext(), editingDefinition.id, payload)
      /*
       * RE-READ, ALWAYS. A weight change re-computes the roll-up, so leaving
       * the tab showing the old level beside the new weights is the one state
       * guaranteed to look like a bug. The level cache for this competency is
       * dropped too, since its descriptors may have changed.
       */
      setLevels((prev) => {
        const next = { ...prev }
        delete next[editingDefinition.id]
        return next
      })
      setEditingDefinition(null)
      onDefinitionSaved?.()
      return { ok: true, message: 'Competency updated.' }
    } catch (err) {
      // 403 when the profile gate refuses - the server decides, not the UI.
      const message = err instanceof Error ? err.message : 'Could not save this competency.'
      setDefinitionError(message)
      return { ok: false, message }
    } finally {
      setSavingDefinition(false)
    }
  }, [editingDefinition, onDefinitionSaved])

  const openCompetency = useCallback((competencyId: number | null) => {
    setOpenId(competencyId)
    if (competencyId == null || levels[competencyId]) return

    competencyLibraryService
      .getLevels(getLaravelContext(), competencyId)
      .then((res) => setLevels((prev) => ({ ...prev, [competencyId]: res.data?.levels ?? [] })))
      .catch(() => setLevels((prev) => ({ ...prev, [competencyId]: [] })))
  }, [levels])

  /** Atoms bucketed under the competency they belong to. */
  const itemsByCompetency = useMemo(() => {
    const map = new Map<number, KasbaRatingItem[]>()
    for (const it of items) {
      if (it.competency_id == null) continue
      const list = map.get(it.competency_id) ?? []
      list.push(it)
      map.set(it.competency_id, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => dimensionRank(a.kasba_type) - dimensionRank(b.kasba_type)
        || itemTitle(a).localeCompare(itemTitle(b)))
    }
    return map
  }, [items])

  /** Mandatory atoms below the bar, so a passing average cannot hide one. */
  const flaggedItems = useMemo(
    () => new Set((gap?.mandatory_below_required ?? []).map(m => m.kasba_item_id)),
    [gap],
  )

  const save = async (item: KasbaRatingItem, rating: number, note?: string) => {
    setSavingItem(item.kasba_item_id)
    setSaveError(null)
    try {
      await onSave(item, rating, note)
      setNoteFor(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save that rating.')
    } finally {
      setSavingItem(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-2">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    )
  }

  if (error) {
    return <ErrorState title="Couldn't load this employee's competencies" description={error} retry={onRetry} className="m-6" />
  }

  const rows = gap?.competencies ?? []

  if (rows.length === 0) {
    // An expected empty is a configuration state, not a fault. Say which.
    return (
      <EmptyState
        icon={<Check className="w-10 h-10" />}
        title={emptyIsExpected ? 'Nothing required of this employee yet' : 'No competencies to show'}
        description={emptyReason
          ?? 'Their job role has no competency requirements defined. Set them in Competency Framework → Role Requirements.'}
        className="m-6"
      />
    )
  }

  const unmeasured = gap?.coverage?.competencies_unmeasured ?? 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-border bg-background px-4 py-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{rows.length}</span> competencies required by this role
          {unmeasured > 0 && (
            <>
              {' · '}
              <span className="font-semibold text-foreground">{unmeasured}</span> not yet assessed
            </>
          )}
        </p>
        {(gap?.mandatory_below_required?.length ?? 0) > 0 && (
          <StatusBadge
            variant="error"
            size="sm"
            label={`${gap!.mandatory_below_required.length} mandatory item${gap!.mandatory_below_required.length === 1 ? '' : 's'} below target`}
          />
        )}
      </div>

      {saveError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {saveError}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {rows.map(row => {
          const open = openId === row.competency_id
          const own = itemsByCompetency.get(row.competency_id) ?? []
          const partial = row.coverage > 0 && row.coverage < 1

          return (
            <div key={row.competency_id} className="rounded-xl border border-border bg-background">
              <div
                onClick={() => openCompetency(open ? null : row.competency_id)}
                className="flex items-center justify-between gap-3 p-3 cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {open ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
                  <span className="text-sm font-semibold text-foreground truncate">{row.competency_name}</span>
                  {row.is_mandatory && <span className="text-[10px] font-bold text-muted-foreground shrink-0" title="Mandatory">MANDATORY</span>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">Target L{row.required_proficiency}</span>

                  {/* NULL is unmeasured. Never 0, never a pass. */}
                  {row.state === 'unmeasured' ? (
                    <StatusBadge variant="default" size="sm" label="Not assessed" />
                  ) : row.state === 'met' ? (
                    <StatusBadge variant="success" size="sm" label={`Met · L${row.measured_level}`} />
                  ) : (
                    <StatusBadge variant="warning" size="sm" label={`L${row.measured_level} · gap ${row.gap}`} />
                  )}

                  {/* A level computed from part of a competency is not a full
                      measurement, and must not read like one. */}
                  {partial && (
                    <span
                      className="text-[10px] font-semibold text-amber-600 dark:text-amber-500"
                      title="This level is based on only part of the competency's weight"
                    >
                      {Math.round(row.coverage * 100)}% measured
                    </span>
                  )}
                </div>
              </div>

              {open && (
                <div className="border-t border-border px-3 py-2 flex flex-col gap-1.5">
                  {/* THE ARITHMETIC, SHOWN.
                      The level above is the server's; this is the working
                      behind it, so a reader can check it rather than trust it.
                      Unmeasured atoms are absent from both sides of the
                      fraction — which is the whole reason a level is not a
                      plain average. */}
                  {(() => {
                    const working = rollUpWorking(own)
                    if (!working) return null
                    return (
                      <p className="rounded-lg bg-muted/40 px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
                        weight × rating, over measured weight &nbsp;·&nbsp;
                        <span className="font-semibold text-foreground">{working}</span>
                        {row.state !== 'unmeasured' && Number(working.split('= ')[1]) !== row.measured_level && (
                          <span className="ml-2 text-amber-600" title="The server's level is authoritative">
                            server says {row.measured_level}
                          </span>
                        )}
                      </p>
                    )
                  })()}

                  {/* WHAT THE LEVELS MEAN.
                      "L2 against a target of L3" is two numbers; the
                      descriptors turn it into a difference in behaviour, which
                      is the thing a development conversation is actually about.
                      Only the two levels in play are shown — printing all five
                      would bury them. */}
                  {(() => {
                    const scale = levels[row.competency_id]
                    if (!scale?.length) return null

                    const at = row.measured_level == null ? null : Math.round(row.measured_level)
                    const wanted = [at, row.required_proficiency].filter(
                      (l): l is number => l != null,
                    )
                    const shown = scale
                      .filter((l) => wanted.includes(l.level))
                      .map((l) => ({ ...l, text: l.descriptor ?? l.default_descriptor }))
                      .filter((l) => l.text)

                    if (!shown.length) return null

                    return (
                      <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/20 px-2 py-1.5">
                        {shown.map((l) => (
                          <p key={l.level} className="text-[11px] leading-relaxed text-muted-foreground">
                            <span className="font-bold text-foreground">L{l.level}</span>
                            {l.level === row.required_proficiency && (
                              <span className="ml-1 text-[9px] font-bold uppercase text-primary">target</span>
                            )}
                            {l.level === at && l.level !== row.required_proficiency && (
                              <span className="ml-1 text-[9px] font-bold uppercase text-muted-foreground">now</span>
                            )}
                            {' — '}{l.text}
                            {/* An inherited descriptor is the organisation's
                                generic wording, not something anybody wrote for
                                this competency. Saying so stops it reading as
                                more specific than it is. */}
                            {!l.is_authored && (
                              <span className="ml-1 text-[10px] italic opacity-70">(organisation default)</span>
                            )}
                          </p>
                        ))}
                      </div>
                    )
                  })()}

                  {own.length === 0 && (
                    <p className="text-xs text-muted-foreground py-1">
                      This competency has no KASBA items bundled, so there is nothing to assess against.
                    </p>
                  )}

                  {/* ADMIN/HR EDIT IN PLACE; EVERYONE ELSE GETS THE WAY OUT.
                      The link is not a lesser version of the editor - the
                      Library owns the definition and can do everything this
                      dialog can, so someone without the gate is sent there
                      rather than shown a control that would 403. */}
                  {canEditDefinition ? (
                    <button
                      onClick={() => void openDefinition(row.competency_id)}
                      disabled={loadingDefinition === row.competency_id}
                      className="self-start text-[11px] font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      {loadingDefinition === row.competency_id
                        ? 'Opening…'
                        : 'Edit this competency’s items, weights or level descriptions →'}
                    </button>
                  ) : onEditDefinition ? (
                    <button
                      onClick={() => onEditDefinition(row.competency_id)}
                      className="self-start text-[11px] font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      Open this competency in the Competency Library →
                    </button>
                  ) : null}

                  {own.map(it => {
                    const flagged = flaggedItems.has(it.kasba_item_id)
                    return (
                      <div
                        key={it.kasba_item_id}
                        className={`flex flex-col gap-1 rounded-lg px-2 py-1.5 ${flagged ? 'bg-destructive/5' : ''}`}
                      >
                       <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground w-16 shrink-0">
                            {it.kasba_type}
                          </span>
                          <span className={`text-sm truncate ${it.title_missing ? 'italic text-destructive' : 'text-foreground'}`}>
                            {itemTitle(it)}
                          </span>
                          {/* Its share of the roll-up. Two atoms rated 3 and 2
                              give 2.5 only because both weigh the same; the
                              weight is what makes that legible. */}
                          <span
                            className="shrink-0 rounded bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground"
                            title={`Weight ${itemWeight(it)} in this competency's roll-up`}
                          >
                            ×{itemWeight(it)}
                          </span>
                          {flagged && (
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-destructive" aria-label="Mandatory and below target" />
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {savingItem === it.kasba_item_id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          ) : (
                            <>
                              {it.rating == null && (
                                <span className="text-[10px] text-muted-foreground mr-1">Not assessed</span>
                              )}
                              {Array.from(
                                { length: ratingRange.max - ratingRange.min + 1 },
                                (_, i) => ratingRange.min + i,
                              ).map(level => (
                                <button
                                  key={level}
                                  onClick={() => void save(it, level)}
                                  title={`Rate ${level}`}
                                  className={`w-6 h-6 rounded text-xs font-bold transition-colors ${
                                    it.rating === level
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
                                  }`}
                                >
                                  {level}
                                </button>
                              ))}

                              {/* A rating without evidence is an opinion. The
                                  write path has always accepted a note; this is
                                  the first thing to send one. */}
                              <button
                                onClick={() => {
                                  setNoteFor(noteFor === it.kasba_item_id ? null : it.kasba_item_id)
                                  setNoteDraft(it.note ?? '')
                                }}
                                title={it.note ? 'Edit the note on this assessment' : 'Add a note'}
                                className={`ml-1 rounded px-1.5 h-6 text-[10px] font-semibold transition-colors ${
                                  it.note
                                    ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                    : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
                                }`}
                              >
                                {it.note ? 'Note' : '+ Note'}
                              </button>
                            </>
                          )}
                        </div>
                       </div>

                       {/* PROVENANCE — who said so, and when. `assessor_id` was
                           always stored and never returned, so a rating could
                           show a date with no way to tell a self-assessment
                           from a manager's. */}
                       {it.rating != null && (it.assessor_name || it.rated_at || it.note) && (
                         <div className="pl-16 flex flex-col gap-0.5">
                           {(it.assessor_name || it.rated_at) && (
                             <p className="text-[10px] text-muted-foreground">
                               Rated{it.assessor_name ? ` by ${it.assessor_name}` : ''}
                               {shortDate(it.rated_at) ? ` · ${shortDate(it.rated_at)}` : ''}
                               {it.source === 'self' ? ' · self-assessment' : ''}
                             </p>
                           )}
                           {it.note && noteFor !== it.kasba_item_id && (
                             <p className="text-[11px] leading-relaxed text-foreground/80 italic">“{it.note}”</p>
                           )}
                         </div>
                       )}

                       {/* The note editor saves through the SAME write as a
                           rating — a note is part of an assessment, not a
                           separate record, so it carries the current rating
                           with it rather than needing its own endpoint. */}
                       {noteFor === it.kasba_item_id && (
                         <div className="pl-16 flex flex-col gap-1.5 pb-1">
                           <textarea
                             value={noteDraft}
                             onChange={e => setNoteDraft(e.target.value)}
                             maxLength={2000}
                             rows={2}
                             placeholder="What did you observe? Evidence for this rating…"
                             className="w-full rounded-lg border border-border bg-background p-2 text-xs"
                             aria-label={`Note for ${itemTitle(it)}`}
                           />
                           <div className="flex items-center gap-2">
                             <Button
                               size="sm"
                               className="h-7 text-xs"
                               // A note needs a rating to attach to. Without one
                               // there is no assessment to annotate.
                               disabled={it.rating == null || savingItem === it.kasba_item_id}
                               onClick={() => void save(it, it.rating as number, noteDraft.trim())}
                             >
                               Save note
                             </Button>
                             <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setNoteFor(null)}>
                               Cancel
                             </Button>
                             {it.rating == null && (
                               <span className="text-[10px] text-muted-foreground">Rate this item first.</span>
                             )}
                           </div>
                         </div>
                       )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onRetry}>Refresh</Button>
      </div>

      {/* THE DEFINITION EDITOR — the SAME component the Competency Library
          uses, so the two screens cannot drift about what a save means. */}
      <Dialog open={!!editingDefinition} onOpenChange={(open) => { if (!open) setEditingDefinition(null) }}>
        <DialogContent className="max-w-3xl p-0 gap-0 rounded-2xl overflow-hidden">
          {editingDefinition && (
            <>
              {/* WHO THIS REACHES, BEFORE THEY CHANGE ANYTHING.
                  The counts are the server's, not a guess. `employees_rated`
                  is the number whose LEVEL moves if a weight changes - the
                  consequence people do not expect from an edit made inside one
                  person's drawer. */}
              <div className="border-b border-amber-500/20 bg-amber-500/10 px-6 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-500">
                  This competency is shared
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300/90">
                  Required by <span className="font-bold">{editingDefinition.usage?.roles_requiring ?? 0}</span>
                  {' '}job role{(editingDefinition.usage?.roles_requiring ?? 0) === 1 ? '' : 's'} ·
                  {' '}<span className="font-bold">{editingDefinition.usage?.employees_rated ?? 0}</span>
                  {' '}employee{(editingDefinition.usage?.employees_rated ?? 0) === 1 ? '' : 's'} already assessed.
                  {(editingDefinition.usage?.employees_rated ?? 0) > 0 && (
                    <> Changing an item or its weight <span className="font-bold">re-scores all of them</span>, not
                    just the person you are looking at.</>
                  )}
                </p>
              </div>

              {definitionError && (
                <div className="border-b border-destructive/20 bg-destructive/5 px-6 py-2 text-xs text-destructive">
                  {definitionError}
                </div>
              )}

              <CompetencyForm
                initial={editingDefinition}
                saving={savingDefinition}
                frameworks={formMeta.frameworks}
                itemOptionsByType={formMeta.itemOptionsByType}
                departments={formMeta.departments}
                onSubmit={saveDefinition}
                onCancel={() => setEditingDefinition(null)}
                onSaved={() => setEditingDefinition(null)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
