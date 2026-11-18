'use client'

import { useState } from 'react'
import { Check, ChevronDown, Globe2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { LaravelContext } from '@/lib/laravel-context'
import {
  addSelection,
  draftIsEmpty,
  draftSelection,
  emptyDraft,
  regionLabel,
  regionShortLabel,
  removeSelection,
  type RegionDraft,
  type RegionSelection,
} from '@/lib/region-scope'
import { DEFAULT_COUNTRY } from '@/lib/location-repository'
import { LocationPicker } from './location-picker'

/**
 * The Region control beside the product picker.
 *
 * Three searchable, dependent dropdowns: Country, State / Province / Region, City. Countries, states and cities come from the location data on the
 * server (see location-picker.tsx); changing a level clears the levels under it. A new selection starts on India; a place that was already saved is
 * never replaced by India (the form starts on the saved place's country). Up to five places can be added; they are used for this run, and the
 * backend validates them again (a state must belong to its country, a city to its state).
 */
export function RegionSelector({
  value,
  onChange,
  draft = emptyDraft(),
  onDraft = () => {},
  disabled,
  context,
}: {
  value: RegionSelection[]
  onChange: (next: RegionSelection[]) => void
  /** What is picked but not added yet. Owned by the screen, so Generate Signals uses it too. */
  draft?: RegionDraft
  onDraft?: (next: RegionDraft) => void
  /** Kept for the screen's existing call; the saved ICP regions are no longer offered as free-text suggestions (the lists come from the location data). */
  suggestions?: string[]
  disabled?: boolean
  /** The signed-in organisation, for the location lists. */
  context?: LaravelContext
}) {
  const [problems, setProblems] = useState<string[]>([])
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  // The country the form starts on: what was picked, else the saved place's country, else India. Never India over a saved place.
  const savedCountry = value[0]?.country
  const effectiveCountry = draft.country.trim() || savedCountry || DEFAULT_COUNTRY
  const startsOnDefault = !draft.country.trim() && !savedCountry

  const pick = (next: RegionDraft) => {
    setProblems([])
    setSuccessNotice(null)
    onDraft(next)
  }

  const add = () => {
    setSuccessNotice(null)
    // An untouched form adds what it shows (the saved country, or India for a new selection); the picked codes go with the names.
    const seed: RegionDraft = draft.country.trim() ? draft : { ...draft, country: effectiveCountry, ...(value[0]?.country_code && !draft.countryCode ? { countryCode: value[0].country_code } : {}) }
    const place = draftSelection(seed)
    const r = addSelection(value, place, { cityWithoutState: draft.countryHasStates === false })
    setProblems(r.problems)
    if (r.problems.length === 0) {
      onChange(r.list)
      onDraft(emptyDraft())
      setSuccessNotice(`Added ${[place.city, place.state, place.country].filter((x) => x && x.trim()).join(', ')}`)
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id="region-label" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Region
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-labelledby="region-label"
            aria-haspopup="dialog"
            title={regionLabel(value)}
            className="flex h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-input bg-background px-3 text-left text-sm font-medium text-foreground shadow-xs transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <Globe2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">
              {regionShortLabel(value)}
              {!draftIsEmpty(draft) && (
                <span className="text-muted-foreground"> · {draft.country || '…'} (not added)</span>
              )}
            </span>
            <ChevronDown className="ml-auto size-4 shrink-0 text-foreground" strokeWidth={2.25} aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-88 sm:w-96 space-y-3.5 p-4 shadow-lg rounded-2xl border border-border/80">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <div>
              <p className="text-sm font-bold text-foreground">Where to look</p>
              <p className="text-[11px] text-muted-foreground">Filter buying signals by geographical location</p>
            </div>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={value.length === 0}
              onClick={() => {
                onChange([])
                setProblems([])
                setSuccessNotice(null)
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              All Regions
            </Button>
          </div>

          {/* Active selections */}
          {value.length === 0 ? (
            <p className="rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
              All Regions: research is not limited to a place.
            </p>
          ) : (
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">Active Locations ({value.length}/5):</span>
              <ul aria-label="Selected regions" className="flex flex-wrap gap-1.5">
                {value.map((s, i) => (
                  <li
                    key={`${s.country}|${s.state}|${s.city}`}
                    className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-foreground"
                  >
                    <span>{[s.city, s.state, s.country].filter(Boolean).join(', ')}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${[s.city, s.state, s.country].filter(Boolean).join(', ')}`}
                      className="ml-0.5 rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      onClick={() => onChange(removeSelection(value, i))}
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Location form: Country, State / Province / Region, City */}
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Add Location</span>
              {startsOnDefault && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  India Selected by Default
                </span>
              )}
            </div>

            <LocationPicker context={context ?? ({} as LaravelContext)} draft={draft} onDraft={pick} effectiveCountry={effectiveCountry} disabled={disabled} />

            {problems.length > 0 && (
              <ul role="alert" className="list-disc space-y-0.5 pl-4 text-xs text-destructive">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}

            {successNotice && (
              <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Check className="size-3.5" />
                <span>{successNotice}</span>
              </div>
            )}

            <Button type="button" size="sm" variant="default" onClick={add} className="w-full text-xs font-semibold">
              <Plus className="mr-1.5 size-3.5" />
              Add place
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            A chosen location is used when you press Generate Signals. For one sub-product it is also saved to that sub-product&apos;s ICP; for Whole Product it
            is used for this run only. A city or state must be named in the source itself for a signal to qualify.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  )
}
