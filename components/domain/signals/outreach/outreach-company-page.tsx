'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Building2, Loader2, Mail, MoreHorizontal, Pencil, Search, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
import { PageTabs, TabPanel } from '@/components/shared/scaffolds/page-tabs'
import { useConfirm } from '@/components/shared/scaffolds/use-confirm'
import { useUrlTab } from '@/components/shared/scaffolds/use-url-tab'
import { leadHref } from '@/lib/signals/lead-action'
import { COMPANY_TAB_IDS, COMPANY_TABS, NO_VALUE, OUTREACH_PATH, REACH_HELP, SOURCE_LABEL } from '@/lib/signals/outreach-model'
import { CHIP_BASE, CHIP_TONE } from '@/lib/org-accounts/tones'
import { cn } from '@/lib/utils'
import { outreachService, type OutreachApi } from '@/services/signals/outreach'
import type { OutreachCompanyDetail } from '@/services/signals/outreach-types'
import { AddCompanyDialog } from './add-company-dialog'
import { AssignOwnerDialog } from './assign-owner-dialog'
import { OutreachCompanyPeople } from './outreach-company-people'
import { dayText, errorText, lastContactedText, NoticeBar, webHref, type OutreachNotice } from './outreach-parts'
import { ReachChip } from './reach-chip'
import { WriteMessageDialog, type MessageDeps } from './write-message-dialog'

type Phase = { kind: 'loading' } | { kind: 'error'; message: string; missing: boolean } | { kind: 'ready'; detail: OutreachCompanyDetail }

/** The state of the public contact search, in words anyone can follow. Nothing here is a code. */
const RESEARCH_WORDS: Readonly<Record<OutreachCompanyDetail['research']['state'], string>> = {
  found: 'Contacts were found on public web pages. They are not verified: confirm before you rely on them.',
  none_found: 'A public search found no contact details for this company.',
  not_searched: 'No public search has been run for this company yet. Use Find contacts.',
  not_set_up: 'Contact search is not switched on for this organisation yet. You can still add people by hand.',
}

/** The person a link asked for (`?tab=people&person=11`): a whole number from 1 up, anything else is no person. */
const personFromAddress = (value: string | null): number | null => (value !== null && /^[1-9]\d{0,14}$/.test(value) ? Number(value) : null)

/**
 * One company of the Outreach tab. Exactly two tabs, like the Organizations page cut down to what this data has: Details (the company, why it is here, where we are with it) and
 * People (who can be reached there). The header carries the actions: Write message (saves drafts), Find contacts (starts the public search), Convert to lead, and Edit for a
 * company added by hand. A company the signals found cannot be edited: its details came from the web page and the signal still points at them.
 */
export function OutreachCompanyPage({ id, service = outreachService, messageDeps }: { id: number; service?: OutreachApi; messageDeps?: MessageDeps }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { confirm, confirmDialog } = useConfirm()
  const [tab, setTab] = useUrlTab(COMPANY_TAB_IDS, 'tab')
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [notice, setNotice] = useState<OutreachNotice | null>(null)
  const [busy, setBusy] = useState(false)
  const [finding, setFinding] = useState(false)
  const [searchedOnce, setSearchedOnce] = useState(false)
  const [writeOpen, setWriteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [ownerOpen, setOwnerOpen] = useState(false)
  // Read once, when the page opens: the person a link named stays the open person until another is chosen.
  const [initialPerson] = useState(() => personFromAddress(searchParams.get('person')))

  /** `quiet` reads the company again without the loading screen (after a change), so the page does not blink and the open tab stays open. */
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setPhase({ kind: 'loading' })
    try {
      const response = await service.company(id)
      setPhase({ kind: 'ready', detail: response.data })
    } catch (cause) {
      const missing = (cause as { status?: unknown } | null)?.status === 404
      if (quiet) setNotice({ tone: 'error', text: errorText(cause, 'The company could not be read again.') })
      else setPhase({ kind: 'error', message: errorText(cause, 'The company could not be loaded.'), missing })
    }
  }, [service, id])

  useEffect(() => { queueMicrotask(() => { void load() }) }, [load])

  const back = (
    <Button variant="ghost" size="icon" className="min-h-6 min-w-6 shrink-0" onClick={() => router.push(OUTREACH_PATH)} aria-label="Back to Outreach" title="Back to Outreach">
      <ArrowLeft className="size-4" aria-hidden="true" />
    </Button>
  )

  if (phase.kind === 'loading') {
    return (
      <div role="status" className="flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading company…
      </div>
    )
  }
  if (phase.kind === 'error') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">{back}<span className="text-sm text-muted-foreground">Outreach</span></div>
        <div role="alert" className="space-y-3 rounded-xl border border-destructive bg-card p-4 text-sm text-foreground">
          <p>{phase.missing ? 'This company was not found. It may have been removed.' : phase.message}</p>
          <div className="flex flex-wrap gap-2">
            {!phase.missing && <Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button>}
            <Button size="sm" variant="outline" onClick={() => router.push(OUTREACH_PATH)}>Back to Outreach</Button>
          </div>
        </div>
      </div>
    )
  }

  const detail = phase.detail
  const manual = detail.source === 'manual'
  const contact = detail.best_contact
  const research = detail.research

  const findContacts = async () => {
    setFinding(true)
    setNotice(null)
    try {
      const response = await service.findContacts(detail.id)
      setSearchedOnce(true)
      setNotice({ tone: 'success', text: response.message || 'Looking for contacts. Check back in a minute.' })
    } catch (cause) {
      setNotice({ tone: 'error', text: errorText(cause, 'The contact search could not be started.') })
    } finally {
      setFinding(false)
    }
  }

  const convert = async () => {
    const sure = await confirm({
      title: `Make a lead from ${detail.name}?`,
      description: `A lead is created in CRM${contact?.name ? ` for ${contact.name}` : ''} at ${detail.name}, so your team can follow up. If it already has a lead, no second one is made.`,
      confirmLabel: 'Convert to lead',
      tone: 'default',
    })
    if (!sure) return
    setBusy(true)
    setNotice(null)
    try {
      const response = await service.convertToLead(detail.id, contact ? { person_id: contact.id } : undefined)
      setNotice({
        tone: 'success',
        text: response.data.created ? `A lead was created from ${detail.name}.` : `${detail.name} already has a lead, so no second one was made.`,
        href: leadHref(String(response.data.lead_id)),
        linkText: 'Open the lead',
      })
      void load(true)
    } catch (cause) {
      setNotice({ tone: 'error', text: errorText(cause, 'The lead could not be created.') })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    const sure = await confirm({
      title: `Delete ${detail.name}?`,
      description: 'You added this company by hand, so it is removed from Outreach together with the people you added to it.',
      confirmLabel: 'Delete company',
    })
    if (!sure) return
    setBusy(true)
    try {
      await service.deleteCompany(detail.id)
      router.push(OUTREACH_PATH)
    } catch (cause) {
      setNotice({ tone: 'error', text: errorText(cause, 'The company could not be deleted.') })
      setBusy(false)
    }
  }

  const website = webHref(detail.website)
  // The location often already names the state ("Ahmedabad, Gujarat"); the state is added only when it says something the location does not.
  const place = [detail.location, detail.state && !(detail.location ?? '').toLowerCase().includes(detail.state.toLowerCase()) ? detail.state : null].filter(Boolean).join(', ')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {back}
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-primary/10 text-primary"><Building2 className="size-5" aria-hidden="true" /></div>
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-foreground">
              <span className="break-words">{detail.name}</span>
              <span data-source={detail.source} className={cn(CHIP_BASE, manual ? CHIP_TONE.muted : CHIP_TONE.neutral)}>{SOURCE_LABEL[detail.source]}</span>
              <ReachChip reach={detail.reach} />
            </h2>
            <p className="text-sm text-muted-foreground">{[detail.industry, place].filter(Boolean).join(' · ') || 'No details yet'}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Actions">
          <Button size="sm" onClick={() => setWriteOpen(true)}><Mail className="mr-1.5 size-4" aria-hidden="true" />Write message</Button>
          <Button
            size="sm"
            variant="outline"
            disabled={finding || !research.can_search}
            title={research.can_search ? undefined : 'Contact search is not switched on for this organisation.'}
            onClick={() => void findContacts()}
          >
            {finding ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : <Search className="mr-1.5 size-4" aria-hidden="true" />}Find contacts
          </Button>
          {searchedOnce && <Button size="sm" variant="outline" onClick={() => void load(true)}>Check for results</Button>}
          {detail.lead_id ? (
            <Button size="sm" variant="outline" asChild><Link href={leadHref(String(detail.lead_id))}><UserPlus className="mr-1.5 size-4" aria-hidden="true" />Open lead</Link></Button>
          ) : (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void convert()}><UserPlus className="mr-1.5 size-4" aria-hidden="true" />Convert to lead</Button>
          )}
          {manual && <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}><Pencil className="mr-1.5 size-4" aria-hidden="true" />Edit</Button>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" aria-label="More actions"><MoreHorizontal className="size-4" aria-hidden="true" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setOwnerOpen(true)}>Change owner</DropdownMenuItem>
              {manual && <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => void remove()}>Delete company</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {notice && <NoticeBar notice={notice} onDismiss={() => setNotice(null)} />}

      <PageTabs tabs={COMPANY_TABS} active={tab} onChange={setTab} label="Company sections" idPrefix="outreach-company" />

      <TabPanel id="details" active={tab} idPrefix="outreach-company">
        <div className="space-y-4">
          <SectionCard title="Company">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <ReadField label="Website" value={website ? <a href={website} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2 hover:no-underline">{detail.website}</a> : detail.website} />
              <ReadField label="Industry" value={detail.industry} />
              <ReadField label="Type" value={detail.type} />
              <ReadField label="Location" value={place} />
              <ReadField label="Phone" value={detail.phone} />
              <ReadField label="Email" value={detail.email} />
              <ReadField label="Owner" value={detail.assigned_to_name || 'Not assigned'} />
            </dl>
            <p className="mt-4 whitespace-pre-wrap text-sm text-foreground">{detail.description || NO_VALUE}</p>
            {!manual && <p data-readonly-note className="mt-3 text-xs text-muted-foreground">These details came from the web page that found this company, so they cannot be edited here.</p>}
          </SectionCard>

          <SectionCard title="Why it is here">
            {detail.signals.length === 0 ? (
              <p className="text-sm text-foreground">{manual ? 'You added this company by hand, so no signal brought it here.' : 'No signal is linked to this company yet.'}</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {detail.signals.map((signal) => (
                  <li key={signal.id} data-signal={signal.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{signal.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {[signal.product_name, signal.review_status, dayText(signal.first_discovered_at, '')].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <Link href="/signals" className="shrink-0 text-xs font-medium text-foreground underline underline-offset-2 hover:no-underline">Open in Market Signals</Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Where we are">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <ReadField label="Contact search" value={<span data-research={research.state}>{RESEARCH_WORDS[research.state]}{research.searched_at ? ` Last searched ${dayText(research.searched_at, '')}.` : ''}</span>} />
              <ReadField label="What can be done" value={REACH_HELP[detail.reach]} />
              <ReadField label="People" value={`${detail.people_count} ${detail.people_count === 1 ? 'person' : 'people'}, ${detail.reachable_people_count} can be reached now`} />
              <ReadField label="Last contacted" value={lastContactedText(detail.last_contacted_at)} />
              <ReadField label="Lead" value={detail.lead_id ? <Link href={leadHref(String(detail.lead_id))} className="underline underline-offset-2 hover:no-underline">This company became a lead. Open it.</Link> : 'Not a lead yet'} />
            </dl>
          </SectionCard>
        </div>
      </TabPanel>

      <TabPanel id="people" active={tab} idPrefix="outreach-company">
        <OutreachCompanyPeople
          detail={detail}
          service={service}
          initialPersonId={initialPerson}
          onChanged={() => void load(true)}
          onFindContacts={() => void findContacts()}
          finding={finding}
          messageDeps={messageDeps}
        />
      </TabPanel>

      <WriteMessageDialog people={detail.people} open={writeOpen} onOpenChange={setWriteOpen} service={service} {...messageDeps} />
      <AddCompanyDialog open={editOpen} onOpenChange={setEditOpen} service={service} company={detail} onSaved={() => { setNotice({ tone: 'success', text: 'The details were saved.' }); void load(true) }} />
      <AssignOwnerDialog open={ownerOpen} onOpenChange={setOwnerOpen} target={{ company_ids: [detail.id] }} subject={detail.name} service={service} onAssigned={() => { setNotice({ tone: 'success', text: 'The owner was changed.' }); void load(true) }} />
      {confirmDialog}
    </div>
  )
}
