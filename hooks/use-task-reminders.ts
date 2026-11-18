'use client'

import { useCallback, useEffect, useState } from 'react'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { taskService } from '@/services/task'
import type { DueReminder } from '@/types/task-management'

const POLL_MS = 60_000

/**
 * Polls for due reminders while mounted. No "fetch marks fired" - the
 * backend only flips a delivery's status on explicit seen/snooze, so simply
 * polling can never silently dismiss anything.
 *
 * LIMITATION, HONESTLY STATED: this only fires while a Task Management
 * screen is open, since there is no app-shell-level mount point without
 * touching unrelated, non-task screens - out of this phase's approved
 * scope. A true "fires anywhere in the app" reminder system is a later,
 * separately-scoped piece of work.
 */
export function useTaskReminders() {
  const [reminders, setReminders] = useState<DueReminder[]>([])

  const refresh = useCallback(async () => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return
    try {
      const response = await taskService.getDueReminders(context)
      setReminders(response.data.reminders)
    } catch {
      // A failed poll leaves the last-known set on screen rather than
      // clearing it - a transient network blip must not look like every
      // reminder was dismissed.
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    // Deferred so the first poll's setState lands after this render, not
    // cascading out of the effect body - same idiom task-calendar-view.tsx's
    // own load() already uses.
    queueMicrotask(() => { if (!cancelled) void refresh() })
    const interval = window.setInterval(() => { if (!cancelled) void refresh() }, POLL_MS)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [refresh])

  const dismiss = useCallback((deliveryId: string) => {
    setReminders((current) => current.filter((reminder) => reminder.delivery_id !== deliveryId))
  }, [])

  const markSeen = useCallback(async (deliveryId: string) => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return
    dismiss(deliveryId)
    try {
      await taskService.markReminderSeen(context, deliveryId)
    } catch {
      void refresh() // the dismiss was optimistic - resync if the write failed
    }
  }, [dismiss, refresh])

  const snooze = useCallback(async (deliveryId: string, minutes: number) => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return
    dismiss(deliveryId)
    try {
      await taskService.snoozeReminder(context, deliveryId, minutes)
    } catch {
      void refresh()
    }
  }, [dismiss, refresh])

  return { reminders, markSeen, snooze }
}
