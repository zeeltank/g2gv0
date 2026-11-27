'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail, MoreHorizontal, Pencil, ShieldCheck, Star, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
import { PageTabs, TabPanel } from '@/components/shared/scaffolds/page-tabs'
import { useConfirm } from '@/components/shared/scaffolds/use-confirm'
import { cn } from '@/lib/utils'
import { CHIP_BASE, CHIP_TONE } from '@/lib/org-accounts/tones'
import { leadHref } from '@/lib/signals/lead-action'
import { NO_VALUE, outreachCompanyHref, personInitials, personLabel, REACH_HELP, SOURCE_LABEL, titleLine, whyNotReachable } from '@/lib/signals/outreach-model'
import { outreachService, type OutreachApi } from '@/services/signals/outreach'
import type { OutreachPerson } from '@/services/signals/outreach-types'
import { AddPersonDialog } from './add-person-dialog'
import { AssignOwnerDialog } from './assign-owner-dialog'
import { ConsentDialog } from './consent-dialog'
import { NoticeBar, dayText, errorText, lastContactedText, webHref, type OutreachNotice } from './outreach-parts'
import { OutreachPersonMessages } from './outreach-person-messages'
import { ConsentChip, ReachChip } from './reach-chip'
import { WriteMessageDialog, type MessageDeps } from './write-message-dialog'

export interface OutreachPersonPanelProps {
  person: OutreachPerson
  service?: OutreachApi
  /** The person changed (edited, consent, owner, lead, deleted): whoever lists people reads the list again. */
  onChanged: () => void
  /** Asked for by the Back button (the drawer, and the phone layout of a company's People tab) and after the person was deleted. */
  onClose?: () => void
  /** Shows the person's company under the name, as a link to its page. A company's own People tab leaves it out: the company is the page. */
  showCompany?: boolean
  messageDeps?: MessageDeps
}

const TABS = [{ id: 'overview', label: 'Overview' }, { id: 'messages', label: 'Messages' }] as const
type TabId = (typeof TABS)[number]['id']

const GRID = 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3'

/** A link out to the page a detail was found on, opened in a new tab; nothing that is not a web address becomes a link. */
function SourceLink({ url, children }: { url: string | null; children: string }) {
  const href = webHref(url)

  return href ? <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-2 hover:no-underline">{children}</a> : null
}

/**
 * One person of a company or of the All people list: who they are, whether they can be written to and why not, where their details came from, and the messages written to
 * them. The actions are Write message (saves drafts), Edit, What they agreed to (consent), Convert to lead, and in the "..." menu Change owner, Mark do not contact and, only for a
 * person added by hand, Delete. A person the web search found cannot be deleted: the source still points at them, so they are marked do not contact instead.
 *
 * The panel works on the person it is given and shows the server's answer to each change at once; `onChanged` tells the list to read itself again.
 */
export function OutreachPersonPanel(props: OutreachPersonPanelProps) {
  // One body per person: switching person resets the tab, the dialogs and the notice.
  return <PanelBody key={props.person.id} {...props} />
}

function PanelBody({ person: given, service = outreachService, onChanged, onClose, showCompany = false, messageDeps }: OutreachPersonPanelProps) {
  const router = useRouter()
  const { confirm, confirmDialog } = useConfirm()
  const [patched, setPatched] = useState<{ base: OutreachPerson; value: OutreachPerson } | null>(null)
  // The answer of a change is shown at once; a newer person from the list (a reload) wins over it, because the patch is tied to the object it was made on.
  const person = patched && patched.base === given ? patched.value : given
  const [tab, setTab] = useState<TabId>('overview')
  const [notice, setNotice] = useState<OutreachNotice | null>(null)
  const [busy, setBusy] = useState(false)
  const [writeOpen, setWriteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [consentOpen, setConsentOpen] = useState(false)
  const [doNotContactOpen, setDoNotContactOpen] = useState(false)
  const [ownerOpen, setOwnerOpen] = useState(false)
  const [messagesVersion, setMessagesVersion] = useState(0)

  const label = personLabel(person)
  const manual = person.source === 'manual'
  const blocked = whyNotReachable(person)
  const idPrefix = `outreach-person-${person.id}`

  const take = (next: OutreachPerson) => { setPatched({ base: given, value: next }); onChanged() }

  const convert = async () => {
    const sure = await confirm({
      title: `Make a lead from ${label}?`,
      description: `A lead is created in CRM for ${label} at ${person.company_name}, so your team can follow up. If they already have a lead, no second one is made.`,
      confirmLabel: 'Convert to lead',
      tone: 'default',
    })
    if (!sure) return
    setBusy(true)
    setNotice(null)
    try {
      const response = await service.convertToLead(person.company_id, { person_id: person.id })
      take({ ...person, lead_id: response.data.lead_id })
      setNotice({
        tone: 'success',
        text: response.data.created ? `A lead was created for ${label}.` : `${label} already has a lead, so no second one was made.`,
        href: leadHref(String(response.data.lead_id)),
        linkText: 'Open the lead',
      })
    } catch (cause) {
      setNotice({ tone: 'error', text: errorText(cause, 'The lead could not be created.') })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    const sure = await confirm({
      title: `Delete ${label}?`,
      description: 'This person was added by hand, so they are removed from Outreach. Their company stays.',
      confirmLabel: 'Delete person',
    })
    if (!sure) return
    setBusy(true)
    try {
      await service.deletePerson(person.id)
      onChanged()
      onClose?.()
    } catch (cause) {
      setNotice({ tone: 'error', text: errorText(cause, 'The person could not be deleted.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4" data-person-panel={person.id}>
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 p-4">
          {onClose && (
            <Button data-person-back variant="ghost" size="icon" onClick={onClose} aria-label="Back to people" title="Back to people">
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Button>
          )}
          <div aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-foreground">{personInitials(person)}</div>
          <div className="min-w-0 flex-1">
            <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-foreground">
              <span className="break-words">{label}</span>
              {person.is_primary && <span data-pill="primary" className={cn(CHIP_BASE, CHIP_TONE.info)}><Star className="size-3" aria-hidden="true" />Main contact</span>}
              {person.contact_role && <span data-pill="role" className={cn(CHIP_BASE, CHIP_TONE.neutral)}>{person.contact_role}</span>}
            </h2>
            <p className="text-sm text-muted-foreground">
              {titleLine(person) ?? ' '}
              {showCompany && (
                <>
                  {titleLine(person) ? ' · ' : ''}
                  <button type="button" data-person-company onClick={() => router.push(outreachCompanyHref(person.company_id))} className="text-foreground underline underline-offset-2 hover:text-primary">{person.company_name}</button>
                </>
              )}
            </p>
          </div>
          <ReachChip reach={person.reach} />
        </div>

        <div className="flex flex-wrap gap-2 px-4 pb-4" role="group" aria-label="Actions">
          <Button size="sm" onClick={() => setWriteOpen(true)}><Mail className="mr-1.5 size-4" aria-hidden="true" />Write message</Button>
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}><Pencil className="mr-1.5 size-4" aria-hidden="true" />Edit</Button>
          <Button size="sm" variant="outline" onClick={() => setConsentOpen(true)}><ShieldCheck className="mr-1.5 size-4" aria-hidden="true" />What they agreed to</Button>
          {person.lead_id ? (
            <Button size="sm" variant="outline" asChild><Link href={leadHref(String(person.lead_id))}><UserPlus className="mr-1.5 size-4" aria-hidden="true" />Open lead</Link></Button>
          ) : (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void convert()}><UserPlus className="mr-1.5 size-4" aria-hidden="true" />Convert to lead</Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" aria-label="More actions"><MoreHorizontal className="size-4" aria-hidden="true" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setOwnerOpen(true)}>Change owner</DropdownMenuItem>
              <DropdownMenuItem disabled={person.reach === 'blocked'} onSelect={() => setDoNotContactOpen(true)}>Mark do not contact</DropdownMenuItem>
              {manual && <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => void remove()}>Delete person</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {notice && <NoticeBar notice={notice} onDismiss={() => setNotice(null)} />}

      <PageTabs tabs={TABS} active={tab} onChange={(next) => setTab(next as TabId)} label="Person sections" idPrefix={idPrefix} />

      <TabPanel id="overview" active={tab} idPrefix={idPrefix}>
        <div className="space-y-4">
          <SectionCard title="Can we contact them?">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <ReachChip reach={person.reach} />
                <ConsentChip status={person.consent_status} />
                {person.email_opt_out && <span data-pref="no-email" className={cn(CHIP_BASE, CHIP_TONE.caution)}>No email</span>}
                {person.do_not_call && <span data-pref="no-calls" className={cn(CHIP_BASE, CHIP_TONE.caution)}>Do not call</span>}
              </div>
              <p className="text-sm text-foreground">{REACH_HELP[person.reach]}</p>
              {blocked && <p data-blocked-reason className="rounded-lg border border-destructive bg-card p-3 text-sm text-foreground">{blocked}</p>}
            </div>
          </SectionCard>

          <SectionCard title="Contact">
            <dl className={GRID}>
              <ReadField label="Email" value={person.email} />
              <ReadField label="Second email" value={person.secondary_email} />
              <ReadField label="Phone" value={person.phone} />
              <ReadField label="Mobile" value={person.mobile} />
              <ReadField label="LinkedIn" value={webHref(person.linkedin_url) ? <SourceLink url={person.linkedin_url}>LinkedIn page</SourceLink> : person.linkedin_url} />
              <ReadField label="Location" value={person.location} />
            </dl>
          </SectionCard>

          <SectionCard title="Role">
            <dl className={GRID}>
              <ReadField label="Job title" value={person.designation} />
              <ReadField label="Department" value={person.department} />
              <ReadField label="Role in the company" value={person.contact_role} />
              <ReadField label="Owner" value={person.assigned_to_name || 'Not assigned'} />
              <ReadField label="Last contacted" value={lastContactedText(person.last_contacted_at)} />
              <ReadField label="Lead" value={person.lead_id ? <Link href={leadHref(String(person.lead_id))} className="underline underline-offset-2 hover:no-underline">Open the lead</Link> : 'Not a lead yet'} />
            </dl>
          </SectionCard>

          <SectionCard title="Where this came from">
            {person.source === 'found' ? (
              <div className="space-y-2 text-sm text-foreground">
                <p data-unverified className="font-medium">Found on a public page, not verified.</p>
                <p className="text-muted-foreground">Nobody has checked that the email works or the phone rings. Confirm before you rely on it.</p>
                <p className="flex flex-wrap gap-x-4 gap-y-1">
                  <SourceLink url={person.source_url}>The page this person was found on</SourceLink>
                  <SourceLink url={person.email_source_url}>Where the email was found</SourceLink>
                  <SourceLink url={person.phone_source_url}>Where the phone was found</SourceLink>
                </p>
                <p className="text-xs text-muted-foreground">Found {dayText(person.researched_at, 'on a date that was not recorded')}.</p>
              </div>
            ) : (
              <p className="text-sm text-foreground">{SOURCE_LABEL.manual} on {dayText(person.created_at, NO_VALUE)}.</p>
            )}
          </SectionCard>

          {person.description && (
            <SectionCard title="Notes"><p className="whitespace-pre-wrap text-sm text-foreground">{person.description}</p></SectionCard>
          )}
        </div>
      </TabPanel>

      <TabPanel id="messages" active={tab} idPrefix={idPrefix}>
        <OutreachPersonMessages service={service} personId={person.id} version={messagesVersion} />
      </TabPanel>

      <WriteMessageDialog people={[person]} open={writeOpen} onOpenChange={setWriteOpen} service={service} onSaved={() => setMessagesVersion((current) => current + 1)} {...messageDeps} />
      <AddPersonDialog open={editOpen} onOpenChange={setEditOpen} service={service} person={person} onSaved={(next) => { take(next); setNotice({ tone: 'success', text: 'The details were saved.' }) }} />
      <ConsentDialog open={consentOpen} onOpenChange={setConsentOpen} person={person} service={service} onSaved={(next) => { take(next); setNotice({ tone: 'success', text: 'What they agreed to was saved.' }) }} />
      <ConsentDialog
        open={doNotContactOpen}
        onOpenChange={setDoNotContactOpen}
        person={person}
        service={service}
        preset="do_not_contact"
        onSaved={(next) => { take(next); setNotice({ tone: 'success', text: `${label} is marked do not contact. No message can be written to them.` }) }}
      />
      <AssignOwnerDialog
        open={ownerOpen}
        onOpenChange={setOwnerOpen}
        target={{ person_ids: [person.id] }}
        subject={label}
        service={service}
        onAssigned={() => { setNotice({ tone: 'success', text: 'The owner was changed.' }); onChanged() }}
      />
      {confirmDialog}
    </div>
  )
}
