'use client'

import { useMemo, useState } from 'react'
import { Globe2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { addSelection, countryOptions, regionLabel, regionShortLabel, removeSelection, type RegionSelection } from '@/lib/region-scope'

/**
 * The Region control beside the product picker. Country, then state / province, then city (each level optional, a city needs its state); up to
 * five places; "All Regions" clears them. The choice belongs to this request only: it is sent with Generate Signals and saved nowhere.
 * Countries come from the browser's own locale data; states and cities are typed (suggestions are the product's own ICP regions) and checked by
 * the server again.
 */
export function RegionSelector({
  value, onChange, suggestions = [], disabled,
}: {
  value: RegionSelection[]
  onChange: (next: RegionSelection[]) => void
  /** The product's saved ICP regions, offered as state / province suggestions (read only). */
  suggestions?: string[]
  disabled?: boolean
}) {
  const countries = useMemo(() => countryOptions(), [])
  const [country, setCountry] = useState('')
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [problems, setProblems] = useState<string[]>([])

  const add = () => {
    const r = addSelection(value, { country, state, city })
    setProblems(r.problems)
    if (r.problems.length === 0) {
      onChange(r.list)
      setCity(''); setState('')
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span id="region-label" className="text-xs font-medium text-muted-foreground">Region</span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-labelledby="region-label"
            aria-haspopup="dialog"
            title={regionLabel(value)}
            className="flex h-10 min-w-48 max-w-72 items-center gap-2 rounded-lg border border-input bg-background px-3 text-left text-sm font-medium text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <Globe2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{regionShortLabel(value)}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 space-y-3 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Where to look</p>
            <Button type="button" size="xs" variant="ghost" disabled={value.length === 0} onClick={() => { onChange([]); setProblems([]) }}>All Regions</Button>
          </div>
          {value.length === 0 ? (
            <p className="text-xs text-muted-foreground">All Regions: research is not limited to a place.</p>
          ) : (
            <ul aria-label="Selected regions" className="flex flex-wrap gap-1.5">
              {value.map((s, i) => (
                <li key={`${s.country}|${s.state}|${s.city}`} className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs">
                  <span>{[s.city, s.state, s.country].filter(Boolean).join(', ')}</span>
                  <button type="button" aria-label={`Remove ${[s.city, s.state, s.country].filter(Boolean).join(', ')}`} className="rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onChange(removeSelection(value, i))}><X className="size-3" /></button>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-foreground">Country</span>
              <select aria-label="Country" value={country} onChange={(e) => { setCountry(e.target.value); setState(''); setCity('') }} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Choose a country</option>
                {countries.map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-foreground">State / province (optional)</span>
              <Input aria-label="State or province" list="region-state-suggestions" value={state} disabled={!country} maxLength={80} onChange={(e) => { setState(e.target.value); if (e.target.value.trim() === '') setCity('') }} />
              <datalist id="region-state-suggestions">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-foreground">City (optional, needs a state)</span>
              <Input aria-label="City" value={city} disabled={!state.trim()} maxLength={80} onChange={(e) => setCity(e.target.value)} />
            </label>
            {problems.length > 0 && <ul role="alert" className="list-disc space-y-0.5 pl-5 text-xs text-destructive">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
            <Button type="button" size="sm" variant="outline" disabled={!country} onClick={add}>Add place</Button>
          </div>
          <p className="text-xs text-muted-foreground">Used for this run only. A city or state must be named in the source itself for a signal to count.</p>
        </PopoverContent>
      </Popover>
    </div>
  )
}
