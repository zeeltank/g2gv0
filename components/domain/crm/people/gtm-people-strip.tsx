'use client'

import { useEffect, useId, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { orgAccountsService } from '@/services/org-accounts/org-accounts-service'
import type { OrgAccountsApi } from '@/services/org-accounts/api-types'
import type { OrgContactLine } from '@/services/org-accounts/types'

/**
 * "Also found in GTM (n)": the people the GTM side knows at this company (the same Account 360 call the Account 360 tab makes: its contact lines whose
 * source is GTM). Read-only and collapsed: they are not CRM people, nothing is sent from here (so plain text, no mailto: or tel:), and a company that has
 * none, or a call that fails (no GTM right), shows nothing at all rather than a problem the person cannot act on.
 */
export function GtmPeopleStrip({ organizationId, service = orgAccountsService }: { organizationId: string; service?: OrgAccountsApi }) {
  const [lines, setLines] = useState<OrgContactLine[] | null>(null)
  const [open, setOpen] = useState(false)
  const panelId = useId()

  useEffect(() => {
    let active = true
    service.forCrm(organizationId)
      .then((response) => { if (active) setLines(response.data.contacts.filter((line) => line.source === 'gtm')) })
      .catch(() => { if (active) setLines([]) })
    return () => { active = false }
  }, [organizationId, service])

  if (!lines || lines.length === 0) return null

  return (
    <div data-gtm-strip className="border-t border-border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm text-muted-foreground outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span>Also found in GTM ({lines.length})</span>
        <span className="inline-flex items-center gap-1 text-xs">
          {open ? 'Hide' : 'Show'}
          {open ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronRight className="size-3.5" aria-hidden="true" />}
        </span>
      </button>
      <div id={panelId} hidden={!open}>
        {open && (
          <>
            <ul className="divide-y divide-border">
              {lines.map((line) => (
                <li key={line.id} className="px-3 py-2">
                  <p className="text-sm font-medium text-foreground">{line.name}</p>
                  <p className="break-all text-xs text-muted-foreground">{[line.role, line.email, line.phone].filter(Boolean).join(' · ') || '—'}</p>
                </li>
              ))}
            </ul>
            <p className="px-3 pb-2.5 text-xs text-muted-foreground">Read only. These people come from GTM; they are not in this company&apos;s People list.</p>
          </>
        )}
      </div>
    </div>
  )
}
