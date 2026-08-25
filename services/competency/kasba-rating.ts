import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/**
 * PERSON -> RATING. The last link of the capability chain to get a screen.
 *
 * The endpoints have existed and been proved since the rating work; NOTHING IN
 * THE FRONTEND CALLED THEM - measured, zero callers across services/, hooks/ and
 * components/. The cause was not the write: no read said WHICH ITEMS a given
 * person is supposed to be rated on, and a write endpoint with no candidate list
 * is a form with no fields. Both halves exist now.
 *
 *   GET  /competency/kasba-rating?user_id=N   admin,hr   candidates + current
 *   POST /competency/kasba-rating             admin,hr   one item, one rating
 *
 * Both are profile-guarded server-side. `user_id` names the SUBJECT of the
 * rating, never the caller - identity comes from the token and cannot be set
 * from here.
 */

export interface RatableItem {
  kasba_item_id: number
  kasba_type: string
  /**
   * The customer's own wording, set only when the item was never resolved to a
   * library row. **Prefer `title`** — it falls back to this.
   */
  item_label: string | null
  /**
   * The name to render, resolved server-side from the item's library table when
   * `item_id` is set and falling back to `item_label` when it is not.
   *
   * Undeclared until now even though the API has always sent it, which is how a
   * screen reading `item_label` showed blanks for exactly the items that were
   * CORRECTLY resolved — 203 of them on live. The better the data, the emptier
   * the screen.
   */
  title?: string | null
  /** The id resolved to nothing: the library row was hard-deleted. Say so. */
  title_missing?: boolean
  weight: number | null
  competency_id: number | null
  competency_name: string | null
  required_proficiency: string | number | null
  is_mandatory: number | boolean
  /** null means UNRATED, which is not the same as a rating of zero. */
  rating: number | null
  note: string | null
  rated_at: string | null
}

export interface RatableItemsResult {
  user_id: number
  jobrole_id: number | null
  items: RatableItem[]
  rated: number
  total: number
  /** True for a normal empty — no job role, or a role with nothing mapped. */
  empty_is_expected: boolean
  empty_reason: string | null
  rating_range: { min: number; max: number }
}

export const kasbaRatingService = {
  /**
   * What this person can be rated on, with any rating they already have.
   *
   * An unrated item comes back with `rating: null` rather than being absent, so
   * the screen shows it as a blank to fill instead of silently omitting it.
   */
  async listFor(userId: number, context: LaravelContext): Promise<RatableItemsResult> {
    const res = await apiClient.get<{
      status: number
      data: Omit<RatableItemsResult, 'empty_is_expected' | 'empty_reason' | 'rating_range'>
      empty_is_expected: boolean
      empty_reason: string | null
      rating_range: { min: number; max: number }
    }>(
      '/competency/kasba-rating',
      withLaravelParams(context, { user_id: String(userId) }),
    )

    return {
      ...res.data,
      empty_is_expected: res.empty_is_expected,
      empty_reason: res.empty_reason,
      // Defaulted only if the server omits it; the server does send it.
      rating_range: res.rating_range ?? { min: 1, max: 5 },
    }
  },

  /**
   * Record one rating.
   *
   * ONE ITEM PER CALL, deliberately. A bulk submit would have to report which of
   * twenty writes failed, and a partial success that returns success is the
   * failure mode this project has hit twice. Per-item, the caller always knows.
   */
  async save(
    input: { user_id: number; kasba_item_id: number; rating: number; note?: string | null },
    context: LaravelContext,
  ): Promise<void> {
    await apiClient.post('/competency/kasba-rating', {
      ...withLaravelParams(context),
      user_id: input.user_id,
      kasba_item_id: input.kasba_item_id,
      rating: input.rating,
      note: input.note ?? null,
    })
  },

  /** Remove a rating. NOT the same as rating it zero — it returns it to unrated. */
  async remove(
    input: { user_id: number; kasba_item_id: number },
    context: LaravelContext,
  ): Promise<void> {
    await apiClient.delete('/competency/kasba-rating', withLaravelParams(context, {
      user_id: String(input.user_id),
      kasba_item_id: String(input.kasba_item_id),
    }))
  },
}
