'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Target, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isLaravelContextReady, getLaravelContext } from '@/lib/laravel-context'
import {
  myRatingService,
  type MyCapabilityCompetency,
  type MyCapabilityItem,
} from '@/services/competency/my-rating'

/**
 * SELF-RATING — an employee recording their own view of their capability.
 *
 * ── WHY IT LIVES HERE ───────────────────────────────────────────────────────
 *
 * The only rating UI in the product was `KasbaRatingPanel`, mounted inside the
 * Employee Directory. Employees do not have that menu, so self-rating was
 * unreachable by the people it is for — and the endpoints behind it are
 * `profile:admin,hr`, so reaching it would only have produced a 403.
 *
 * This screen already means "my own capability" and already carries the
 * employee's identity from their token. Putting the control here needs no new
 * menu, no new rights row, and no subject parameter.
 *
 * ── A SELF-RATING IS AN OPINION, NOT AN ASSESSMENT ──────────────────────────
 *
 * It is stored with `source = 'self'` and never overwrites an assessor's
 * verdict; where one exists the server refuses and says so. The panel says the
 * same thing in words BEFORE anyone rates, so the distinction is understood
 * rather than discovered.
 */

const SCALE = [1, 2, 3, 4, 5]

function RatingRow({
  item,
  busy,
  onRate,
  onClear,
}: {
  item: MyCapabilityItem
  busy: boolean
  onRate: (value: number) => void
  onClear: () => void
}) {
  // A rating somebody ELSE recorded. Shown, never editable from here — the
  // server refuses it, and a control that looks live and then fails is worse
  // than one that explains itself.
  const assessed = item.rating !== null && item.source != null && item.source !== 'self'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 py-2.5 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{item.item_label}</p>
        <p className="text-xs capitalize text-muted-foreground">
          {item.kasba_type}
          {item.required_proficiency != null && (
            <span className="tabular-nums"> · target {item.required_proficiency}</span>
          )}
          {assessed && <span className="text-warning"> · rated by an assessor</span>}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {SCALE.map((n) => (
          <button
            key={n}
            type="button"
            disabled={busy || assessed}
            aria-label={`Rate ${item.item_label} ${n} out of 5`}
            aria-pressed={item.rating === n}
            onClick={() => onRate(n)}
            className={cn(
              'size-8 rounded-md border text-xs font-semibold tabular-nums transition',
              item.rating === n
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
              (busy || assessed) && 'cursor-not-allowed opacity-50',
            )}
          >
            {n}
          </button>
        ))}

        {/* CLEARING RETURNS AN ITEM TO UNRATED. It is not a rating of zero —
            "I have not judged this" and "I judged this as nothing" are
            different claims and the scale starts at 1 so they cannot collide. */}
        <button
          type="button"
          disabled={busy || assessed || item.rating === null}
          onClick={onClear}
          className="ml-1 h-8 rounded-md px-2 text-xs text-muted-foreground hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear
        </button>
      </div>
    </div>
  )
}

export function CmSelfRatingPanel() {
  const [competencies, setCompetencies] = useState<MyCapabilityCompetency[] | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'no-role' | 'error'>('loading')
  const [emptyReason, setEmptyReason] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isLaravelContextReady(getLaravelContext())) {
      setState('error')
      return
    }
    try {
      const res = await myRatingService.capability()
      setCompetencies(res.data?.competencies ?? [])
      setEmptyReason(res.empty_reason ?? null)
      setState(res.data?.jobrole_id ? 'ready' : 'no-role')
    } catch {
      setState('error')
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  const apply = async (item: MyCapabilityItem, value: number | null) => {
    setBusyId(item.kasba_item_id)
    setError(null)
    setMessage(null)
    try {
      if (value === null) {
        await myRatingService.clear(item.kasba_item_id)
      } else {
        await myRatingService.rate(item.kasba_item_id, value)
      }
      // Reloaded rather than patched in place: the server decides what was
      // stored — it can refuse, and it stamps source and rated_at. Trusting the
      // local guess would show a rating that may not exist.
      await load()
      setMessage(value === null ? 'Rating withdrawn.' : 'Saved as your own view.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That rating was not saved.')
    } finally {
      setBusyId(null)
    }
  }

  if (state === 'loading') {
    return (
      <Card className="p-5">
        <Skeleton className="mb-3 h-5 w-48" />
        <Skeleton className="mb-2 h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </Card>
    )
  }

  if (state === 'error') {
    return (
      <Card className="p-5">
        <p className="text-sm text-destructive">
          Your capability items could not be loaded, so there is nothing to rate yet. This is a
          loading problem, not a statement that you have none.
        </p>
      </Card>
    )
  }

  if (state === 'no-role') {
    return (
      <Card className="p-5">
        <EmptyState
          icon={<UserRound className="size-8" />}
          title="Your job role has not been set yet"
          description="Self-rating compares you against the competencies your role requires, so it needs to know what that role is. Ask your HR team to set one."
        />
      </Card>
    )
  }

  const items = (competencies ?? []).flatMap((c) => Object.values(c.by_type ?? {}).flat())

  if (items.length === 0) {
    return (
      <Card className="p-5">
        <EmptyState
          icon={<Target className="size-8" />}
          title="Nothing to rate yet"
          description={emptyReason ?? 'Your job role does not have any capability items mapped to it yet.'}
        />
      </Card>
    )
  }

  const rated = items.filter((i) => i.rating !== null).length

  return (
    <Card className="p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">Rate my own capability</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {rated} of {items.length} rated
        </span>
      </div>

      {/* SAID BEFORE THEY RATE, NOT AFTER. What this is and is not. */}
      <p className="mb-3 max-w-[70ch] text-xs leading-relaxed text-muted-foreground">
        This records <span className="font-medium text-foreground">your own view</span> of where you
        stand. It is stored as a self-rating, kept separate from an assessor&apos;s judgement, and it
        never replaces one — an item already rated by an assessor is shown here but cannot be
        changed from this screen.
      </p>

      {message && <p className="mb-2 text-xs text-success">{message}</p>}
      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}

      <div className="flex flex-col gap-4">
        {(competencies ?? []).map((competency) => {
          const own = Object.values(competency.by_type ?? {}).flat()
          if (own.length === 0) return null

          return (
            <div key={competency.competency_id ?? competency.competency_name}>
              <div className="mb-1 flex flex-wrap items-baseline gap-2">
                <h4 className="text-sm font-semibold text-foreground">
                  {competency.competency_name ?? 'Competency'}
                </h4>
                {competency.is_mandatory && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    mandatory
                  </span>
                )}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {competency.items_rated} of {competency.items_total} rated
                </span>
              </div>

              <div className="rounded-lg border border-border/60 px-3">
                {own.map((item) => (
                  <RatingRow
                    key={item.kasba_item_id}
                    item={item}
                    busy={busyId === item.kasba_item_id}
                    onRate={(value) => void apply(item, value)}
                    onClear={() => void apply(item, null)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
