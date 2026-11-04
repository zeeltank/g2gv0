'use client'

import { useMemo, useState } from 'react'
import { Check, Globe2, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  addSelection,
  countryOptions,
  draftIsEmpty,
  emptyDraft,
  regionLabel,
  regionShortLabel,
  removeSelection,
  type RegionDraft,
  type RegionSelection,
} from '@/lib/region-scope'
import {
  addCustomLocation,
  DEFAULT_COUNTRY,
  getAvailableCities,
  getAvailableCountries,
  getAvailableStates,
} from '@/lib/location-repository'

/**
 * The Region control beside the product picker.
 * Country -> State / Province -> City hierarchy with India as the default country.
 * Provides searchable country selection, pre-seeded Indian states and global territories,
 * custom state and city creation without duplicates, and persists selections.
 */
export function RegionSelector({
  value,
  onChange,
  draft = emptyDraft(),
  onDraft = () => {},
  suggestions = [],
  disabled,
}: {
  value: RegionSelection[]
  onChange: (next: RegionSelection[]) => void
  /** What is typed but not added yet. Owned by the screen, so Generate Signals uses it too. */
  draft?: RegionDraft
  onDraft?: (next: RegionDraft) => void
  /** The product's saved ICP regions, offered as state / province suggestions (read only). */
  suggestions?: string[]
  disabled?: boolean
}) {
  const countries = useMemo(() => getAvailableCountries(), [])
  const { country, state, city } = draft

  // Ensure strict match for existing test assertions
  const setCountry = (v: string) => onDraft({ country: v, state: '', city: '' })
  const setState = (v: string) => onDraft({ ...draft, state: v, city: v.trim() === '' ? '' : draft.city })
  const setCity = (v: string) => onDraft({ ...draft, city: v })

  const [problems, setProblems] = useState<string[]>([])
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  // Custom addition modes
  const [customCountryMode, setCustomCountryMode] = useState(false)
  const [customCountryInput, setCustomCountryInput] = useState('')
  const [customStateMode, setCustomStateMode] = useState(false)
  const [customStateInput, setCustomStateInput] = useState('')
  const [customCityMode, setCustomCityMode] = useState(false)
  const [customCityInput, setCustomCityInput] = useState('')

  // Country search filter
  const [countrySearch, setCountrySearch] = useState('')

  // Preselected country: defaults to India when nothing is specified in draft
  const effectiveCountry = country.trim() || DEFAULT_COUNTRY

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countries
    const q = countrySearch.trim().toLowerCase()
    return countries.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
  }, [countries, countrySearch])

  const availableStates = useMemo(
    () => getAvailableStates(effectiveCountry, suggestions),
    [effectiveCountry, suggestions]
  )

  const availableCities = useMemo(
    () => getAvailableCities(effectiveCountry, state),
    [effectiveCountry, state]
  )

  const handleCountryChange = (chosen: string) => {
    setProblems([])
    setSuccessNotice(null)
    setCustomStateMode(false)
    setCustomCityMode(false)
    setCustomStateInput('')
    setCustomCityInput('')

    if (chosen === '__custom__') {
      setCustomCountryMode(true)
      return
    }
    setCustomCountryMode(false)
    setCountry(chosen)
  }

  const handleAddCustomCountry = () => {
    const trimmed = customCountryInput.trim()
    if (!trimmed) {
      setProblems(['Country name cannot be empty.'])
      return
    }
    // Prevent duplicate: check against available countries
    const existing = countries.find((c) => c.name.toLowerCase() === trimmed.toLowerCase())
    const target = existing ? existing.name : trimmed
    addCustomLocation({ country: target })
    setCountry(target)
    setCustomCountryMode(false)
    setCustomCountryInput('')
    setProblems([])
  }

  const handleStateChange = (chosen: string) => {
    setProblems([])
    setSuccessNotice(null)
    setCustomCityMode(false)
    setCustomCityInput('')

    if (chosen === '__custom__') {
      setCustomStateMode(true)
      return
    }
    setCustomStateMode(false)
    setState(chosen)
  }

  const handleAddCustomState = () => {
    const trimmed = customStateInput.trim()
    if (!trimmed) {
      setProblems(['State / province name cannot be empty.'])
      return
    }
    // Prevent duplicate within country (case-insensitive)
    const existing = availableStates.find((s) => s.toLowerCase() === trimmed.toLowerCase())
    const target = existing || trimmed
    addCustomLocation({ country: effectiveCountry, state: target })
    setState(target)
    setCustomStateMode(false)
    setCustomStateInput('')
    setProblems([])
  }

  const handleCityChange = (chosen: string) => {
    setProblems([])
    setSuccessNotice(null)

    if (chosen === '__custom__') {
      setCustomCityMode(true)
      return
    }
    setCustomCityMode(false)
    setCity(chosen)
  }

  const handleAddCustomCity = () => {
    const trimmed = customCityInput.trim()
    if (!trimmed) {
      setProblems(['City name cannot be empty.'])
      return
    }
    // Prevent duplicate within state (case-insensitive)
    const existing = availableCities.find((c) => c.toLowerCase() === trimmed.toLowerCase())
    const target = existing || trimmed
    addCustomLocation({ country: effectiveCountry, state, city: target })
    setCity(target)
    setCustomCityMode(false)
    setCustomCityInput('')
    setProblems([])
  }

  const add = () => {
    setSuccessNotice(null)
    const countryToAdd = country.trim() || DEFAULT_COUNTRY
    const place = { country: countryToAdd, state: state.trim() || undefined, city: city.trim() || undefined }

    // Save custom state or city to location store if present
    if (place.state) {
      addCustomLocation({ country: countryToAdd, state: place.state, city: place.city })
    }

    const r = addSelection(value, place)
    setProblems(r.problems)
    if (r.problems.length === 0) {
      onChange(r.list)
      onDraft(emptyDraft())
      setCustomCountryMode(false)
      setCustomStateMode(false)
      setCustomCityMode(false)
      setSuccessNotice(`Added ${[place.city, place.state, place.country].filter(Boolean).join(', ')}`)
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

          {/* Location Management Form */}
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Add Location</span>
              {effectiveCountry === DEFAULT_COUNTRY && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  India Selected by Default
                </span>
              )}
            </div>

            {/* 1. Country Selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="region-country-select" className="text-xs font-medium text-foreground">
                  Country
                </label>
                <button
                  type="button"
                  onClick={() => setCustomCountryMode((prev) => !prev)}
                  className="text-[11px] text-primary hover:underline"
                >
                  {customCountryMode ? 'Choose from list' : '+ Add custom country'}
                </button>
              </div>

              {customCountryMode ? (
                <div className="flex gap-1.5">
                  <Input
                    placeholder="Enter country name (e.g. Japan)"
                    value={customCountryInput}
                    onChange={(e) => setCustomCountryInput(e.target.value)}
                    className="h-8 text-xs"
                    maxLength={80}
                  />
                  <Button type="button" size="xs" onClick={handleAddCustomCountry} className="h-8 px-2.5 text-xs">
                    Set
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {countries.length > 10 && (
                    <div className="relative">
                      <Search className="absolute left-2 top-2 size-3 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search country…"
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        className="h-7 w-full rounded-md border border-input bg-background pl-6 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                  )}
                  <select
                    id="region-country-select"
                    aria-label="Country"
                    value={country || DEFAULT_COUNTRY}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="India">India (Default)</option>
                    <option value="__custom__">+ Add other country…</option>
                    <optgroup label="Supported Countries">
                      {filteredCountries.map((c) => (
                        <option key={c.code} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}
            </div>

            {/* 2. State / Province Selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="region-state-select" className="text-xs font-medium text-foreground">
                  State / Province <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setCustomStateMode((prev) => !prev)}
                  className="text-[11px] text-primary hover:underline"
                >
                  {customStateMode ? 'Choose from list' : '+ Add new state'}
                </button>
              </div>

              {customStateMode ? (
                <div className="flex gap-1.5">
                  <Input
                    placeholder="Enter state name (e.g. Haryana)"
                    value={customStateInput}
                    onChange={(e) => setCustomStateInput(e.target.value)}
                    className="h-8 text-xs"
                    maxLength={80}
                  />
                  <Button type="button" size="xs" onClick={handleAddCustomState} className="h-8 px-2.5 text-xs">
                    Set
                  </Button>
                </div>
              ) : (
                <select
                  id="region-state-select"
                  aria-label="State or province"
                  value={state}
                  onChange={(e) => handleStateChange(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Choose state / province (optional)</option>
                  <option value="__custom__">+ Add new state / province…</option>
                  {availableStates.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 3. City Selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="region-city-select" className="text-xs font-medium text-foreground">
                  City <span className="text-muted-foreground font-normal">(optional, needs a state)</span>
                </label>
                {state.trim() && (
                  <button
                    type="button"
                    onClick={() => setCustomCityMode((prev) => !prev)}
                    className="text-[11px] text-primary hover:underline"
                  >
                    {customCityMode ? 'Choose from list' : '+ Add new city'}
                  </button>
                )}
              </div>

              {customCityMode ? (
                <div className="flex gap-1.5">
                  <Input
                    placeholder="Enter city name (e.g. Surat)"
                    value={customCityInput}
                    onChange={(e) => setCustomCityInput(e.target.value)}
                    className="h-8 text-xs"
                    maxLength={80}
                  />
                  <Button type="button" size="xs" onClick={handleAddCustomCity} className="h-8 px-2.5 text-xs">
                    Set
                  </Button>
                </div>
              ) : (
                <select
                  id="region-city-select"
                  aria-label="City"
                  value={city}
                  disabled={!state.trim()}
                  onChange={(e) => handleCityChange(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  <option value="">
                    {state.trim() ? 'Choose city (optional)' : 'Select state first'}
                  </option>
                  {state.trim() && <option value="__custom__">+ Add new city…</option>}
                  {availableCities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Error alerts */}
            {problems.length > 0 && (
              <ul role="alert" className="list-disc space-y-0.5 pl-4 text-xs text-destructive">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}

            {/* Success feedback */}
            {successNotice && (
              <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Check className="size-3.5" />
                <span>{successNotice}</span>
              </div>
            )}

            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={add}
              className="w-full text-xs font-semibold"
            >
              <Plus className="mr-1.5 size-3.5" />
              Add place
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Used for this run only. India is selected by default. A chosen location is used when you press Generate Signals.
            A city or state must be named in the source itself for a signal to qualify.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  )
}
