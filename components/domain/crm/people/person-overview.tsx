'use client'

import { Briefcase, Link2, Mail, MapPin, Phone } from 'lucide-react'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
import { cn } from '@/lib/utils'
import { CHIP_BASE, CHIP_TONE } from '@/lib/org-accounts/tones'
import type { FactsApi } from '@/services/facts/api-types'
import type { Fact } from '@/services/facts/types'
import type { Contact } from '@/types/crm'
import { ConsentLine } from '../fact-consent'
import { FactEvidenceSection } from '../fact-evidence-section'
import { birthdayText, mailingAddress, otherAddress } from './person-model'

function IconValue({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      {children}
    </span>
  )
}

const GRID = 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3'

/**
 * The Overview of a person: the sections of the former Contact page, in the order of the approved mock-up (Contact, Role in the company, Address, Personal,
 * Description, Preferences and consent), with the Consent line and the Evidence section where they always were: after the person's own sections.
 */
export function PersonOverview({ contact, ownerName, factsService, onWroteRecord }: {
  contact: Contact
  /** The owner's name; the id is shown when the people list has not loaded. */
  ownerName: string
  /** For tests: the Consent line and the Evidence section read the facts API through it. */
  factsService?: FactsApi
  onWroteRecord?: (fact: Fact) => void
}) {
  const mailing = mailingAddress(contact)
  const other = otherAddress(contact)
  const birthday = birthdayText(contact.birthday)
  const reportsTo = contact.reportsToName || (contact.reportsToId ? `Person #${contact.reportsToId}` : null)

  return (
    <div className="space-y-4">
      <SectionCard title="Contact">
        <dl className={GRID}>
          <ReadField label="Email" value={contact.email && <IconValue icon={Mail}>{contact.email}</IconValue>} />
          <ReadField label="Phone" value={contact.phone && <IconValue icon={Phone}>{contact.phone}</IconValue>} />
          <ReadField label="Mobile" value={contact.mobile && <IconValue icon={Phone}>{contact.mobile}</IconValue>} />
          <ReadField label="Second email" value={contact.secondaryEmail && <IconValue icon={Mail}>{contact.secondaryEmail}</IconValue>} />
          <ReadField label="Fax" value={contact.fax} />
          <ReadField label="Home phone" value={contact.homePhone && <IconValue icon={Phone}>{contact.homePhone}</IconValue>} />
          <ReadField label="LinkedIn" value={contact.linkedinUrl && <IconValue icon={Link2}>{contact.linkedinUrl}</IconValue>} />
        </dl>
      </SectionCard>

      <SectionCard title="Role in the company">
        <dl className={GRID}>
          <ReadField label="Title" value={contact.title && <IconValue icon={Briefcase}>{contact.title}</IconValue>} />
          <ReadField label="Department" value={contact.department} />
          <ReadField label="Role" value={contact.contactRole} />
          <ReadField label="Reports to" value={reportsTo} />
          <ReadField label="Owner" value={ownerName} />
          <ReadField label="Lead source" value={contact.leadSource} />
        </dl>
      </SectionCard>

      <SectionCard title="Address">
        <dl className={GRID}>
          <ReadField label="Mailing" value={mailing && <IconValue icon={MapPin}>{mailing}</IconValue>} />
          <ReadField label="Other" value={other && <IconValue icon={MapPin}>{other}</IconValue>} />
        </dl>
      </SectionCard>

      <SectionCard title="Personal">
        <dl className={GRID}>
          <ReadField label="Birthday" value={birthday} />
          <ReadField label="Assistant" value={contact.assistant && `${contact.assistant}${contact.assistantPhone ? ` (${contact.assistantPhone})` : ''}`} />
        </dl>
      </SectionCard>

      <SectionCard title="Description">
        <p className="text-sm text-foreground">{contact.description || '—'}</p>
      </SectionCard>

      <SectionCard title="Preferences">
        <div className="flex flex-wrap gap-2">
          <span data-pref="email-opt-out" className={cn(CHIP_BASE, contact.emailOptOut ? CHIP_TONE.caution : CHIP_TONE.neutral)}>Email opt-out: {contact.emailOptOut ? 'yes' : 'no'}</span>
          <span data-pref="do-not-call" className={cn(CHIP_BASE, contact.doNotCall ? CHIP_TONE.caution : CHIP_TONE.neutral)}>Do not call: {contact.doNotCall ? 'yes' : 'no'}</span>
        </div>
      </SectionCard>

      <ConsentLine entityType="contact" entityId={contact.id} service={factsService} />
      <FactEvidenceSection entityType="contact" entityId={contact.id} service={factsService} onWroteRecord={onWroteRecord} />
    </div>
  )
}
