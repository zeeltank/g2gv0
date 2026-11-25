'use client'

import { useRef, type KeyboardEvent } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Contact } from '@/types/crm'
import { personInitials, personName, restriction } from './person-model'

/**
 * The left rail of the People tab: one button per person (avatar, name, a star for the primary, title and department, a dot for what the person has asked not
 * to receive). One of them is in the tab order; the arrow keys, Home and End move between them, and Enter or a click opens the person. The dot is never the
 * only sign: the restriction is also written for a screen reader.
 */
export function PersonRail({ people, selectedId, onSelect }: {
  people: readonly Contact[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({})
  const stop = selectedId && people.some((p) => p.id === selectedId) ? selectedId : people[0]?.id

  const move = (index: number) => {
    const next = people[(index + people.length) % people.length]
    if (next) buttons.current[next.id]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = people.findIndex((p) => p.id === (event.target as HTMLElement).closest('button')?.getAttribute('data-person-id'))
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
        const restricted = restriction(person)
        return (
          <button
            key={person.id}
            ref={(el) => { buttons.current[person.id] = el }}
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
                {person.isPrimary && (
                  <>
                    <Star className="size-3.5 shrink-0 fill-amber-500 text-amber-500" aria-hidden="true" />
                    <span className="sr-only">Primary contact: </span>
                  </>
                )}
                <span className="truncate">{personName(person) || `Person #${person.id}`}</span>
              </span>
              <span className="block truncate text-xs text-muted-foreground">{[person.title, person.department].filter(Boolean).join(' · ') || ' '}</span>
            </span>
            {restricted.tone && (
              <span data-restriction={restricted.tone} title={restricted.label ?? undefined} className="shrink-0">
                <span aria-hidden="true" className={cn('block size-2 rounded-full', restricted.tone === 'do-not-call' ? 'bg-destructive' : 'bg-amber-500')} />
                <span className="sr-only">{restricted.label}</span>
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
