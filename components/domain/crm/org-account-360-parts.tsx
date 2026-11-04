'use client'

import { useId, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import {
  consentText, confidenceText, classificationText, openDealLines, relationshipText, type OldAccount360,
} from '@/lib/org-accounts/old-sections'
import {
  formatAmount, linkedRecords, MISSING_SOURCE_TEXT, NO_VALUE, NOT_CONFIRMABLE_TEXT, placeConflictText, scoreText, shownText, sourceTypeLabel, whyNowFacts,
} from '@/lib/org-accounts/display'
import { recordHref, signalReviewHref, type OrgLinks } from '@/lib/org-accounts/links'
import { CONFIRM_LABEL, REJECT_LABEL, type LinkAction } from '@/lib/org-accounts/suggestions'
import { CHIP_BASE, CHIP_TONE } from '@/lib/org-accounts/tones'
import { formatDay, safeHttpUrl } from '@/lib/signal-review/signal-display'
import { cn } from '@/lib/utils'
import type { Org360, OrgSuggestion } from '@/services/org-accounts/types'
import { LifecycleChip, SignalDatePill, SignalStateChip, SourceTag } from './org-account-parts'

const Empty = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>

/** A section that opens and closes (the old Account 360 sections did). The button says which it is; the count sits in the heading. */
export function Collapsible({ title, count, defaultOpen = true, children }: { title: string; count?: number; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <section className="rounded-lg border border-border bg-card" data-section={title}>
      <h3>
        <button type="button" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {title}
            {count !== undefined && <span className="rounded-full border border-border px-1.5 text-xs font-medium text-muted-foreground">{count}</span>}
          </span>
          <Chevron className="size-4 text-muted-foreground" aria-hidden="true" />
        </button>
      </h3>
      <div id={bodyId} hidden={!open} className="border-t border-border px-4 pb-4 pt-3">{open ? children : null}</div>
    </section>
  )
}

/** "Showing 20 of 45" under a list the server capped, "Showing all 3" under a complete one. Nothing under an empty list. */
function Shown({ shown, total }: { shown: number; total: number }) {
  if (shown === 0) return null
  return <p className="mt-2 text-xs text-muted-foreground">{shownText(shown, total)}</p>
}

// ── Why now ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The four facts that say why this organisation matters today: open signals, the next event, open deals and the last activity. */
export function WhyNowStrip({ why }: { why: Org360['why_now'] }) {
  return (
    <div role="group" aria-label="Why now">
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {whyNowFacts(why).map((fact) => (
          // The label comes first in the markup (what a definition list needs) and is drawn under the value.
          <div key={fact.key} data-fact={fact.key} className="flex flex-col-reverse rounded-lg border border-border bg-card px-3 py-2">
            <dt className="text-xs text-muted-foreground">{fact.label}</dt>
            <dd className="text-lg font-semibold leading-tight text-foreground">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// ── Linked records ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Which side of a possible match is NOT this organisation's own record. */
function otherSide(org: Org360, suggestion: OrgSuggestion) {
  const { links } = org.identity
  const mine = new Set<string>()
  if (links.crm) mine.add(`crm_organization:${links.crm.id}`)
  if (links.gtm) mine.add(`gtm_account:${links.gtm.id}`)
  if (links.company) mine.add(`g2g_company:${links.company.id}`)
  return mine.has(`${suggestion.left.type}:${suggestion.left.id}`) ? suggestion.right : suggestion.left
}

/**
 * The CRM organisation, the GTM account and the Signals company this organisation is, each with the reason it is tied to the others in words, and the
 * possible matches a person confirms or turns down. A source with no record says so. GTM has no page for one account, so its row opens the GTM list.
 */
export function LinkedRecordsCard({ org, links, matches, matchesError, canEdit, canConfirm, busy, failure, onEdit, onDecide, onRetryMatches }: {
  org: Org360
  links: OrgLinks
  /** The possible matches of this organisation; null until read. */
  matches: readonly OrgSuggestion[] | null
  matchesError: string
  canEdit: boolean
  canConfirm: boolean
  busy: { key: string; action: LinkAction } | null
  failure: string
  /** Receives the button, so the focus can go back to it. */
  onEdit: (trigger: HTMLElement) => void
  onDecide: (suggestion: OrgSuggestion, action: LinkAction, trigger: HTMLElement) => void
  onRetryMatches: () => void
}) {
  const headingId = useId()
  const rows = linkedRecords(org)
  const hrefFor = { crm: null, gtm: links.gtm, signals: links.signals } as const
  const owner = org.identity.owner_name ? `Owner: ${org.identity.owner_name}` : 'No owner'
  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={headingId} className="text-sm font-semibold text-foreground">Linked records</h3>
          <LifecycleChip lifecycle={org.identity.lifecycle} />
          <span className="text-xs text-muted-foreground">{owner}</span>
        </div>
        {canEdit && <Button size="sm" variant="outline" onClick={(event) => onEdit(event.currentTarget)}>Edit lifecycle and owner</Button>}
      </header>

      <ul className="divide-y divide-border">
        {rows.map((row) => {
          const href = hrefFor[row.key]
          return (
            <li key={row.key} data-source={row.key} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{row.label}</p>
                {row.found ? (
                  <>
                    <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                      {href ? <Link href={href} className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{row.name}</Link> : <span>{row.name}</span>}
                      {row.key === 'crm' && <span className={cn(CHIP_BASE, CHIP_TONE.neutral)}>This record</span>}
                    </p>
                    {row.detail && <p className="text-xs text-muted-foreground">{row.detail}</p>}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{MISSING_SOURCE_TEXT[row.key]}</p>
                )}
              </div>
              {row.basis && <p data-basis className="text-xs text-muted-foreground">{row.basis}</p>}
            </li>
          )
        })}
      </ul>

      {matchesError && (
        <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
          Possible matches could not be loaded. <Button size="sm" variant="ghost" onClick={onRetryMatches}>Retry</Button>
        </div>
      )}

      {matches !== null && matches.length > 0 && (
        <div className="space-y-3 border-t border-border px-4 py-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Possible matches</h4>
            <p className="text-xs text-muted-foreground">Records whose names look alike but are not identical. Confirming shows them as one organisation; nothing in either record is changed.</p>
          </div>
          {failure && <div role="alert" className="rounded-lg border-2 border-destructive bg-card p-3 text-sm text-foreground">{failure}</div>}
          <ul className="space-y-3">
            {matches.map((suggestion) => {
              const other = otherSide(org, suggestion)
              const conflict = placeConflictText(suggestion)
              const working = busy?.key === suggestion.key
              return (
                <li key={suggestion.key} data-pair={suggestion.key} aria-busy={working} className="space-y-2 rounded-lg border border-border p-3">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{other.name}</span>
                    <span className="text-muted-foreground"> · {sourceTypeLabel(other.type)}{other.place ? ` · ${other.place}` : ''}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{scoreText(suggestion.score)}</p>
                  {conflict && (
                    <p data-place-conflict className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
                      {conflict}
                    </p>
                  )}
                  {!suggestion.confirmable && <p className="text-xs text-muted-foreground">{NOT_CONFIRMABLE_TEXT}</p>}
                  {canConfirm && (
                    <div className="flex flex-wrap gap-2">
                      {suggestion.confirmable && (
                        <Button size="sm" disabled={busy !== null} aria-label={`${CONFIRM_LABEL}: ${other.name}`} onClick={(event) => onDecide(suggestion, 'confirm', event.currentTarget)}>
                          {working && busy?.action === 'confirm' ? 'Saving…' : CONFIRM_LABEL}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" disabled={busy !== null} aria-label={`${REJECT_LABEL}: ${other.name}`} onClick={(event) => onDecide(suggestion, 'reject', event.currentTarget)}>
                        {working && busy?.action === 'reject' ? 'Saving…' : REJECT_LABEL}
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}

// ── Signals ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The latest signals found about this organisation, each with its status in words, its date and the page it was found on. Decisions are made in Signal Review. */
export function SignalsSection({ org, links }: { org: Org360; links: OrgLinks }) {
  const { total, needing_decision, decided, latest } = org.signals
  return (
    <Collapsible title="Signals" count={total}>
      <p className="mb-3 text-sm text-muted-foreground">
        {total} in total · {needing_decision} need a decision · {decided} decided. Decisions are made in Signal Review.
      </p>
      {latest.length === 0 ? <Empty>No signals have been found about this organisation yet.</Empty> : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {latest.map((line) => {
            const review = signalReviewHref(links, line.title)
            const evidence = safeHttpUrl(line.source_url)
            return (
              <li key={line.id} data-signal={line.id} className="flex flex-wrap items-start justify-between gap-2 p-3">
                <div className="min-w-0 space-y-0.5">
                  {review
                    ? <Link href={review} className="font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{line.title}</Link>
                    : <span className="font-medium text-foreground">{line.title}</span>}
                  {line.product_master_name && <p className="text-xs text-muted-foreground">{line.product_master_name}</p>}
                  {evidence && (
                    <a href={evidence} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <ExternalLink className="size-3" aria-hidden="true" />
                      Evidence: the page this was found on
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <SignalDatePill info={line.date_info} />
                  <SignalStateChip status={line.review_status} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <Shown shown={latest.length} total={total} />
    </Collapsible>
  )
}

// ── Contacts and deals ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Emails and phone numbers are plain text on purpose: nothing is ever sent from here, so there is no mailto: or tel: link. */
export function ContactsSection({ org }: { org: Org360 }) {
  return (
    <Collapsible title="Contacts" count={org.totals.contacts}>
      {org.contacts.length === 0 ? <Empty>No contacts yet.</Empty> : (
        <ul className="divide-y divide-border">
          {org.contacts.map((contact) => {
            const consent = consentText(contact.consent_status)
            return (
              <li key={`${contact.source}-${contact.id}`} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{contact.name}</p>
                  <p className="break-all text-xs text-muted-foreground">{[contact.role, contact.email, contact.phone].filter(Boolean).join(' · ') || NO_VALUE}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {consent && <span data-consent={contact.consent_status} className={cn(CHIP_BASE, CHIP_TONE.neutral)}>{consent}</span>}
                  <SourceTag source={contact.source} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <Shown shown={org.contacts.length} total={org.totals.contacts} />
    </Collapsible>
  )
}

/**
 * The deals worth looking at now (CRM opportunities not closed won or lost, and the GTM deals). Every opportunity, closed ones included, is in the
 * Opportunities tab, which `onOpenTab` opens.
 */
export function DealsSection({ org, links, onOpenTab }: { org: Org360; links: OrgLinks; onOpenTab?: (tab: 'opportunities') => void }) {
  const open = openDealLines(org.deals)
  return (
    <Collapsible title="Open opportunities and deals" count={open.length}>
      {open.length === 0 ? <Empty>No open opportunities or deals for this organisation.</Empty> : (
        <ul className="divide-y divide-border">
          {open.map((deal) => {
            const href = deal.source === 'crm' ? recordHref(links.opportunities, deal.id) : null
            return (
              <li key={`${deal.source}-${deal.id}`} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{href ? <Link href={href} className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{deal.name}</Link> : deal.name}</p>
                  <p className="text-xs text-muted-foreground">Close: {formatDay(deal.closing_date) ?? NO_VALUE}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{formatAmount(deal.amount, deal.currency)}</span>
                  <span className={cn(CHIP_BASE, CHIP_TONE.neutral)}>{deal.stage ?? 'No stage'}</span>
                  <SourceTag source={deal.source} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {org.totals.deals > org.deals.length && <p className="mt-2 text-xs text-muted-foreground">The {org.deals.length} newest deals are looked at here; every one is in the Opportunities tab.</p>}
      {onOpenTab && <Button className="mt-2" size="sm" variant="outline" onClick={() => onOpenTab('opportunities')}>See every opportunity</Button>}
    </Collapsible>
  )
}

// ── The sections only the old Account 360 had ───────────────────────────────────────────────────────────────────────────────────────

export type OldSectionsState =
  | { kind: 'loading' }
  | { kind: 'forbidden'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: OldAccount360 }

/**
 * Recent campaigns, knowledge sources, relationships and the CRM signal inbox: what the identity 360 does not hold. They come from their own endpoint,
 * which follows the Market Signals right, so a person without it gets a plain note here and the rest of the tab is unaffected.
 */
export function OldSections({ state, organizationId, onRetry }: { state: OldSectionsState; organizationId: string; onRetry: () => void }) {
  if (state.kind === 'loading') {
    return <div role="status" aria-label="Loading more of this account" className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div>
  }
  if (state.kind === 'forbidden') {
    return <p data-old-sections="forbidden" className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">{state.message}</p>
  }
  if (state.kind === 'error') {
    return <ErrorState title="Campaigns, knowledge sources and relationships could not be loaded" description={state.message} retry={onRetry} />
  }
  const { campaigns, knowledgeSources, relationships, signals } = state.data
  return (
    <div className="space-y-3" data-old-sections="ready">
      <Collapsible title="Recent campaigns" count={campaigns.length} defaultOpen={false}>
        {campaigns.length === 0 ? <Empty>This account has not been targeted in any campaign.</Empty> : (
          <ul className="divide-y divide-border">
            {campaigns.map((campaign) => (
              <li key={campaign.campaignId} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <p className="min-w-0 text-sm text-foreground">{campaign.campaignName}</p>
                <div className="flex items-center gap-2">
                  <span className={cn(CHIP_BASE, CHIP_TONE.neutral)}>{campaign.responseStatus}</span>
                  {campaign.sentAt && <span className="text-xs text-muted-foreground">{formatDay(campaign.sentAt) ?? campaign.sentAt}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Collapsible>

      <Collapsible title="Knowledge sources" count={knowledgeSources.length} defaultOpen={false}>
        {knowledgeSources.length === 0 ? <Empty>No knowledge sources recorded for this account.</Empty> : (
          <ul className="divide-y divide-border">
            {knowledgeSources.map((source) => {
              const url = safeHttpUrl(source.url)
              const confidence = confidenceText(source.confidence)
              return (
                <li key={source.id} className="space-y-0.5 py-2.5">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    {source.title ?? source.sourceType}
                    {source.verified && <span className={cn(CHIP_BASE, CHIP_TONE.positive)}>Verified</span>}
                  </p>
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-xs text-primary underline-offset-2 hover:underline">
                      <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                      {url.length > 60 ? `${url.slice(0, 60)}…` : url}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {[confidence ? `Confidence ${confidence}` : null, source.collectedAt ? `Collected ${formatDay(source.collectedAt) ?? source.collectedAt}` : null].filter(Boolean).join(' · ')}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </Collapsible>

      <Collapsible title="Relationships" count={relationships.length} defaultOpen={false}>
        {relationships.length === 0 ? <Empty>No explicit relationships recorded.</Empty> : (
          <ul className="divide-y divide-border">
            {relationships.map((relationship) => {
              const confidence = confidenceText(relationship.confidence)
              return (
                <li key={relationship.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{relationshipText(relationship, organizationId)}</p>
                    {relationship.source && <p className="text-xs text-muted-foreground">Source: {relationship.source}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {confidence && <span className="text-xs text-muted-foreground">Confidence {confidence}</span>}
                    {relationship.verified && <span className={cn(CHIP_BASE, CHIP_TONE.positive)}>Verified</span>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Collapsible>

      <Collapsible title="Signal inbox" count={signals.length} defaultOpen={signals.length > 0}>
        {signals.length === 0 ? <Empty>No signals in the CRM inbox are linked to this account.</Empty> : (
          <ul className="divide-y divide-border">
            {signals.map((signal) => (
              <li key={signal.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{signal.title}</p>
                  <p className="text-xs text-muted-foreground">{signal.sourceName ?? NO_VALUE} · {formatDay(signal.publishedAt) ?? NO_VALUE}</p>
                </div>
                <span className={cn(CHIP_BASE, CHIP_TONE.neutral)}>{classificationText(signal.classification)}</span>
              </li>
            ))}
          </ul>
        )}
      </Collapsible>
    </div>
  )
}
