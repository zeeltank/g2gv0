'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { kasbaRatingService, type RatableItem } from '@/services/competency/kasba-rating'

/**
 * PERSON -> RATING. The last link of the capability chain to get a screen.
 *
 * The endpoints have been proved since the rating work and NOTHING CALLED THEM -
 * measured, zero callers across services/, hooks/ and components/. A write
 * endpoint with no candidate list is a form with no fields; both halves exist
 * now and this is the form.
 *
 * TAKES `userId` AS A PROP rather than picking an employee itself. It is designed
 * to drop into Employee Profiles (menu 156), which already lists employees and
 * already shows one person's competency profile - a second employee picker beside
 * that one would be two lists that can disagree.
 *
 * AUTHORISATION IS THE SERVER'S. Both endpoints carry profile:admin,hr. This
 * component renders controls; it does not decide who may use them, and a caller
 * without the profile is refused by the API regardless of what the screen shows.
 */
export function KasbaRatingPanel({ userId, employeeName }: { userId: number; employeeName?: string }) {
  const { user } = useAuth()
  const [items, setItems] = useState<RatableItem[]>([])
  const [range, setRange] = useState<{ min: number; max: number }>({ min: 1, max: 5 })
  const [loading, setLoading] = useState(true)
  const [emptyReason, setEmptyReason] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await kasbaRatingService.listFor(userId, getLaravelContext(user))
      setItems(res.items ?? [])
      setRange(res.rating_range ?? { min: 1, max: 5 })
      // The server distinguishes "no job role" from "role with nothing mapped".
      // Both are normal; each has a different fix, so the message is passed
      // through rather than replaced with one generic empty state.
      setEmptyReason(res.empty_is_expected ? res.empty_reason : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this person’s capability items.')
    } finally {
      setLoading(false)
    }
  }, [userId, user])

  useEffect(() => {
    void load()
  }, [load])

  async function rate(item: RatableItem, value: number | null) {
    setSavingId(item.kasba_item_id)
    setError(null)
    try {
      if (value === null) {
        await kasbaRatingService.remove(
          { user_id: userId, kasba_item_id: item.kasba_item_id },
          getLaravelContext(user),
        )
      } else {
        await kasbaRatingService.save(
          { user_id: userId, kasba_item_id: item.kasba_item_id, rating: value },
          getLaravelContext(user),
        )
      }
      // RE-READ RATHER THAN PATCH LOCAL STATE. The server is the authority on
      // what was stored; assuming the write landed as sent is how a screen and a
      // database drift apart without anyone noticing.
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That rating was not saved.')
    } finally {
      setSavingId(null)
    }
  }

  const rated = items.filter((i) => i.rating !== null).length
  const scale = Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i)

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading capability items…</div>
  }

  if (emptyReason) {
    return (
      <div className="rounded-lg border border-border bg-surface-muted p-4">
        <p className="text-sm font-medium">Nothing to rate yet</p>
        <p className="mt-1 text-sm text-muted-foreground">{emptyReason}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">
          Capability rating{employeeName ? ` — ${employeeName}` : ''}
        </h3>
        {/* UNRATED IS REPORTED AS OUTSTANDING, NEVER AS A SCORE OF NOTHING. */}
        <p className="text-xs text-muted-foreground tabular-nums">
          {rated} of {items.length} rated · {items.length - rated} outstanding
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">Competency</th>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Rating</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.kasba_item_id} className="border-t border-border align-middle">
                <td className="px-3 py-2">{item.competency_name ?? '—'}</td>
                <td className="px-3 py-2">{item.item_label ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{item.kasba_type}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    {scale.map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={savingId === item.kasba_item_id}
                        onClick={() => void rate(item, n)}
                        aria-pressed={item.rating === n}
                        aria-label={`Rate ${item.item_label ?? 'this item'} ${n} of ${range.max}`}
                        className={[
                          'h-7 w-7 rounded-md border text-xs font-semibold transition-colors',
                          item.rating === n
                            ? 'border-transparent bg-primary text-primary-foreground'
                            : 'border-border bg-surface hover:bg-surface-muted',
                          savingId === item.kasba_item_id ? 'opacity-50' : '',
                        ].join(' ')}
                      >
                        {n}
                      </button>
                    ))}
                    {/* CLEARING RETURNS AN ITEM TO UNRATED. It is not a rating of
                        zero, and the label says so rather than showing a 0. */}
                    <button
                      type="button"
                      disabled={item.rating === null || savingId === item.kasba_item_id}
                      onClick={() => void rate(item, null)}
                      className="ml-2 text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-40 disabled:no-underline"
                      title="Return this item to unrated"
                    >
                      Clear
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Ratings are recorded against the specific capability item. Saving a rating does not change
        this person’s proficiency level — that is a separate, explicit confirmation.
      </p>
    </div>
  )
}
