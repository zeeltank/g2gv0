'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { foldText, type LocationLoader, type StateOption } from '@/lib/location-api'
import { SearchableSelect, type SelectOption } from './searchable-select'

/**
 * The State / Province field as a searchable list of the chosen country's states (from the same location data as the rest of the Region form).
 * Used where a list belongs to one place. Until the list has arrived it shows the plain `fallback` text box, and it keeps showing it for
 * a country that has no state list, so a person is never stuck. Nothing is asked for when there is no country yet.
 */
export function StateDropdown({ loader, countryCode, value, onPick, disabled = false, fallback }: {
  loader: LocationLoader
  countryCode: string | null
  /** The state as typed or picked so far. */
  value: string
  onPick: (picked: { name: string; code: string } | null) => void
  disabled?: boolean
  /** What to show when there is no state list: the text box. */
  fallback: ReactNode
}) {
  // Kept with the country the answer belongs to, so a reply for an earlier country is never shown for a new one.
  const [answer, setAnswer] = useState<{ code: string; states: StateOption[] } | null>(null)
  useEffect(() => {
    if (!countryCode) return
    let live = true
    loader.states(countryCode).then(
      (a) => { if (live) setAnswer({ code: countryCode, states: a.states }) },
      () => { if (live) setAnswer({ code: countryCode, states: [] }) },
    )
    return () => { live = false }
  }, [loader, countryCode])

  const states = countryCode && answer?.code === countryCode ? answer.states : null
  const options: SelectOption[] = useMemo(() => (states ?? []).map((s) => ({ value: s.code, label: s.name, hint: s.code })), [states])

  if (states !== null && states.length === 0) return <>{fallback}</>
  if (countryCode === null) return <>{fallback}</>

  const current: SelectOption | null = value.trim()
    ? (options.find((o) => foldText(o.label) === foldText(value)) ?? { value: '__typed__', label: value })
    : null

  return (
    <SearchableSelect
      id="region-state"
      label="State / Province / Region"
      options={options}
      value={current}
      onSelect={(option) => onPick(option && option.value !== '__typed__' ? { name: option.label, code: option.value } : null)}
      loading={states === null}
      emptyText="No state matches your search."
      placeholder="Choose a state"
      searchPlaceholder="Search state…"
      disabled={disabled}
      clearable
    />
  )
}
