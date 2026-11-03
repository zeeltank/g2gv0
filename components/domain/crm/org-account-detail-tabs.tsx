'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
import { activityKindLabel, formatAmount, MISSING_SOURCE_TEXT, NO_VALUE, shownText } from '@/lib/org-accounts/display'
import { recordHref, signalReviewHref, type OrgLinks } from '@/lib/org-accounts/links'
import { formatDay } from '@/lib/signal-review/signal-display'
import type { Org360 } from '@/services/org-accounts/types'
import { SignalDateBadge, SignalStatusChip } from './signal-review-parts'

const SOURCE_NAMES = { crm: 'CRM', gtm: 'GTM' } as const

/** "Showing 20 of 45" under a list the server capped, "Showing all 3" under a complete one. Nothing under an empty list. */
function Shown({ shown, total }: { shown: number; total: number }) {
  if (shown === 0) return null
  return <p className="text-xs text-muted-foreground">{shownText(shown, total)}</p>
}

function SourceTag({ source }: { source: 'crm' | 'gtm' }) {
  return <span data-source={source} className="inline-flex whitespace-nowrap rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{SOURCE_NAMES[source]}</span>
}

/** A scrolling box for a table, so a wide table scrolls inside itself and never widens the page. */
function TableBox({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-lg border border-border">{children}</div>
}

const Empty = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>

// ── Overview ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** What each of the three sources knows. A source the organisation has no row in says so; the CRM card offers to create the row. */
export function OverviewPanel({ org, links, canCreateCrm, busy, onCreateCrm }: {
  org: Org360
  links: OrgLinks
  canCreateCrm: boolean
  busy: boolean
  /** Receives the button, so the focus can go back to it if nothing is created. */
  onCreateCrm: (trigger: HTMLElement) => void
}) {
  const { crm, gtm, company } = org
  const crmHref = crm ? recordHref(links.crmOrganisations, crm.id) : null
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SectionCard title="CRM">
        {crm ? (
          <>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <ReadField label="Name" value={crm.name} />
              <ReadField label="Account number" value={crm.account_no && <span className="font-mono text-xs">{crm.account_no}</span>} />
              <ReadField label="Industry" value={crm.industry} />
              <ReadField label="Phone" value={crm.phone} />
              <ReadField label="Email" value={crm.email && <span className="break-all">{crm.email}</span>} />
              <ReadField label="Website" value={crm.website && <span className="break-all">{crm.website}</span>} />
              <ReadField label="City" value={[crm.billing_city, crm.billing_state].filter(Boolean).join(', ')} />
              <ReadField label="Assigned to" value={crm.assigned_to_name} />
            </dl>
            {crmHref && <Button variant="outline" size="sm" className="mt-4" asChild><Link href={crmHref}>Open in CRM</Link></Button>}
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{MISSING_SOURCE_TEXT.crm}</p>
            {canCreateCrm && <Button onClick={(event) => onCreateCrm(event.currentTarget)} disabled={busy}>{busy ? 'Working…' : 'Create CRM organisation'}</Button>}
          </div>
        )}
      </SectionCard>

      <SectionCard title="GTM">
        {gtm ? (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <ReadField label="Name" value={gtm.name} />
            <ReadField label="Stage" value={gtm.stage} />
            <ReadField label="Website" value={gtm.domain && <span className="break-all">{gtm.domain}</span>} />
            <ReadField label="Fit with the ideal customer" value={gtm.icp_fit_score === null ? null : String(gtm.icp_fit_score)} />
            <ReadField label="Owner" value={gtm.owner_name} />
          </dl>
        ) : <p className="text-sm text-muted-foreground">{MISSING_SOURCE_TEXT.gtm}</p>}
      </SectionCard>

      <SectionCard title="Company in Signals">
        {company ? (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <ReadField label="Name" value={company.name} />
            <ReadField label="Website" value={company.website && <span className="break-all">{company.website}</span>} />
            <ReadField label="Industry" value={company.industry} />
            <ReadField label="Type" value={company.type} />
            <ReadField label="Location" value={[company.location, company.state].filter(Boolean).join(', ')} />
            <ReadField label="First seen" value={formatDay(company.first_seen_at)} />
          </dl>
        ) : <p className="text-sm text-muted-foreground">{MISSING_SOURCE_TEXT.signals}</p>}
      </SectionCard>
    </div>
  )
}

// ── Signals ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function SignalsPanel({ org, links }: { org: Org360; links: OrgLinks }) {
  const { total, needing_decision, decided, latest } = org.signals
  return (
    <SectionCard title="Signals" description="The latest signals found about this organisation. Decisions are made in Signal Review.">
      <dl className="mb-4 grid grid-cols-3 gap-2.5">
        {/* Counts go in as text: a count of 0 is a real answer. */}
        {[['in total', total], ['need a decision', needing_decision], ['decided', decided]].map(([label, value]) => (
          // The label comes first in the markup (what a definition list needs) and is drawn under the number.
          <div key={label} className="flex flex-col-reverse rounded-lg border border-border bg-card px-3 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-xl font-semibold leading-tight text-foreground">{String(value)}</dd>
          </div>
        ))}
      </dl>
      {latest.length === 0 ? <Empty>No signals have been found about this organisation yet.</Empty> : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {latest.map((line) => {
            const href = signalReviewHref(links, line.title)
            return (
              <li key={line.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  {href
                    ? <Link href={href} className="font-medium text-foreground hover:underline">{line.title}</Link>
                    : <span className="font-medium text-foreground">{line.title}</span>}
                  {line.product_master_name && <p className="text-xs text-muted-foreground">{line.product_master_name}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <SignalDateBadge info={line.date_info} />
                  <SignalStatusChip status={line.review_status} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <div className="mt-2"><Shown shown={latest.length} total={total} /></div>
    </SectionCard>
  )
}

// ── Contacts ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Emails and phone numbers are plain text on purpose: nothing is ever sent from this screen, so there is no mailto: or tel: link. */
export function ContactsPanel({ org, links }: { org: Org360; links: OrgLinks }) {
  return (
    <SectionCard title="Contacts" description="People at this organisation, from the CRM and from GTM.">
      {org.contacts.length === 0 ? <Empty>No contacts yet.</Empty> : (
        <TableBox>
          <Table>
            <caption className="sr-only">Contacts</caption>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>From</TableHead><TableHead>Role</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead></TableRow></TableHeader>
            <TableBody>
              {org.contacts.map((contact) => {
                const href = contact.source === 'crm' ? recordHref(links.contacts, contact.id) : null
                return (
                  <TableRow key={`${contact.source}-${contact.id}`}>
                    <TableCell className="font-medium">{href ? <Link href={href} className="hover:underline">{contact.name}</Link> : contact.name}</TableCell>
                    <TableCell><SourceTag source={contact.source} /></TableCell>
                    <TableCell>{contact.role ?? NO_VALUE}</TableCell>
                    <TableCell className="break-all">{contact.email ?? NO_VALUE}</TableCell>
                    <TableCell className="whitespace-nowrap">{contact.phone ?? NO_VALUE}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableBox>
      )}
      <div className="mt-2"><Shown shown={org.contacts.length} total={org.totals.contacts} /></div>
    </SectionCard>
  )
}

// ── Deals ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function DealsPanel({ org, links }: { org: Org360; links: OrgLinks }) {
  return (
    <SectionCard title="Deals" description="Opportunities in the CRM and deals in GTM.">
      {org.deals.length === 0 ? <Empty>No deals yet.</Empty> : (
        <TableBox>
          <Table>
            <caption className="sr-only">Deals</caption>
            <TableHeader><TableRow><TableHead>Deal</TableHead><TableHead>From</TableHead><TableHead>Stage</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Closing</TableHead></TableRow></TableHeader>
            <TableBody>
              {org.deals.map((deal) => {
                const href = deal.source === 'crm' ? recordHref(links.opportunities, deal.id) : null
                return (
                  <TableRow key={`${deal.source}-${deal.id}`}>
                    <TableCell className="font-medium">{href ? <Link href={href} className="hover:underline">{deal.name}</Link> : deal.name}</TableCell>
                    <TableCell><SourceTag source={deal.source} /></TableCell>
                    <TableCell>{deal.stage ?? NO_VALUE}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{formatAmount(deal.amount, deal.currency)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDay(deal.closing_date) ?? NO_VALUE}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableBox>
      )}
      <div className="mt-2"><Shown shown={org.deals.length} total={org.totals.deals} /></div>
    </SectionCard>
  )
}

// ── Activity ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function ActivityPanel({ org }: { org: Org360 }) {
  return (
    <SectionCard title="Activity" description="Notes, tasks, decisions and leads about this organisation, newest first.">
      {org.activity.length === 0 ? <Empty>No activity yet.</Empty> : (
        <ol className="divide-y divide-border rounded-lg border border-border">
          {org.activity.map((line, index) => (
            <li key={`${line.at}-${index}`} className="space-y-1 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border px-2 py-0.5 font-medium text-foreground">{activityKindLabel(line.kind)}</span>
                <span>{formatDay(line.at) ?? line.at}</span>
                <span>{line.by_name ?? 'Unknown person'}</span>
                <span className="font-mono">{line.source}</span>
              </div>
              <p className="whitespace-pre-line break-words text-sm text-foreground">{line.text}</p>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-2"><Shown shown={org.activity.length} total={org.totals.activity} /></div>
    </SectionCard>
  )
}
