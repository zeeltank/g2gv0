'use client'

import { useMemo, useState } from 'react'
import { Loader2, Plus, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { isReachable, personLabel, titleLine, type OutreachChip } from '@/lib/signals/outreach-model'
import type { OutreachApi } from '@/services/signals/outreach'
import type { OutreachCompanyDetail, OutreachPerson, OutreachSummary } from '@/services/signals/outreach-types'
import { AddPersonDialog } from './add-person-dialog'
import { OutreachChips } from './outreach-parts'
import { OutreachPersonPanel } from './outreach-person-panel'
import { OutreachPersonRail } from './outreach-person-rail'
import type { MessageDeps } from './write-message-dialog'

/** The chips a short list of one company's people offers; the lists' other chips (Mine, the source chips) would have nothing to count here. */
const CHIPS: readonly OutreachChip[] = ['all', 'reachable', 'needs_details', 'blocked']

/** The chips' own numbers, counted from the people the page already holds. */
function countsOf(people: readonly OutreachPerson[]): OutreachSummary {
  return {
    all: people.length,
    reachable: people.filter((person) => isReachable(person.reach)).length,
    needs_details: people.filter((person) => person.reach === 'needs_details').length,
    blocked: people.filter((person) => person.reach === 'blocked').length,
    found: people.filter((person) => person.source === 'found').length,
    manual: people.filter((person) => person.source === 'manual').length,
    mine: 0,
  }
}

function matches(person: OutreachPerson, chip: OutreachChip, search: string): boolean {
  if (chip === 'reachable' && !isReachable(person.reach)) return false
  if (chip === 'needs_details' && person.reach !== 'needs_details') return false
  if (chip === 'blocked' && person.reach !== 'blocked') return false
  const text = search.trim().toLowerCase()
  if (!text) return true
  return [person.full_name, person.email, person.phone, person.mobile, titleLine(person), person.designation].some((part) => (part ?? '').toLowerCase().includes(text))
}

/**
 * The People tab of a company: its people in a rail on the left and the chosen person's panel on the right (on a phone, the list first, then the person with a Back button). The people
 * come with the company's page, so searching and the chips narrow them here without asking the server again. An empty company says what to do next.
 */
export function OutreachCompanyPeople({ detail, service, initialPersonId = null, onChanged, onFindContacts, finding, messageDeps }: {
  detail: OutreachCompanyDetail
  service: OutreachApi
  /** The person a link asked for (`?tab=people&person=11`), opened as soon as the tab shows. */
  initialPersonId?: number | null
  /** The people changed (added, edited, deleted, consent): the company page reads itself again. */
  onChanged: () => void
  onFindContacts: () => void
  finding: boolean
  messageDeps?: MessageDeps
}) {
  const [search, setSearch] = useState('')
  const [chip, setChip] = useState<OutreachChip>('all')
  const [selectedId, setSelectedId] = useState<number | null>(initialPersonId)
  // On a phone the list and the person take turns: the person shows only after one was chosen.
  const [showPerson, setShowPerson] = useState(initialPersonId !== null)
  const [addOpen, setAddOpen] = useState(false)

  const everyone = detail.people
  const shown = useMemo(() => everyone.filter((person) => matches(person, chip, search)), [everyone, chip, search])
  const active = shown.find((person) => person.id === selectedId) ?? shown[0] ?? null
  const narrowed = search.trim() !== '' || chip !== 'all'

  const choose = (id: number) => { setSelectedId(id); setShowPerson(true) }
  const backToList = () => { setShowPerson(false); setSelectedId(null) }

  const addButton = (
    <Button size="sm" onClick={() => setAddOpen(true)}>
      <Plus className="mr-1.5 size-4" aria-hidden="true" />Add person
    </Button>
  )

  return (
    <div className="space-y-3">
      {everyone.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" aria-hidden="true" />}
          title="No people yet"
          description="No contact found for this company. Find contacts, or add one by hand."
          action={(
            <div className="flex flex-wrap justify-center gap-2">
              {detail.research.can_search && (
                <Button size="sm" variant="outline" disabled={finding} onClick={onFindContacts}>
                  {finding && <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" />}Find contacts
                </Button>
              )}
              {addButton}
            </div>
          )}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 max-w-sm flex-1 basis-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input aria-label="Search people" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, phone, job title" className="pl-9" />
            </div>
            <OutreachChips active={chip} summary={countsOf(everyone)} onPick={setChip} only={CHIPS} />
            <span className="grow" />
            {addButton}
          </div>

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(260px,330px)_1fr]">
            <div className={cn('overflow-hidden rounded-xl border border-border bg-card', showPerson && 'max-lg:hidden')}>
              {shown.length === 0
                ? <p className="p-4 text-sm text-muted-foreground">{narrowed ? 'No person matches.' : 'No people yet.'}</p>
                : <OutreachPersonRail people={shown} selectedId={active?.id ?? null} onSelect={choose} />}
            </div>

            <div className={cn('min-w-0 lg:[&_[data-person-back]]:hidden', !showPerson && 'max-lg:hidden')}>
              {active && (
                <OutreachPersonPanel person={active} service={service} onChanged={onChanged} onClose={backToList} messageDeps={messageDeps} />
              )}
            </div>
          </div>
        </>
      )}

      <AddPersonDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        service={service}
        company={{ id: detail.id, name: detail.name }}
        onSaved={(person) => { choose(person.id); onChanged() }}
      />
    </div>
  )
}
