'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useLaravelContext } from '@/hooks/use-agentic'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { organizationSettingsService, type OrgSettingsResponse } from '@/services/organization/settings'
import { SaveButton } from '@/components/settings/settings-shell'
import { Field, SectionBlock } from './section-primitives'

/**
 * ORGANISATION DEFAULTS — the working week, the financial year, the formats.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IS LIVE AND WHAT IS BEING KEPT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The server reports `enforced` per group, and this screen renders that
 * verbatim. Nothing here reads the working week yet, and the formatters across
 * the product still hardcode a locale — so a badge says so, on the group, in
 * plain words.
 *
 * The alternative is what this product has done before: a screen full of
 * controls that save perfectly and change nothing, with no way for the person
 * using it to tell. A stored-not-yet-applied setting is a reasonable thing to
 * offer; pretending it is applied is not.
 *
 * ── THESE ARE DEFAULTS, NOT RULES ───────────────────────────────────────────
 *
 * Where an organisation default and a personal preference cover the same thing
 * — date format, time zone — the PERSON wins. This is what somebody sees before
 * they have expressed a preference of their own, which is why the copy says
 * "unless they have chosen their own" rather than implying it is imposed.
 */

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const CURRENCIES = [
  { value: 'INR', label: 'Indian Rupee (₹)' },
  { value: 'USD', label: 'US Dollar ($)' },
  { value: 'GBP', label: 'Pound Sterling (£)' },
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'AED', label: 'UAE Dirham (د.إ)' },
  { value: 'SGD', label: 'Singapore Dollar (S$)' },
]

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore',
  'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'UTC',
]

type Settings = OrgSettingsResponse['data']

export function OrganizationDefaultsSection() {
  const resolveContext = useLaravelContext()

  const [stored, setStored] = useState<Settings | null>(null)
  const [draft, setDraft] = useState<Settings['settings'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const context = resolveContext()

    if (!isLaravelContextReady(context)) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await organizationSettingsService.get(context)
      setStored(response.data)
      setDraft(response.data.settings)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'These settings could not be loaded. They are available to administrators.',
      )
    } finally {
      setLoading(false)
    }
  }, [resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  const KEYS = useMemo(
    () =>
      [
        'org.week_start',
        'org.working_days',
        'org.financial_year_start_month',
        'org.currency',
        'org.date_format',
        'org.number_format',
        'org.timezone',
      ] as const,
    [],
  )

  const dirty = useMemo(() => {
    if (!draft || !stored) return false

    return KEYS.some((key) => draft[key] !== stored.settings[key])
  }, [draft, stored, KEYS])

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl bg-muted/40" />
        ))}
      </div>
    )
  }

  if (!draft || !stored) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" aria-hidden="true" />
        <AlertDescription>{error ?? 'These settings could not be loaded.'}</AlertDescription>
      </Alert>
    )
  }

  function set(key: keyof Settings['settings'], value: string) {
    setSaved(false)
    setDraft((current) => (current ? { ...current, [key]: value } : current))
  }

  function toggleDay(index: number) {
    if (!draft) return

    const mask = draft['org.working_days'].padEnd(7, '0').split('')
    mask[index] = mask[index] === '1' ? '0' : '1'
    set('org.working_days', mask.join(''))
  }

  async function save() {
    if (!draft) return

    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const changes: Record<string, string> = {}

      for (const key of KEYS) {
        if (draft[key] !== stored?.settings[key]) changes[key] = draft[key]
      }

      const response = await organizationSettingsService.save(resolveContext(), changes)
      setStored(response.data)
      setDraft(response.data.settings)
      setSaved(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'These settings could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const workingCount = draft['org.working_days'].split('').filter((d) => d === '1').length

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
          <AlertDescription>Saved for the whole organisation.</AlertDescription>
        </Alert>
      )}

      <SectionBlock
        title="Working week"
        description="Which days count as working days, and where the week begins."
      >
        <NotYetApplied when={!stored.enforced.calendar}>
          Stored, but nothing reads the working week yet — leave, attendance and payroll still use
          their own rules.
        </NotYetApplied>

        <div className="mb-4 flex flex-wrap gap-2">
          {DAYS.map((day, index) => {
            const on = draft['org.working_days'][index] === '1'

            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(index)}
                aria-pressed={on}
                className={cn(
                  'min-w-14 cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-all active:scale-95',
                  on
                    ? 'border-primary/20 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted/60',
                )}
              >
                {day}
              </button>
            )
          })}
        </div>

        <p className="mb-4 text-xs text-muted-foreground">
          {workingCount === 0
            ? 'No working days selected — check this is what you mean.'
            : `${workingCount} working ${workingCount === 1 ? 'day' : 'days'} a week.`}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Week starts on">
            <Select
              value={draft['org.week_start']}
              onChange={(value) => set('org.week_start', String(value))}
              options={stored.choices.week_start.map((day) => ({
                value: day,
                label: day.charAt(0).toUpperCase() + day.slice(1),
              }))}
            />
          </Field>

          <Field label="Financial year starts in" hint="April in India; January in much of Europe.">
            <Select
              value={draft['org.financial_year_start_month']}
              onChange={(value) => set('org.financial_year_start_month', String(value))}
              options={MONTHS.map((month, index) => ({
                value: String(index + 1),
                label: month,
              }))}
            />
          </Field>
        </div>
      </SectionBlock>

      <SectionBlock
        title="Money and formats"
        description="What people see unless they have chosen their own under Preferences."
      >
        <NotYetApplied when={!stored.enforced.formats}>
          Stored, but the screens across this product still use their own formats. Your personal
          date format under Preferences is unaffected either way.
        </NotYetApplied>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency">
            <Select
              value={draft['org.currency']}
              onChange={(value) => set('org.currency', String(value))}
              options={CURRENCIES}
            />
          </Field>

          <Field label="Time zone">
            <Select
              value={draft['org.timezone']}
              onChange={(value) => set('org.timezone', String(value))}
              options={TIMEZONES.map((zone) => ({ value: zone, label: zone.replace('_', ' ') }))}
            />
          </Field>

          <Field label="Date format">
            <Select
              value={draft['org.date_format']}
              onChange={(value) => set('org.date_format', String(value))}
              options={stored.choices.date_format.map((format) => ({
                value: format,
                label: `${format} — ${sampleDate(format)}`,
              }))}
            />
          </Field>

          <Field label="Number format" hint="Indian grouping puts the first separator after three digits, then every two.">
            <Select
              value={draft['org.number_format']}
              onChange={(value) => set('org.number_format', String(value))}
              options={stored.choices.number_format.map((format) => ({
                value: format,
                label: format,
              }))}
            />
          </Field>
        </div>
      </SectionBlock>

      <div className="flex justify-end border-t border-border pt-5">
        <SaveButton dirty={dirty} saving={saving} onClick={save} label="Save defaults" />
      </div>
    </div>
  )
}

/**
 * The badge that keeps this screen honest.
 *
 * Rendered from the server's own `enforced` flags, so it cannot say "applied"
 * about something the product does not yet read. When the reader lands, the flag
 * flips and this disappears without anybody editing copy.
 */
function NotYetApplied({ when, children }: { when: boolean; children: React.ReactNode }) {
  if (!when) return null

  return (
    <Alert className="mb-4">
      <Info className="size-4" aria-hidden="true" />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}

function sampleDate(format: string): string {
  if (format === 'mm/dd/yyyy') return '02/09/2026'
  if (format === 'yyyy-mm-dd') return '2026-02-09'

  return '09/02/2026'
}
