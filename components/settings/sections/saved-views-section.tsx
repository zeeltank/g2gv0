'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bookmark, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, SectionBlock, SectionEmpty } from './section-primitives'

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
  /*
   * "Clear" removed the entry on the first click, and the sentence reassuring
   * people it was safe sat BELOW the buttons - so the reassurance arrived after
   * the decision. The consequence is now stated at the moment of the click.
   */
  const [confirming, setConfirming] = useState<StoredView | null>(null)

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
      {/*
        FIFTY WORDS BECAME A BADGE AND A SENTENCE.

        This was a full-width Alert on every visit, and the fact it carries is a
        real one worth knowing - saved views live in this browser and nothing
        else in Settings does. But the comparison with Preferences and
        Notifications was the reader's third sentence before they had seen a
        single view, and it answers a question most of them were not asking.

        The state goes on the title as a badge, where a badge is the product's
        established way of saying "this thing is like THIS"; the consequence goes
        in the description, which is the line people actually read before using a
        section. Nothing true was dropped - it is the same information at a
        weight that matches how often it changes what somebody does.
      */}
      <SectionBlock
        title="Kept on this device"
        description="Filters, columns and presets the screens you use have remembered. They stay in this browser: they do not follow you to another computer, and clearing your browsing data removes them."
        badge="This browser only"
        badgeTitle="Unlike Preferences and Notifications, which are stored on your account and follow you anywhere."
      >
        {!scanned && <div className="h-16 animate-pulse rounded-lg bg-muted/40" />}

        {scanned && views.length === 0 && (
          <SectionEmpty
            icon={<Bookmark className="size-6" aria-hidden="true" />}
            title="Nothing saved yet"
            description="When you save a view or hide a column on a list screen, it will appear here."
          />
        )}

        {scanned && views.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {views.map((view) => (
              <li
                key={view.key}
                // `bg-background` here was grey-on-white in light and a dark
                // hole in the card in dark - see the note in
                // people-access-section. Inherit the card; hover on surface.
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-muted"
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
                  onClick={() => setConfirming(view)}
                  className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Clear
                </Button>
              </li>
            ))}
          </ul>
        )}

      </SectionBlock>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Clear ${confirming?.label ?? 'this'}?`}
        description={
          <>
            {confirming?.where} will forget{' '}
            {confirming?.count !== null && confirming?.count !== undefined
              ? `${confirming.count} ${confirming.count === 1 ? 'entry' : 'entries'}`
              : 'what it remembered'}
            . None of your actual work is deleted, and this browser only — your other devices keep
            theirs. It cannot be undone.
          </>
        }
        confirmLabel="Clear"
        onConfirm={() => {
          const target = confirming
          setConfirming(null)
          if (target) clear(target.key)
        }}
      />
    </div>
  )
}
