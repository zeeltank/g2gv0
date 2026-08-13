'use client'

/**
 * X-06 — the notification bell, wired to `/api/notifications`.
 *
 * IT USED TO BE A PICTURE OF A BELL. It rendered "You're all caught up" and a
 * hardcoded "New" badge at the same time, unconditionally, with no request behind
 * either. Both statements were untrue at once and neither could ever change.
 *
 * "You're all caught up" now means the server returned zero unread. The badge
 * appears only when it did not. A FAILED FETCH SAYS SO rather than falling back
 * to "caught up", because reporting a connection failure as an empty inbox is the
 * same lie the placeholder told.
 *
 * ONE COMPONENT, TWO HEADERS. gtg-header.tsx and gtg-header-base.tsx each carried
 * their own copy of the placeholder — which is how a control could be dead in two
 * places at once and look maintained in both. They now share this file.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { notificationService, type NotificationRow } from '@/services/notifications'

export function NotificationsMenu() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [unread, setUnread] = useState(0)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // The count is cheap and loads on mount; the list waits until the menu opens.
  useEffect(() => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return
    let cancelled = false

    notificationService
      .unreadCount(context)
      .then((res) => {
        if (!cancelled) setUnread(res.unread ?? 0)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return

    let cancelled = false
    setState('loading')

    notificationService
      .list(context, { limit: 20 })
      .then((res) => {
        if (cancelled) return
        setItems(res.notifications ?? [])
        setUnread(res.unread ?? 0)
        setState('idle')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })

    return () => {
      cancelled = true
    }
  }, [open])

  const openNotification = useCallback(
    async (row: NotificationRow) => {
      const context = getLaravelContext()

      if (!row.read_at && isLaravelContextReady(context)) {
        setItems((prev) =>
          prev.map((n) => (n.id === row.id ? { ...n, read_at: new Date().toISOString() } : n)),
        )
        setUnread((n) => Math.max(0, n - 1))
        try {
          const res = await notificationService.markRead(context, row.id)
          setUnread(res.unread)
        } catch {
          // The optimistic update stands; the next open re-reads the truth.
        }
      }

      if (row.action_url) {
        setOpen(false)
        router.push(row.action_url)
      }
    },
    [router],
  )

  const markAll = useCallback(async () => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return
    const now = new Date().toISOString()
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })))
    setUnread(0)
    try {
      await notificationService.markAllRead(context)
    } catch {
      // Same as above — optimistic, corrected on the next open.
    }
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 outline-none hover:bg-secondary hover:text-secondary-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="size-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-96 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="rounded-sm px-2 py-0.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {state === 'loading' && (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</p>
            )}

            {state === 'error' && (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-medium text-foreground">
                  Notifications could not be loaded
                </p>
                <p className="text-xs text-muted-foreground">
                  This is a connection problem, not an empty inbox.
                </p>
              </div>
            )}

            {state === 'idle' && items.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                <Bell className="size-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
                <p className="text-xs text-muted-foreground">Nothing needs your attention.</p>
              </div>
            )}

            {state === 'idle' &&
              items.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => openNotification(row)}
                  className={cn(
                    'block w-full border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-secondary',
                    !row.read_at && 'bg-secondary/40',
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!row.read_at && (
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-full bg-destructive"
                        aria-hidden="true"
                      />
                    )}
                    <div className={cn('min-w-0 flex-1', row.read_at && 'pl-4')}>
                      <p className="truncate text-sm font-medium text-foreground">{row.subject}</p>
                      <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">
                        {row.body}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
