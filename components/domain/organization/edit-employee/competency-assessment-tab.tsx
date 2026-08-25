'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle, Check, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { CompetencyGap } from '@/services/competency/gap'
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
   */
  onSave: (item: KasbaRatingItem, rating: number) => Promise<void>
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

export function CompetencyAssessmentTab({
  gap,
  items,
  isLoading,
  error,
  onRetry,
  onSave,
  emptyIsExpected,
  emptyReason,
  ratingRange = { min: 1, max: 5 },
}: CompetencyAssessmentTabProps) {
  const [openId, setOpenId] = useState<number | null>(null)
  const [savingItem, setSavingItem] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

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

  const save = async (item: KasbaRatingItem, rating: number) => {
    setSavingItem(item.kasba_item_id)
    setSaveError(null)
    try {
      await onSave(item, rating)
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
                onClick={() => setOpenId(open ? null : row.competency_id)}
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
                  {own.length === 0 && (
                    <p className="text-xs text-muted-foreground py-1">
                      This competency has no KASBA items bundled, so there is nothing to assess against.
                    </p>
                  )}

                  {own.map(it => {
                    const flagged = flaggedItems.has(it.kasba_item_id)
                    return (
                      <div
                        key={it.kasba_item_id}
                        className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 ${flagged ? 'bg-destructive/5' : ''}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground w-16 shrink-0">
                            {it.kasba_type}
                          </span>
                          <span className={`text-sm truncate ${it.title_missing ? 'italic text-destructive' : 'text-foreground'}`}>
                            {itemTitle(it)}
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
                            </>
                          )}
                        </div>
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
    </div>
  )
}
