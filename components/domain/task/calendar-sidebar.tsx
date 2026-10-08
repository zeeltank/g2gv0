'use client'

import { useState } from 'react'
import { Plus, Share2, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { accountService } from '@/services/account'
import { taskService } from '@/services/task'
import type { CalendarFeed, CalendarShare } from '@/types/task-management'

interface Props {
  feeds: CalendarFeed[]
  /** user_ids currently hidden — everything else is shown. */
  hidden: Set<string>
  onToggle: (userId: string) => void
  /** A Tailwind `bg-*` class, matching this screen's existing dot-swatch convention. */
  dotClassFor: (userId: string) => string
  /** Which feed row is the viewer themselves — the only row they may recolor directly. */
  viewerId: string
  /** The viewer just changed their own task_card_color — refetch feeds so the new color shows everywhere (chips included), not just this row. */
  onMyColorChanged: () => void
  /** 'My Calendar' mode: every other feed is already hidden and inert there, so show just the viewer's own row (their color picker stays reachable) instead of a list of unchecked rows nothing can be done with. */
  selfOnly?: boolean
}

/** The one synthetic id this picker ever sends - CalendarShareService::EVERYONE, mirrored client-side only as a display label. */
const EVERYONE_ID = '0'

/**
 * A persistent left rail, mirroring document-library-view.tsx's own
 * sticky-sidebar-plus-main-content shape - the "Calendars:" chip row and the
 * old CalendarFeedTogglePanel overlay both existed only to answer "whose
 * calendars am I looking at", and both cost a click or ate a wrapping row of
 * screen space to do it. This is always visible instead.
 *
 * Whose calendars are overlaid on the grid right now — GET /calendar/feeds
 * already resolves this down to exactly who the viewer is ALLOWED to see
 * (self, subordinates, and whoever has shared with them or with everyone),
 * so every row here is a legitimate toggle, never a privacy decision made
 * client-side.
 *
 * "Share my calendar" (the other direction - granting access OUT) lives in
 * the "+" popover rather than inline in this list: a row here represents an
 * INCOMING feed the viewer did not create, with no backend operation to
 * recolor or remove it for themselves - only the owner (via the popover)
 * can set a color for a given viewer. Giving every row a pencil that did
 * nothing real would be worse than the plain row this has instead.
 *
 * The one exception is the viewer's OWN row (9.11): that color isn't someone
 * else's grant, it's the viewer's own task_card_color preference, so it gets
 * a real, editable swatch instead of a read-only dot - everywhere this color
 * shows (this dot, the grid's own chips) updates the moment it's changed.
 */
export function CalendarSidebar({ feeds, hidden, onToggle, dotClassFor, viewerId, onMyColorChanged, selfOnly }: Props) {
  const [shares, setShares] = useState<CalendarShare[]>([])
  const [sharesLoaded, setSharesLoaded] = useState(false)
  const [sharesLoading, setSharesLoading] = useState(false)
  const [shareError, setShareError] = useState('')
  const [people, setPeople] = useState<SearchableOption[]>([])
  const [shareViewerId, setShareViewerId] = useState('')
  const [canEdit, setCanEdit] = useState(false)
  const [shareColor, setShareColor] = useState('#2563eb')
  const [sharing, setSharing] = useState(false)
  const [recoloring, setRecoloring] = useState<string | null>(null)
  const [savingMyColor, setSavingMyColor] = useState(false)

  /**
   * My own card color, like CRM (9.11) — unlike every other row, this one is
   * genuinely editable here: a `color` field the OWNER set for how THEY show
   * up, not a share grant pointed at someone else. Saved to UserPreferences
   * (task_card_color), not task_management_calendar_shares — that table's
   * EVERYONE-viewer-id row is also a VISIBILITY grant
   * (CalendarVisibilityService reads it that way too), so writing a
   * self-color there would silently share the viewer's whole calendar with
   * the entire tenant as a side effect of picking a color.
   */
  const saveMyColor = async (color: string) => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return

    setSavingMyColor(true)
    try {
      await accountService.updatePreferences(context, { task_card_color: color })
      onMyColorChanged()
    } catch {
      // A failed save leaves the swatch showing the old color on the next
      // feeds refresh — no separate error surface for a single-field picker
      // this small, matching the share-color input beside it.
    } finally {
      setSavingMyColor(false)
    }
  }

  /** Lazy, once per mount - the popover is opened far less often than this sidebar is visible. */
  const loadShareData = () => {
    if (sharesLoaded || sharesLoading) return
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return

    setSharesLoading(true); setShareError('')
    Promise.all([
      taskService.getCalendarShares(context),
      taskService.getAssignmentUsers(context),
    ]).then(([sharesResponse, users]) => {
      setShares(sharesResponse.data.shares)
      setPeople(users.map((user) => ({
        value: String(user.id),
        label: [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' '),
      })))
      setSharesLoaded(true)
    }).catch((reason) => {
      setShareError(reason instanceof Error ? reason.message : 'Unable to load calendar sharing.')
    }).finally(() => {
      setSharesLoading(false)
    })
  }

  const refreshShares = async () => {
    try {
      const response = await taskService.getCalendarShares(getLaravelContext())
      setShares(response.data.shares)
    } catch { /* the add-row still works; the list just won't reflect the latest until reopened */ }
  }

  const addShare = async () => {
    if (!shareViewerId) return
    setSharing(true); setShareError('')
    try {
      await taskService.createCalendarShare(getLaravelContext(), shareViewerId, canEdit, shareColor)
      setShareViewerId(''); setCanEdit(false)
      await refreshShares()
    } catch (reason) {
      setShareError(reason instanceof Error ? reason.message : 'Unable to share your calendar.')
    } finally {
      setSharing(false)
    }
  }

  /** Recolor an existing share - share() is an upsert keyed on (owner, viewer), so this is just calling it again. */
  const recolor = async (share: CalendarShare, color: string) => {
    setRecoloring(share.id); setShareError('')
    try {
      await taskService.createCalendarShare(getLaravelContext(), share.viewer_user_id, share.can_edit, color)
      await refreshShares()
    } catch (reason) {
      setShareError(reason instanceof Error ? reason.message : 'Unable to update that color.')
    } finally {
      setRecoloring(null)
    }
  }

  const removeShare = async (shareId: string) => {
    setSharing(true); setShareError('')
    try {
      await taskService.deleteCalendarShare(getLaravelContext(), shareId)
      await refreshShares()
    } catch (reason) {
      setShareError(reason instanceof Error ? reason.message : 'Unable to remove that share.')
    } finally {
      setSharing(false)
    }
  }

  // Already-shared people (and "Everyone" if it's among them) drop out of
  // the picker - sharing with the same person twice would just 404 or
  // silently no-op server-side (share() is an upsert), and hiding them here
  // is the honest way to show that rather than a confusing duplicate pick.
  const alreadySharedIds = new Set(shares.map((share) => share.viewer_user_id))
  const pickerOptions: SearchableOption[] = [
    ...(alreadySharedIds.has(EVERYONE_ID) ? [] : [{ value: EVERYONE_ID, label: 'Everyone' }]),
    ...people.filter((person) => !alreadySharedIds.has(person.value)),
  ]

  const visibleFeeds = selfOnly ? feeds.filter((feed) => feed.user_id === viewerId) : feeds

  return (
    <Card className="sticky top-4 hidden max-h-[calc(100vh-2rem)] w-64 shrink-0 flex-col p-2 md:flex">
      <div className="flex items-center justify-between px-2 pb-2 pt-1">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Users className="size-4" />{selfOnly ? 'My Calendar' : 'Added Calendars'}
          {!selfOnly && hidden.size > 0 ? ` (${feeds.length - hidden.size}/${feeds.length})` : ''}
        </h3>
        <Popover onOpenChange={(isOpen) => { if (isOpen) loadShareData() }}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Share my calendar"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Plus className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Share2 className="size-4" /> Share my calendar</h3>
            {shareError && <p className="mb-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{shareError}</p>}
            <div className="space-y-2">
              {shares.map((share) => (
                <div key={share.id} className="flex items-center gap-2 rounded-lg border p-2">
                  <input
                    type="color"
                    aria-label={`Color for ${share.viewer_name}`}
                    value={share.color || '#94a3b8'}
                    onChange={(event) => void recolor(share, event.target.value)}
                    disabled={recoloring === share.id}
                    className="size-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{share.viewer_name}</span>
                  {share.can_edit && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Can edit</span>}
                  <button
                    type="button"
                    aria-label={`Stop sharing with ${share.viewer_name}`}
                    onClick={() => void removeShare(share.id)}
                    disabled={sharing}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
              {sharesLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!sharesLoading && sharesLoaded && shares.length === 0 && (
                <p className="text-sm text-muted-foreground">You haven&apos;t shared your calendar with anyone yet.</p>
              )}
            </div>

            <div className="mt-3 space-y-2 border-t pt-3">
              <SearchableSelect
                value={shareViewerId}
                onChange={setShareViewerId}
                options={pickerOptions}
                placeholder="Share with…"
                searchPlaceholder="Search people…"
                disabled={sharing}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={canEdit} onCheckedChange={setCanEdit} disabled={sharing} />
                Allow editing my tasks and events
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="color" value={shareColor} onChange={(event) => setShareColor(event.target.value)} disabled={sharing} className="size-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0" />
                Color they&apos;ll be shown in
              </label>
              <Button size="sm" className="w-full" disabled={!shareViewerId || sharing} onClick={() => void addShare()}>
                {sharing ? 'Sharing…' : 'Share'}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1">
        {visibleFeeds.map((feed) => (
          <label key={feed.user_id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40">
            <Checkbox checked={!hidden.has(feed.user_id)} onCheckedChange={() => onToggle(feed.user_id)} />
            {/* The owner's own chosen color wins over the automatic by-index
                palette, the same precedence the grid's chips use. Only the
                viewer's OWN row is editable here - every other row is
                somebody else's choice, with no backend operation for a
                viewer to recolor it for themselves (see this file's own
                header comment on why no pencil icon exists for those). */}
            {feed.user_id === viewerId ? (
              // Not forced circular, unlike the plain dot below - a native
              // color input's internal swatch padding fights `rounded-full`
              // inconsistently across browsers. Same rounded-square shape as
              // the share popover's own color inputs above, just smaller to
              // fit this denser row.
              <input
                type="color"
                aria-label="My task calendar color"
                value={feed.color || '#94a3b8'}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => { event.stopPropagation(); void saveMyColor(event.target.value) }}
                disabled={savingMyColor}
                className="size-4 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
              />
            ) : (
              <span
                className={feed.color ? 'size-2.5 shrink-0 rounded-full' : `size-2.5 shrink-0 rounded-full ${dotClassFor(feed.user_id)}`}
                style={feed.color ? { backgroundColor: feed.color } : undefined}
              />
            )}
            <span className="min-w-0 flex-1 truncate text-sm">{feed.name}</span>
          </label>
        ))}
        {!selfOnly && visibleFeeds.length === 0 && <p className="px-2 text-sm text-muted-foreground">No other calendars are shared with you yet.</p>}
      </div>
    </Card>
  )
}