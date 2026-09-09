'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Info, Laptop, Moon, Sun } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { useAccount } from '@/hooks/use-account'
import { useTheme } from '@/components/providers/theme-provider'
import type { AccountPreferences, Theme } from '@/services/account'
import { SaveButton } from '@/components/settings/settings-shell'
import { Field, SectionBlock, SectionHint, ToggleRow } from './section-primitives'

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

  const [draft, setDraft] = useState<AccountPreferences | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stored = account.preferences

  /*
   * SYNC FROM THE SERVER'S COPY, DURING RENDER.
   *
   * Not in an effect. React's own guidance for "adjust state when a prop
   * changes" is to compare against the last value seen and set during render:
   * the component re-renders immediately with the right value and the browser
   * never paints the stale one. An effect would paint an empty form first, and
   * `react-hooks/set-state-in-effect` flags it for exactly that reason.
   */
  const [syncedFrom, setSyncedFrom] = useState<AccountPreferences | null>(null)

  if (stored && stored !== syncedFrom) {
    setSyncedFrom(stored)
    setDraft(stored)
  }

  const dirty = useMemo(() => {
    if (!draft || !stored) return false

    return FLAT_KEYS.some((key) => draft[key] !== stored[key])
  }, [draft, stored])

  if (!draft || !stored) {
    return <SectionHint>Your preferences could not be loaded.</SectionHint>
  }

  function set<K extends keyof AccountPreferences>(key: K, value: AccountPreferences[K]) {
    setSaved(false)
    setDraft((current) => (current ? { ...current, [key]: value } : current))
  }

  async function save() {
    if (!draft) return

    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const changes: Partial<AccountPreferences> = {}

      for (const key of FLAT_KEYS) {
        if (draft[key] !== stored?.[key]) {
          changes[key] = draft[key] as never
        }
      }

      await account.savePreferences(changes)
      setSaved(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your preferences could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {saved && (
        <Alert variant="success">
          <Check className="size-4" aria-hidden="true" />
          <AlertDescription>
            Saved to your account, so they follow you to any device you sign in on.
          </AlertDescription>
        </Alert>
      )}

      <SectionBlock
        title="Appearance"
        description="Theme changes as soon as you pick it, so you can see it before you save."
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
      </SectionBlock>

      <SectionBlock
        title="Language & formats"
        description="How dates, times and numbers are written for you."
      >
        {/*
          * STILL SAYING WHAT IS AND IS NOT LIVE.
          *
          * Theme, the sidebar default and the landing page now have real
          * readers: `PreferencesProvider` fetches these once for the whole app,
          * `GtgAppShell` reads `sidebar_collapsed`, and the sign-in redirect
          * reads `landing_page`.
          *
          * Language, time zone and date format do NOT yet - the formatters
          * across this product still hardcode a locale, and three different
          * files hardcode three different ones. The choice is stored and will
          * apply as each is updated, and this note stays until that is true,
          * because the one thing this screen must never do is claim an effect it
          * does not have.
          */}
        <Alert className="mb-4">
          <Info className="size-4" aria-hidden="true" />
          <AlertDescription>
            These three are saved to your account and will apply as each screen is updated to use
            them. Theme, the sidebar and your landing page take effect straight away.
          </AlertDescription>
        </Alert>

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
              options={TIMEZONES.map((zone) => ({ value: zone, label: zone.replace('_', ' ') }))}
            />
          </Field>

          <Field label="Date format">
            <Select
              value={draft.date_format}
              onChange={(value) => set('date_format', String(value))}
              options={(account.choices?.date_format ?? ['dd/mm/yyyy']).map((format) => ({
                value: format,
                label: `${format} — ${sampleDate(format)}`,
              }))}
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

      <div className="flex justify-end border-t border-border pt-5">
        <SaveButton dirty={dirty} saving={saving} onClick={save} />
      </div>
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

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
]

/** A worked example beside each format, so nobody has to decode `dd/mm/yyyy`. */
function sampleDate(format: string): string {
  const day = '09'
  const month = '02'
  const year = '2026'

  if (format === 'mm/dd/yyyy') return `${month}/${day}/${year}`
  if (format === 'yyyy-mm-dd') return `${year}-${month}-${day}`

  return `${day}/${month}/${year}`
}
