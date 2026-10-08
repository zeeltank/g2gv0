'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Share2, Trash2, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'
import { drawerSlideInLeft } from '@/lib/motion/variants'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { taskService } from '@/services/task'
import type { CalendarFeed, CalendarShare } from '@/types/task-management'

interface Props {
  open: boolean
  onClose: () => void
  feeds: CalendarFeed[]
  /** user_ids currently hidden — everything else is shown. */
  hidden: Set<string>
  onToggle: (userId: string) => void
  /** A Tailwind `bg-*` class, matching this screen's existing dot-swatch convention. */
  dotClassFor: (userId: string) => string
}

/** The one synthetic id this picker ever sends - CalendarShareService::EVERYONE, mirrored client-side only as a display label. */
const EVERYONE_ID = '0'

/**
 * Whose calendars are overlaid on the grid right now — GET /calendar/feeds
 * already resolves this down to exactly who the viewer is ALLOWED to see
 * (self, subordinates, and whoever has shared with them or with everyone),
 * so every row here is a legitimate toggle, never a privacy decision made
 * client-side.
 *
 * The second section, below, is the other direction: outgoing grants this
 * component now owns itself (fetched on open, not threaded through
 * task-calendar-view.tsx) since neither createCalendarShare/deleteCalendarShare
 * nor the people lookup were ever wired to anything — both existed and
 * compiled, with zero callers.
 */
export function CalendarFeedTogglePanel({ open, onClose, feeds, hidden, onToggle, dotClassFor }: Props) {
  const [shares, setShares] = useState<CalendarShare[]>([])
  const [sharesLoading, setSharesLoading] = useState(false)
  const [shareError, setShareError] = useState('')
  const [people, setPeople] = useState<SearchableOption[]>([])
  const [viewerId, setViewerId] = useState('')
  const [canEdit, setCanEdit] = useState(false)
  const [shareColor, setShareColor] = useState('#2563eb')
  const [sharing, setSharing] = useState(false)
  const [recoloring, setRecoloring] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return

    let active = true
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => {
      if (!active) return
      setSharesLoading(true); setShareError('')
      Promise.all([
        taskService.getCalendarShares(context),
        taskService.getAssignmentUsers(context),
      ]).then(([sharesResponse, users]) => {
        if (!active) return
        setShares(sharesResponse.data.shares)
        setPeople(users.map((user) => ({
          value: String(user.id),
          label: [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' '),
        })))
      }).catch((reason) => {
        if (active) setShareError(reason instanceof Error ? reason.message : 'Unable to load calendar sharing.')
      }).finally(() => {
        if (active) setSharesLoading(false)
      })
    })

    return () => { active = false }
  }, [open])

  const refreshShares = async () => {
    try {
      const response = await taskService.getCalendarShares(getLaravelContext())
      setShares(response.data.shares)
    } catch { /* the add-row still works; the list just won't reflect the latest until reopened */ }
  }

  const addShare = async () => {
    if (!viewerId) return
    setSharing(true); setShareError('')
    try {
      await taskService.createCalendarShare(getLaravelContext(), viewerId, canEdit, shareColor)
      setViewerId(''); setCanEdit(false)
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

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            variants={drawerSlideInLeft}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-y-0 left-0 z-50 w-80 overflow-y-auto border-r bg-card p-4 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><Users className="size-4" /> Calendars</h3>
              <button type="button" aria-label="Close" onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-2">
              {feeds.map((feed) => (
                <label key={feed.user_id} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-muted/40">
                  <Checkbox checked={!hidden.has(feed.user_id)} onCheckedChange={() => onToggle(feed.user_id)} />
                  {/* The owner's own chosen color wins over the automatic
                      by-index palette, the same precedence the grid's chips
                      use - set once feed.color exists, this stops being a
                      generic class and becomes that person's real color. */}
                  <span
                    className={feed.color ? 'size-2.5 shrink-0 rounded-full' : `size-2.5 shrink-0 rounded-full ${dotClassFor(feed.user_id)}`}
                    style={feed.color ? { backgroundColor: feed.color } : undefined}
                  />
                  <span className="truncate text-sm">{feed.name}</span>
                </label>
              ))}
              {feeds.length === 0 && <p className="text-sm text-muted-foreground">No other calendars are shared with you yet.</p>}
            </div>

            <div className="my-4 border-t" />

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
              {!sharesLoading && shares.length === 0 && (
                <p className="text-sm text-muted-foreground">You haven&apos;t shared your calendar with anyone yet.</p>
              )}
            </div>

            <div className="mt-3 space-y-2 border-t pt-3">
              <SearchableSelect
                value={viewerId}
                onChange={setViewerId}
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
              <Button size="sm" className="w-full" disabled={!viewerId || sharing} onClick={() => void addShare()}>
                {sharing ? 'Sharing…' : 'Share'}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
