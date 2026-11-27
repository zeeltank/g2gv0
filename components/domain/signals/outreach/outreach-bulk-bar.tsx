'use client'

import { useState } from 'react'
import { Loader2, Mail, UserCog, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import type { AssignableEmployee } from '@/components/domain/crm/lead-employees'

/**
 * The bar at the bottom of a list while rows are ticked: Write message, Convert to lead (companies only) and Assign owner. It is drawn like the bar the CRM lists use, but it is
 * its own, because that bar always offers Delete and a Send Message menu with SMS and WhatsApp, and none of those belongs here: nothing is deleted or sent from this tab's lists.
 * `convertHint` says, in words next to the disabled button, why Convert to lead is off (it makes one lead from one company, so two ticked companies cannot use it).
 */
export function OutreachBulkBar({ count, noun, nounPlural, busy, onWrite, onConvert, convertHint, employees, onAssign, onClear }: {
  count: number
  noun: string
  nounPlural: string
  busy: boolean
  onWrite: () => void
  /** Companies only; the people list has no such button. */
  onConvert?: () => void
  convertHint?: string | null
  employees: AssignableEmployee[]
  onAssign: (userId: number) => void
  onClear: () => void
}) {
  const [owner, setOwner] = useState('')
  if (count === 0) return null

  return (
    <div
      role="region"
      aria-label="Actions for the selected rows"
      className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit max-w-[calc(100%-2rem)] flex-wrap items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-2xl animate-in fade-in slide-in-from-bottom-2"
    >
      <span className="whitespace-nowrap text-sm font-semibold">{count} {count === 1 ? noun : nounPlural} selected</span>
      <div className="h-6 w-px bg-border" aria-hidden="true" />

      <Button size="sm" disabled={busy} onClick={onWrite}>
        <Mail className="mr-2 size-4" aria-hidden="true" />Write message
      </Button>

      {onConvert && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={busy || Boolean(convertHint)} title={convertHint ?? undefined} onClick={onConvert}>
            <UserPlus className="mr-2 size-4" aria-hidden="true" />Convert to lead
          </Button>
          {convertHint && <span role="note" className="max-w-[16rem] text-xs text-muted-foreground">{convertHint}</span>}
        </div>
      )}

      <div className="flex items-center gap-2">
        <SearchableSelect
          value={owner}
          onChange={setOwner}
          options={employees.map((employee) => ({ value: employee.id, label: employee.name }))}
          placeholder="Choose an owner…"
          searchPlaceholder="Search people…"
          className="w-48"
          aria-label="Owner to assign"
        />
        <Button size="sm" variant="outline" disabled={busy || !owner} onClick={() => { onAssign(Number(owner)); setOwner('') }}>
          <UserCog className="mr-2 size-4" aria-hidden="true" />Assign owner
        </Button>
      </div>

      {busy && <Loader2 className="size-4 animate-spin" aria-label="Working" />}

      <Button size="sm" variant="ghost" aria-label="Clear selection" onClick={onClear} disabled={busy}>
        <X className="size-4" aria-hidden="true" />
      </Button>
    </div>
  )
}
