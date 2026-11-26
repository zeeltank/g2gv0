'use client'

import { Radio, RadioGroup } from '@/components/ui/radio-group'
import { chooseable, contactBlock, contactLabel } from '@/lib/gtm/qualify-model'
import type { GtmContact } from '@/services/gtm/gtm'

/**
 * Which PERSON at an account (S20): a list of the account's people, one to choose. Someone who asked not to be contacted, unsubscribed, or whose email bounced
 * is shown, disabled, with the reason, so nobody wonders where they went. Used by "Qualify as lead" in Prospecting and by a signal's "Convert to lead".
 */
export function PersonChoice({ contacts, value, onChange, name, extra }: {
  contacts: readonly GtmContact[]
  value: string
  onChange: (id: string) => void
  name: string
  /** One more choice at the end, outside the people (a signal's "No person yet"). */
  extra?: { value: string; label: string }
}) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="gap-2" aria-label="Person">
      {chooseable(contacts).map((c) => {
        const block = contactBlock(c)
        return (
          <Radio
            key={c.id}
            name={name}
            value={String(c.id)}
            disabled={block !== null}
            label={<span className={block ? 'text-muted-foreground' : undefined}>{contactLabel(c)}{block ? ` — ${block}` : ''}</span>}
          />
        )
      })}
      {extra && <Radio name={name} value={extra.value} label={extra.label} />}
    </RadioGroup>
  )
}
