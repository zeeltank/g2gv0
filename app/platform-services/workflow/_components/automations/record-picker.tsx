'use client'

import { useEffect, useId, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import { ENTITY_NAMES, entitySingular } from '@/lib/workflows/labels'
import { workflowErrorMessage } from '@/lib/workflows/messages'
import { AutoField } from './auto-field'
import { hasRecordSource, loadRecords, type RecordChoice } from './record-sources'

interface Loaded {
  key: string
  rows: RecordChoice[]
  error: string | null
}

/**
 * Choosing a real record to try an automation on. Records of a kind that has a list (a lead, an opportunity, a quote, an account ...) are found by
 * searching it and chosen from a short list; any other kind is chosen by typing the record's number.
 */
export function RecordPicker({ entity, value, onChange }: {
  entity: string | null
  value: number | null
  onChange: (id: number | null) => void
}) {
  const noun = entitySingular(entity)
  const plural = (entity && ENTITY_NAMES[entity]?.plural) || 'records'
  const listed = hasRecordSource(entity)
  const [query, setQuery] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const groupName = useId()
  const key = `${entity ?? ''}|${query.trim()}|${attempt}`

  useEffect(() => {
    if (!listed || !entity) return
    let alive = true
    const timer = setTimeout(() => {
      loadRecords(entity, query)
        .then((rows) => { if (alive) setLoaded({ key, rows, error: null }) })
        .catch((e) => { if (alive) setLoaded({ key, rows: [], error: workflowErrorMessage(e, `The ${plural} could not be loaded. Check your connection and try again.`) }) })
    }, query.trim() === '' && attempt === 0 ? 0 : 300)
    return () => { alive = false; clearTimeout(timer) }
    // `key` is built from the three values below and changes whenever one of them does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, query, attempt, listed])

  if (!listed) {
    return (
      <AutoField label={`Number of the ${noun}`} required hint={`Enter the number of a real ${noun}. Nothing is changed.`}>
        {(control) => (
          <Input
            {...control}
            name="record-number"
            type="number"
            inputMode="numeric"
            min={1}
            autoComplete="off"
            spellCheck={false}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value.trim() === '' ? null : Number(e.target.value))}
          />
        )}
      </AutoField>
    )
  }

  const loading = loaded?.key !== key
  const rows = loaded?.key === key ? loaded.rows : []
  const error = loaded?.key === key ? loaded.error : null

  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-medium text-foreground">Choose a {noun} to try it on</legend>
      <SearchInput
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${plural}…`}
        aria-label={`Search ${plural}`}
        name="record-search"
        autoComplete="off"
        spellCheck={false}
        icon={<Search className="size-4" aria-hidden="true" />}
      />
      {loading && <p role="status" className="text-sm text-muted-foreground">Loading {plural}…</p>}
      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-foreground">
          <span className="break-words">{error}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
        </div>
      )}
      {!loading && !error && rows.length === 0 && <p className="text-sm text-muted-foreground">No {plural} found. Try another search.</p>}
      {rows.length > 0 && (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li key={row.id}>
              <label className="flex min-h-8 cursor-pointer touch-manipulation items-start gap-2 rounded-md border border-border bg-card p-2 transition-colors hover:bg-muted has-[:checked]:border-primary">
                <input
                  type="radio"
                  name={groupName}
                  value={row.id}
                  checked={value === row.id}
                  onChange={() => onChange(row.id)}
                  className="mt-1 size-4 flex-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span className="min-w-0">
                  <span className="block break-words text-sm text-foreground">{row.label}</span>
                  {row.hint && <span className="block break-words text-xs text-muted-foreground">{row.hint}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  )
}
