'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isLaravelContextReady, type LaravelContext } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'

interface Match {
  id: string
  name: string
  industry: string | null
}

const WAIT_MS = 200

/**
 * "Use an existing organization instead", for the Convert Lead pop-up: type to search the organizations (the same list service the Organizations screen uses,
 * ten at a time, so a tenant with thousands of companies is searched, not scrolled), press one to choose it. The chosen one is shown with a Change button.
 */
export function ConvertOrganizationPicker({ context, chosenId, chosenName, onChoose }: {
  context: LaravelContext
  chosenId: string
  chosenName: string
  onChoose: (id: string, name: string) => void
}) {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (chosenId !== '' || !isLaravelContextReady(context)) return
    let active = true
    const timer = setTimeout(() => {
      crmService.getOrganizations(context, { perPage: 10, search: query.trim() || undefined, sortBy: 'name', sortDir: 'asc' })
        .then((response) => {
          if (!active) return
          const items = Array.isArray(response.data?.items) ? response.data.items : []
          setMatches(items.map((o) => ({ id: String(o.id), name: o.name, industry: o.industry ?? null })))
          setFailed(false)
        })
        .catch(() => { if (active) { setMatches([]); setFailed(true) } })
    }, query === '' ? 0 : WAIT_MS)
    return () => { active = false; clearTimeout(timer) }
  }, [context, chosenId, query])

  if (chosenId !== '') {
    return (
      <div data-chosen-organization className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm">
        <span className="min-w-0 truncate font-medium text-foreground">{chosenName}</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChoose('', '')}>Change</Button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="convert-org-search">Search organizations</Label>
      <Input id="convert-org-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Start typing a company name…" autoComplete="off" />
      {matches !== null && matches.length > 0 && (
        <div role="listbox" aria-label="Matching organizations" className="max-h-40 divide-y divide-border overflow-y-auto rounded-md border border-border bg-card">
          {matches.map((match) => (
            <button
              key={match.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => onChoose(match.id, match.name)}
              className="flex w-full flex-col items-start px-3 py-1.5 text-left text-sm text-foreground hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
            >
              <span>{match.name}</span>
              {match.industry && <span className="text-xs text-muted-foreground">{match.industry}</span>}
            </button>
          ))}
        </div>
      )}
      {matches !== null && matches.length === 0 && (
        <p role="status" className="text-xs text-muted-foreground">{failed ? 'The organizations could not be loaded.' : 'No organizations match.'}</p>
      )}
    </div>
  )
}
