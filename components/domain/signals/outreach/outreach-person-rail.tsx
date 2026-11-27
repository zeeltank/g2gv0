'use client'

import { useRef, type KeyboardEvent } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { personInitials, personLabel, titleLine } from '@/lib/signals/outreach-model'
import type { OutreachPerson } from '@/services/signals/outreach-types'
import { ReachChip } from './reach-chip'

/**
 * The left rail of a company's People tab: one button per person (avatar, name, a star for the main contact, job title, and what can be done with them). It is the CRM People rail
 * drawn for these people. One button is in the tab order; the arrow keys, Home and End move between them, and a click or Enter opens the person. The reach is always written
 * as a word, and a person found on the web says "Not verified" under the name, so the colour is never the only sign.
 */
export function OutreachPersonRail({ people, selectedId, onSelect }: {
  people: readonly OutreachPerson[]
  selectedId: number | null
  onSelect: (id: number) => void
}) {
  const buttons = useRef<Record<number, HTMLButtonElement | null>>({})
  const stop = selectedId !== null && people.some((person) => person.id === selectedId) ? selectedId : people[0]?.id

  const move = (index: number) => {
    const next = people[(index + people.length) % people.length]
    if (next) buttons.current[next.id]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const asked = Number((event.target as HTMLElement).closest('button')?.getAttribute('data-person-id'))
    const index = people.findIndex((person) => person.id === asked)
    if (index < 0) return
    const target = event.key === 'ArrowDown' ? index + 1 : event.key === 'ArrowUp' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? people.length - 1 : null
    if (target === null) return
    event.preventDefault()
    move(target)
  }

  return (
    <div role="group" aria-label="People" onKeyDown={onKeyDown} data-person-rail>
      {people.map((person) => {
        const selected = person.id === selectedId
        return (
          <button
            key={person.id}
            ref={(element) => { buttons.current[person.id] = element }}
            type="button"
            data-person-id={person.id}
            aria-current={selected ? 'true' : undefined}
            tabIndex={person.id === stop ? 0 : -1}
            onClick={() => onSelect(person.id)}
            className={cn(
              'flex w-full items-center gap-2.5 border-b border-border px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              selected && 'bg-primary/10 shadow-[inset_3px_0_0_var(--color-primary)]',
            )}
          >
            <span aria-hidden="true" className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">{personInitials(person)}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
                {person.is_primary && (
                  <>
                    <Star className="size-3.5 shrink-0 fill-amber-500 text-amber-500" aria-hidden="true" />
                    <span className="sr-only">Main contact: </span>
                  </>
                )}
                <span className="truncate">{personLabel(person)}</span>
              </span>
              <span className="block truncate text-xs text-muted-foreground">{titleLine(person) ?? ' '}</span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                <ReachChip reach={person.reach} />
                {person.source === 'found' && <span className="text-[11px] text-muted-foreground">Not verified</span>}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
