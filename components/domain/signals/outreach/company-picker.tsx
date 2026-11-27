'use client'

import { useEffect, useId, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FIELD_ERROR_TEXT } from '@/lib/org-accounts/tones'
import type { OutreachApi } from '@/services/signals/outreach'
import type { OutreachCompany } from '@/services/signals/outreach-types'
import { SEARCH_DELAY_MS } from './outreach-parts'

export interface PickedCompany {
  id: number
  name: string
}

const SHOWN = 8

/**
 * Choosing the company a person belongs to, from the companies of this list. A company list can be long, so the box asks the server (the first few by name, then whatever the
 * person has typed) instead of loading every company into a drop-down. Once one is chosen it is shown as a name with a Change button.
 */
export function CompanyPicker({ service, value, onChange, error }: { service: OutreachApi; value: PickedCompany | null; onChange: (company: PickedCompany | null) => void; error?: string }) {
  const id = useId()
  const [typed, setTyped] = useState('')
  const [results, setResults] = useState<OutreachCompany[] | null>(null)
  const [failed, setFailed] = useState(false)
  const choosing = value === null

  useEffect(() => {
    if (!choosing) return
    let live = true
    const search = typed.trim()
    const handle = setTimeout(() => {
      service.companies({ search: search || undefined, per_page: SHOWN, sort: 'name', dir: 'asc' })
        .then((response) => { if (live) { setResults(response.data); setFailed(false) } })
        .catch(() => { if (live) setFailed(true) })
    }, search ? SEARCH_DELAY_MS : 0)
    return () => { live = false; clearTimeout(handle) }
  }, [choosing, typed, service])

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-search`}>Company *</Label>
      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm">
          <span data-picked-company={value.id} className="min-w-0 truncate font-medium text-foreground">{value.name}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => onChange(null)}>Change</Button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id={`${id}-search`}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder="Type the company name"
              className="pl-9"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
            />
          </div>
          {failed && <p role="alert" className="text-xs text-muted-foreground">The companies could not be loaded. Try typing the name again.</p>}
          {results !== null && !failed && results.length === 0 && <p className="text-xs text-muted-foreground">No company matches. Add the company first, then add the person.</p>}
          {results !== null && results.length > 0 && (
            <ul role="listbox" aria-label="Companies" className="max-h-44 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {results.map((company) => (
                <li key={company.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => onChange({ id: company.id, name: company.name })}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className="font-medium text-foreground">{company.name}</span>
                    {(company.location || company.industry) && <span className="text-xs text-muted-foreground">{[company.industry, company.location].filter(Boolean).join(' · ')}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {error && <p id={`${id}-error`} className={`text-xs ${FIELD_ERROR_TEXT}`}>{error}</p>}
    </div>
  )
}
