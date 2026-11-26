import { cn } from '@/lib/utils'
import { CHIP_BASE, CHIP_TONE } from '@/lib/org-accounts/tones'
import type { PersonTag } from '@/types/crm'

/**
 * Whose row it is, on a company's Emails, Schedule, Documents, Comments, History and Quotes when the Company only | Everyone switch is on Everyone (S18).
 * The server tags every row it answers with `include=people`: `personName` is the person's name, or null for a row of the company itself. A list that was
 * not asked for people (no `personName` key at all) draws nothing, so the older server and every other screen look as they did.
 */
export function whoLabel(row: PersonTag): string | null {
  if (row.personName === undefined) return null
  return row.personName ? row.personName : 'Company'
}

export function WhoChip({ row, className }: { row: PersonTag; className?: string }) {
  const label = whoLabel(row)
  if (label === null) return null
  const company = !row.personName
  return (
    <span data-who={company ? 'company' : 'person'} className={cn(CHIP_BASE, company ? CHIP_TONE.muted : CHIP_TONE.info, className)}>
      <span className="sr-only">Who: </span>
      {label}
    </span>
  )
}
