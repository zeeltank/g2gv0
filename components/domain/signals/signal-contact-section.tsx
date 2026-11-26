import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ContactPerson, SignalContact } from '@/services/signals/opportunities'

/** A number as the caller will dial it: digits and a leading +, so tel: works. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

const NA = <span className="text-muted-foreground">Not Available</span>

function ContactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
      <dt className="w-28 shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  )
}

function SourceLink({ url, label }: { url: string | null | undefined; label: string }) {
  return url
    ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{label}</a>
    : null
}

/** One person found on the public web: name first, then a tappable phone and email, each with the page it came from. Always "Unverified". */
function FoundPerson({ p }: { p: ContactPerson }) {
  return (
    <li className="rounded-lg border border-border/60 bg-background p-2.5" data-testid="found-contact">
      <div className="flex flex-wrap items-center justify-between gap-1">
        <p className="text-sm font-semibold text-foreground">{p.name ?? 'Organisation contact'}</p>
        <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal text-muted-foreground">Unverified</Badge>
      </div>
      {p.designation && <p className="text-[11px] text-muted-foreground">{p.designation}</p>}
      <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
        <p className="min-w-0">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Phone </span>
          {p.phone ? <a href={telHref(p.phone)} className="font-semibold text-primary hover:underline" data-testid="found-phone">{p.phone}</a> : NA}
          {p.phone && <> · <SourceLink url={p.phone_source_url ?? p.source_url} label="source" /></>}
        </p>
        <p className="min-w-0">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Email </span>
          {p.email ? <a href={`mailto:${p.email}`} className="break-all font-semibold text-primary hover:underline" data-testid="found-email">{p.email}</a> : NA}
          {p.email && <> · <SourceLink url={p.email_source_url ?? p.source_url} label="source" /></>}
        </p>
      </div>
      {(p.linkedin || p.source_url) && (
        <p className="mt-1 text-[11px]">
          {p.linkedin && <a href={p.linkedin} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">LinkedIn</a>}
          {p.linkedin && p.source_url && ' · '}
          {p.source_url && <SourceLink url={p.source_url} label="Where this was found" />}
        </p>
      )}
    </li>
  )
}

const RESEARCH_TEXT: Record<string, string> = {
  found: 'Found on the public web. Not checked: confirm before you rely on it.',
  none_found: 'A public search found no contact details for this organisation.',
  not_searched: 'No public search has been run for this organisation yet.',
  not_set_up: 'Public contact search is not set up (no web-search provider key).',
}

/** The sentence about the last public search: what it actually did, so an empty card is never a mystery. */
export function researchText(r: NonNullable<SignalContact['research']>): string {
  const a = r.attempt
  if (a && a.outcome === 'failed') {
    return `The last search could not run: ${a.failed} of ${a.searches} requests to the search provider failed. This is a provider or key problem, not "no contacts exist". Try again, or ask an administrator to check the provider key.`
  }
  if (a && a.outcome === 'none' && r.state !== 'found') {
    return `The last search made ${a.searches} request${a.searches === 1 ? '' : 's'} and found no published contact details for this organisation. Nothing is guessed.`
  }
  return RESEARCH_TEXT[r.state] ?? ''
}

/**
 * Every signal shows its contact details, or says "Not Available". Missing details never hide the signal.
 * `onSearch` runs a public-web contact search for the organisation; `onRefresh` reloads the signal to show what it found.
 */
export function ContactSection({ c, onSearch, onRefresh, busy, notice }: {
  c?: SignalContact
  onSearch?: () => void
  onRefresh?: () => void
  busy?: boolean
  notice?: string | null
}) {
  if (!c) return null
  const loc = Array.isArray(c.location) ? null : c.location
  const place = loc ? [loc.city, loc.state, loc.country].filter(Boolean).join(', ') || loc.text || '' : ''
  const tone = c.status === 'complete' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
    : c.status === 'partial' ? 'bg-blue-500/10 text-blue-600 border-blue-500/30'
    : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
  const statusLabel = c.status === 'complete' ? 'Phone and email found' : c.status === 'partial' ? 'Partly found' : 'Contact needed'
  const found = c.contacts ?? []
  const research = c.research ?? null
  return (
    <section aria-label="Contact details" className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3 text-xs" data-testid="signal-contact">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-foreground">Contact details</span>
        <Badge variant="outline" className={`px-2 py-0.5 text-[10px] ${tone}`} data-testid="contact-status">{statusLabel}</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-background p-2.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Phone</p>
          {c.phone
            ? <a href={telHref(c.phone)} className="text-sm font-semibold text-primary hover:underline" data-testid="contact-phone">{c.phone}</a>
            : <p className="text-sm font-medium" data-testid="contact-phone">{NA}</p>}
          {c.phone_source && <p className="mt-0.5 text-[10px] text-muted-foreground">Unverified · {c.phone_source.label}{c.phone_source.url && <> · <SourceLink url={c.phone_source.url} label="source" /></>}</p>}
        </div>
        <div className="rounded-lg border border-border/60 bg-background p-2.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Email</p>
          {c.email
            ? <a href={`mailto:${c.email}`} className="break-all text-sm font-semibold text-primary hover:underline" data-testid="contact-email">{c.email}</a>
            : <p className="text-sm font-medium" data-testid="contact-email">{NA}</p>}
          {c.email_source && <p className="mt-0.5 text-[10px] text-muted-foreground">Unverified · {c.email_source.label}{c.email_source.url && <> · <SourceLink url={c.email_source.url} label="source" /></>}</p>}
        </div>
      </div>
      <dl className="space-y-1.5">
        <ContactRow label="Contact">{c.name ?? NA}</ContactRow>
        <ContactRow label="Designation">{c.designation ?? NA}</ContactRow>
        <ContactRow label="Company">{c.company ?? NA}</ContactRow>
        <ContactRow label="Website">{c.website ? <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{c.website}</a> : NA}</ContactRow>
        <ContactRow label="LinkedIn">{c.linkedin ? <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{c.linkedin}</a> : NA}</ContactRow>
        <ContactRow label="Location">{place || NA}</ContactRow>
      </dl>
      {found.length > 0 && (
        <div className="space-y-1.5" data-testid="found-contacts">
          <p className="text-[11px] font-medium text-foreground">Found on the public web ({found.length})</p>
          <ul className="space-y-1.5">{found.map((p, i) => <FoundPerson key={`${p.email ?? p.phone ?? p.linkedin ?? p.name ?? 'c'}-${i}`} p={p} />)}</ul>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground" data-testid="contact-message">{c.message}</p>
      {research && <p className="text-[11px] text-muted-foreground" data-testid="contact-research-state">{researchText(research)}</p>}
      {(onSearch && research?.can_search !== false) && (
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onSearch} data-testid="find-contacts">{busy ? 'Searching…' : 'Find contacts'}</Button>
          {onRefresh && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onRefresh} data-testid="refresh-contacts">Check for results</Button>}
        </div>
      )}
      {notice && <p className="text-[11px] text-foreground" role="status" data-testid="contact-notice">{notice}</p>}
    </section>
  )
}
