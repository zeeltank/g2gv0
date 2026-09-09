'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bookmark, Info, Laptop, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { SectionBlock } from './section-primitives'

/**
 * SAVED VIEWS — the six preferences that were already here, finally visible.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS SECTION IS HONEST ABOUT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Six real per-user preferences already exist across this product — saved
 * views, hidden columns, report presets, last-used task defaults — and every one
 * of them lives in `localStorage`. That means they are per BROWSER, not per
 * person: they do not follow anybody to a second machine, and clearing site data
 * loses them without warning.
 *
 * This screen does not pretend otherwise. It lists what this browser is holding,
 * says plainly that it is device-local, and lets it be cleared. Moving them into
 * `user_preferences` is the right end state and it is a per-screen migration —
 * each of the six owns its own shape — so claiming they had moved would be the
 * one thing worse than showing them as they are.
 *
 * The value today is that they were completely invisible: there was no screen
 * anywhere that would tell you a saved view existed, let alone remove one.
 */

type StoredView = {
  key: string
  label: string
  where: string
  /** How many entries it holds, when the value is a list. */
  count: number | null
  bytes: number
}

/**
 * The keys the product actually writes, each with the screen that owns it.
 * Read from the code, not guessed — an entry here that nothing writes would
 * simply never appear.
 */
const KNOWN_KEYS: { key: string; label: string; where: string }[] = [
  {
    key: 'cm-competency-library:saved-views',
    label: 'Saved views',
    where: 'Competency library',
  },
  {
    key: 'cm-audit:display-settings',
    label: 'Display settings',
    where: 'Competency audit',
  },
  {
    key: 'hrit.leave-reports.saved',
    label: 'Saved reports',
    where: 'Leave reports',
  },
  {
    key: 'hrit.leave-requests.hidden-columns',
    label: 'Hidden columns',
    where: 'Leave requests',
  },
  {
    key: 'task-assign:last-used',
    label: 'Last used department and role',
    where: 'Assign a task',
  },
]

export function SavedViewsSection() {
  const [views, setViews] = useState<StoredView[]>([])
  const [scanned, setScanned] = useState(false)

  const scan = useCallback(() => {
    const found: StoredView[] = []

    for (const known of KNOWN_KEYS) {
      let raw: string | null = null

      try {
        raw = window.localStorage.getItem(known.key)
      } catch {
        // Site data blocked. Nothing to show, and nothing to fix.
        continue
      }

      if (!raw) continue

      let count: number | null = null

      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) count = parsed.length
      } catch {
        // Not JSON. It still exists and can still be cleared.
      }

      found.push({ ...known, count, bytes: raw.length })
    }

    setViews(found)
    setScanned(true)
  }, [])

  useEffect(() => {
    // Reading localStorage is an external-system read, so it belongs in an
    // effect - deferred so the state it produces does not cascade the mount.
    queueMicrotask(scan)
  }, [scan])

  function clear(key: string) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // Nothing to do — it was never readable either.
    }

    scan()
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Laptop className="size-4" aria-hidden="true" />
        <AlertDescription>
          These are kept in <strong>this browser only</strong>. They do not follow you to another
          computer, and clearing your browsing data removes them. Everything in{' '}
          <strong>Preferences</strong> and <strong>Notifications</strong>, by contrast, is stored on
          your account and follows you anywhere.
        </AlertDescription>
      </Alert>

      <SectionBlock
        title="Kept on this device"
        description="Filters, columns and presets the screens you use have remembered."
      >
        {!scanned && <div className="h-16 animate-pulse rounded-lg bg-muted/40" />}

        {scanned && views.length === 0 && (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <Bookmark className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-foreground">Nothing saved yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              When you save a view or hide a column on a list screen, it will appear here.
            </p>
          </div>
        )}

        {scanned && views.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {views.map((view) => (
              <li
                key={view.key}
                className="flex flex-wrap items-center justify-between gap-3 bg-background px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{view.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {view.where}
                    {view.count !== null &&
                      ` · ${view.count} ${view.count === 1 ? 'entry' : 'entries'}`}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clear(view.key)}
                  className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Clear
                </Button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Clearing one only removes what that screen remembered. It does not delete any of your
          work.
        </p>
      </SectionBlock>
    </div>
  )
}
