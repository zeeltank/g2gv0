'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { LaravelContext } from '@/lib/laravel-context'
import { createLocationLoader, foldText, type CountriesAnswer, type CountryOption, type LocationLoader } from '@/lib/location-api'
import type { RegionDraft } from '@/lib/region-scope'
import { opportunitiesService } from '@/services/signals/opportunities'
import { SearchableSelect, type SelectOption } from './searchable-select'

type Status = 'idle' | 'loading' | 'ready' | 'error'

/**
 * Loads the country list once and says where it stands. The answer is stored with the request it belongs to, so a reply for an earlier attempt can
 * never replace a newer one (a retry starts a new attempt).
 */
function useCountries(load: () => Promise<CountriesAnswer>, retry: number): { status: Status; data: CountriesAnswer | null } {
  const [result, setResult] = useState<{ attempt: number; data?: CountriesAnswer; failed?: boolean } | null>(null)
  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })
  useEffect(() => {
    let live = true
    loadRef.current().then(
      (data) => { if (live) setResult({ attempt: retry, data }) },
      () => { if (live) setResult({ attempt: retry, failed: true }) },
    )
    return () => { live = false }
  }, [retry])
  const current = result?.attempt === retry ? result : null
  const status: Status = current === null ? 'loading' : current.failed ? 'error' : 'ready'
  return { status, data: current && !current.failed ? (current.data ?? null) : null }
}

const countryOption = (c: CountryOption): SelectOption => ({ value: c.code, label: c.name, prefix: c.emoji, hint: c.code })

const FIELD =
  'h-9 w-full min-w-0 rounded-md border border-input bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

/**
 * Region form: a searchable Country dropdown (all countries, from the location data) and two plain text inputs, State / Province and City.
 *  - State and City are free text and optional: nothing is looked up for them and nothing is suggested.
 *  - Changing the country keeps what was typed in State and City (a person fixing the country should not lose their text).
 *  - `effectiveCountry` is what shows when nothing was picked yet (India for a new selection, or the saved place's country); it is never written over a
 *    saved place. A country the list does not know (an older saved region) is shown as it is.
 * It only reports what was entered through `onDraft`; the backend validates again.
 */
export function LocationPicker({
  context,
  draft,
  onDraft,
  effectiveCountry,
  disabled = false,
  loader: injected,
}: {
  context: LaravelContext
  draft: RegionDraft
  onDraft: (next: RegionDraft) => void
  effectiveCountry: string
  disabled?: boolean
  /** Tests give a loader backed by a stub; the app builds its own from the service. */
  loader?: LocationLoader
}) {
  const loader = useMemo(() => injected ?? createLocationLoader(opportunitiesService, context), [injected, context])
  const [retry, setRetry] = useState(0)

  const countriesLoad = useCountries(() => loader.countries(), retry)
  const countryList = countriesLoad.data?.countries
  const countries: CountryOption[] = useMemo(() => countryList ?? [], [countryList])
  const wantedName = draft.country.trim() || effectiveCountry
  const country = useMemo(
    () => countries.find((c) => (draft.countryCode ? c.code === draft.countryCode : foldText(c.name) === foldText(wantedName))) ?? null,
    [countries, draft.countryCode, wantedName],
  )
  const countryValue: SelectOption | null = country ? countryOption(country) : wantedName ? { value: '__typed__', label: wantedName } : null

  const pickCountry = (option: SelectOption | null) => {
    if (!option) return
    const chosen = countries.find((c) => c.code === option.value)
    if (!chosen) return
    // The typed state and city stay. They belonged to a free-text entry, not to a list, so there is no reason to erase them.
    onDraft({ country: chosen.name, state: draft.state, city: draft.city, countryCode: chosen.code })
  }
  // A typed value has no catalogue id, so none is kept.
  const base = (): RegionDraft => ({
    country: draft.country.trim() || effectiveCountry,
    state: draft.state,
    city: draft.city,
    ...(country ? { countryCode: country.code } : draft.countryCode ? { countryCode: draft.countryCode } : {}),
  })
  const setState = (state: string) => onDraft({ ...base(), state })
  const setCity = (city: string) => onDraft({ ...base(), city })
  const noSubmit = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.preventDefault()   // typing a place never submits a surrounding form
  }

  return (
    <div className="space-y-3">
      <SearchableSelect
        id="region-country"
        label="Country"
        required
        options={countries.map(countryOption)}
        value={countryValue}
        onSelect={pickCountry}
        loading={countriesLoad.status === 'loading'}
        error={countriesLoad.status === 'error' ? 'The country list could not be loaded.' : null}
        emptyText="No country matches your search."
        placeholder="Choose a country"
        searchPlaceholder="Search country…"
        disabled={disabled}
      />
      {countriesLoad.status === 'error' && (
        <button type="button" onClick={() => setRetry((n) => n + 1)} className="text-[11px] text-primary hover:underline">
          Could not load countries. Try again
        </button>
      )}

      <div className="space-y-1.5">
        <label htmlFor="region-state" className="text-xs font-medium text-foreground">State / Province / Region</label>
        <input
          id="region-state"
          type="text"
          autoComplete="off"
          maxLength={80}
          placeholder="Enter state / province"
          value={draft.state}
          onChange={(event) => setState(event.target.value)}
          onKeyDown={noSubmit}
          disabled={disabled}
          className={FIELD}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="region-city" className="text-xs font-medium text-foreground">City</label>
        <input
          id="region-city"
          type="text"
          autoComplete="off"
          maxLength={80}
          placeholder="Enter city"
          value={draft.city}
          onChange={(event) => setCity(event.target.value)}
          onKeyDown={noSubmit}
          disabled={disabled}
          className={FIELD}
        />
      </div>
    </div>
  )
}
