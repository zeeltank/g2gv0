'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Info, Laptop, Moon, Sun } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { useAccount } from '@/hooks/use-account'
import { useTheme } from '@/components/providers/theme-provider'
import { TIMEZONES, dateFormatOptions } from '@/lib/format-labels'
import type { AccountPreferences, Theme } from '@/services/account'
import { Field, SectionBlock, ToggleRow } from './section-primitives'
import { ErrorState } from '@/components/ui/error-state'
import { accountService } from '@/services/account'
import { useLaravelContext } from '@/hooks/use-agentic'
import { Button } from '@/components/ui/button'

/**
 * PREFERENCES — and the first theme toggle this product has ever had.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DARK PALETTE WAS SHIPPED AND NEVER SWITCHED ON
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `app/globals.css:116` defines the whole dark token set, and `components/ui/*`
 * is full of `dark:` variants. A search for `classList`, `documentElement`,
 * `next-themes`, `setTheme` and `prefers-color-scheme` across the entire
 * frontend returned nothing. Every one of those variants was dead CSS.
 *
 * ── THEME PREVIEWS ITSELF ───────────────────────────────────────────────────
 *
 * Choosing one repaints immediately rather than on Save. A theme you cannot see
 * until you commit to it is a choice made blind, and it is trivially reversible
 * — unlike a locale, where an unsaved change would just be confusing.
 *
 * ── WHY THESE PREFERENCES, AND NOT A GENERIC LIST ───────────────────────────
 *
 * Locale is here because the frontend currently hardcodes THREE of them —
 * `en-GB`, `en-US` and `en-IN` in different files — so today the same person can
 * see the same date formatted three ways in one session.
 */
export function PreferencesSection({ account }: { account: ReturnType<typeof useAccount> }) {
  const { setTheme } = useTheme()
  const resolveContext = useLaravelContext()

  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * NO DRAFT, NO SAVE BUTTON. EVERY CONTROL PERSISTS ON CHANGE.
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * There used to be a `draft`, a `dirty` memo and a footer Save. The theme
   * picker also repainted the app the moment it was clicked — so it LOOKED saved
   * while nothing had been written, and the next refresh replaced it with the
   * stored value. `live` held one preference row in total: the save path worked
   * and hardly anybody ever finished it.
   *
   * The server's response is the only state now. `account.preferences` is what is
   * stored; there is nothing local for a refresh to discard.
   */
  const stored = account.preferences
  const [busy, setBusy] = useState<'promote' | 'forget' | null>(null)
  const [deviceNote, setDeviceNote] = useState<string | null>(null)

  /*
   * SYNC FROM THE SERVER'S COPY, DURING RENDER.
   *
   * Not in an effect. React's own guidance for "adjust state when a prop
   * changes" is to compare against the last value seen and set during render:
   * the component re-renders immediately with the right value and the browser
   * never paints the stale one. An effect would paint an empty form first, and
   * `react-hooks/set-state-in-effect` flags it for exactly that reason.
   */
  if (!stored) {
    return (
      <ErrorState
        title="Your preferences could not be loaded"
        description="The account service did not answer. Nothing has been lost — try again."
        retry={() => void account.reload()}
      />
    )
  }

  /** One control changed: write it straight away. */
  function set<K extends keyof AccountPreferences>(key: K, value: AccountPreferences[K]) {
    void account.saveNow(key, value)
  }

  async function promote() {
    setBusy('promote')
    setDeviceNote(null)

    try {
      const response = await accountService.promotePreferences(resolveContext())
      setDeviceNote(response.message)
      await account.reload()
    } catch (caught) {
      setDeviceNote(caught instanceof Error ? caught.message : 'That could not be saved.')
    } finally {
      setBusy(null)
    }
  }

  async function forget() {
    setBusy('forget')
    setDeviceNote(null)

    try {
      const response = await accountService.forgetDevicePreferences(resolveContext())
      setDeviceNote(response.message)
      // The browser keeps its id; only the rows against it are gone, so it will
      // hold a new choice again the moment one is made.
      await account.reload()
    } catch (caught) {
      setDeviceNote(caught instanceof Error ? caught.message : 'That could not be saved.')
    } finally {
      setBusy(null)
    }
  }

  const draft = stored

  return (
    <div className="space-y-6">
      {/*
        * ONE line, only when something went wrong.
        *
        * There were two full-width banners here — a destructive one and a green
        * "Saved" one. With autosave, a success banner would appear on every
        * single click, which is noise; the confirmation now sits beside the
        * control that changed (see `Saved` below). Only a failure is worth the
        * width of the pane.
        */}
      {account.saveError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{account.saveError}</AlertDescription>
        </Alert>
      )}

      <SectionBlock
        title="Appearance"
        description={
          account.deviceScope?.is_device
            ? 'These apply to this browser only. Your other devices keep their own.'
            : 'These apply to your account. This browser cannot keep settings of its own.'
        }
        badge={account.deviceScope?.is_device ? 'This browser' : undefined}
        badgeTitle="Theme, sidebar and spacing are remembered per browser, so a laptop and a phone can differ. Everything else on this page follows your account."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {THEMES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                set('theme', option.value)
                // Repaint NOW. Saving persists it; this only shows it, so the
                // choice can be judged before it is committed.
                setTheme(option.value)
              }}
              aria-pressed={draft.theme === option.value}
              className={cn(
                'flex cursor-pointer flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all duration-200 active:scale-[0.98]',
                draft.theme === option.value
                  ? 'border-primary/30 bg-primary/10 shadow-sm'
                  : 'border-border hover:bg-muted/50 hover:shadow-sm',
              )}
            >
              <span
                className={cn(
                  'grid size-9 place-items-center rounded-lg',
                  draft.theme === option.value
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                <option.icon className="size-4" aria-hidden="true" />
              </span>
              <span
                className={cn(
                  'text-sm font-medium',
                  draft.theme === option.value ? 'text-primary' : 'text-foreground',
                )}
              >
                {option.label}
              </span>
              <span className="text-xs text-muted-foreground">{option.blurb}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-1 border-t border-border pt-4">
          <ToggleRow
            label="Start with the sidebar collapsed"
            description="More room for the page. You can always open it from the menu button."
            checked={draft.sidebar_collapsed}
            onChange={(value) => set('sidebar_collapsed', value)}
          />
          <ToggleRow
            label="Compact spacing"
            description="Tighter rows and padding, so more fits on screen."
            checked={draft.density === 'compact'}
            onChange={(value) => set('density', value ? 'compact' : 'comfortable')}
          />
        </div>

        {/*
          * ── THE TWO THINGS PER-DEVICE STORAGE OWES THE USER ────────────────
          *
          * Per-device is right until you set up a new machine and have to do it
          * all again — so there is a way to push this browser's choices up to
          * the account, which every device with no opinion of its own then
          * inherits. And there is a way back: a browser that was configured by
          * mistake can be told to follow the account again.
          *
          * Only shown when this browser actually has an identity. A private
          * window cannot keep one, and offering it a button that does nothing
          * would be the exact defect this whole exercise has been removing.
          */}
        {account.deviceScope?.is_device && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void promote()}
              disabled={busy !== null}
            >
              {busy === 'promote' ? 'Saving…' : 'Use these on all my devices'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void forget()}
              disabled={busy !== null}
            >
              {busy === 'forget' ? 'Saving…' : 'Follow my account instead'}
            </Button>
            {deviceNote && <span className="text-xs text-muted-foreground">{deviceNote}</span>}
          </div>
        )}
      </SectionBlock>

      <SectionBlock
        title="Language & formats"
        description="How dates, times and numbers are written for you."
        /*
         * A BADGE, NOT A BANNER.
         *
         * This used to open with a full-width Alert explaining that these three
         * are stored and not yet read by any screen. It was true and it was
         * clutter — a paragraph of caveat above three dropdowns, on every visit.
         * The same fact now rides on the title as two words, the pattern
         * `module-card.tsx` already uses for module state.
         */
        badge="Not applied yet"
        badgeTitle="Saved to your account now, and applied as each screen is updated to read it. Theme, sidebar and landing page already apply everywhere."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Language">
            <Select
              value={draft.locale}
              onChange={(value) => set('locale', String(value))}
              options={LOCALES}
            />
          </Field>

          <Field label="Time zone" hint="Used for timestamps and deadlines.">
            <Select
              value={draft.timezone}
              onChange={(value) => set('timezone', String(value))}
              options={TIMEZONES}
            />
          </Field>

          <Field label="Date format">
            <Select
              value={draft.date_format}
              onChange={(value) => set('date_format', String(value))}
              options={dateFormatOptions(account.choices?.date_format ?? ['dd/mm/yyyy'])}
            />
          </Field>
        </div>
      </SectionBlock>

      <SectionBlock title="Where you start" description="The first screen after you sign in.">
        <Field label="Landing page">
          <div className="sm:max-w-sm">
            <Select
              value={draft.landing_page}
              onChange={(value) =>
                set('landing_page', String(value) as AccountPreferences['landing_page'])
              }
              options={[
                { value: 'dashboard', label: 'Dashboard' },
                { value: 'last-visited', label: 'The last page I was on' },
              ]}
            />
          </div>
        </Field>
      </SectionBlock>
    </div>
  )
}

const FLAT_KEYS = [
  'theme',
  'sidebar_collapsed',
  'density',
  'locale',
  'timezone',
  'date_format',
  'landing_page',
] as const satisfies readonly (keyof AccountPreferences)[]

const THEMES: { value: Theme; label: string; blurb: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'Match my device', blurb: 'Follows your system setting', icon: Laptop },
  { value: 'light', label: 'Light', blurb: 'Always light', icon: Sun },
  { value: 'dark', label: 'Dark', blurb: 'Always dark', icon: Moon },
]

const LOCALES = [
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'en-IN', label: 'English (India)' },
  { value: 'en-US', label: 'English (United States)' },
]

