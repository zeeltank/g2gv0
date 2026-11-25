'use client'

import { cn } from '@/lib/utils'
import type { CompanyActivityScope } from '@/types/crm'

const OPTIONS: ReadonlyArray<{ value: CompanyActivityScope; label: string }> = [
  { value: 'company', label: 'Company only' },
  { value: 'people', label: 'Everyone' },
]

/**
 * The Company only | Everyone switch of a company's Emails, Schedule, Documents, Comments, History and Quotes tabs (S18). "Everyone" (`people`, the default)
 * asks the server for the company's own rows and its people's, each tagged with whose it is; "Company only" asks for the company's own.
 */
export function CompanyActivitySwitch({ value, onChange, className }: { value: CompanyActivityScope; onChange: (next: CompanyActivityScope) => void; className?: string }) {
  return (
    <div role="group" aria-label="Show rows of" data-company-activity-switch className={cn('inline-flex rounded-lg border border-border bg-card p-0.5', className)}>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          data-scope={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
