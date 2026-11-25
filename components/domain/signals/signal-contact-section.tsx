import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import type { SignalContact } from '@/services/signals/opportunities'

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

/** Every signal shows its contact details, or says "Not Available". Missing details never hide the signal. */
export function ContactSection({ c }: { c?: SignalContact }) {
  if (!c) return null
  const loc = Array.isArray(c.location) ? null : c.location
  const place = loc ? [loc.city, loc.state, loc.country].filter(Boolean).join(', ') || loc.text || '' : ''
  const tone = c.status === 'complete' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
    : c.status === 'partial' ? 'bg-blue-500/10 text-blue-600 border-blue-500/30'
    : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
  const statusLabel = c.status === 'complete' ? 'Phone and email found' : c.status === 'partial' ? 'Partly found' : 'Contact needed'
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
          {c.phone_source && <p className="mt-0.5 text-[10px] text-muted-foreground">Unverified · {c.phone_source.label}</p>}
        </div>
        <div className="rounded-lg border border-border/60 bg-background p-2.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Email</p>
          {c.email
            ? <a href={`mailto:${c.email}`} className="break-all text-sm font-semibold text-primary hover:underline" data-testid="contact-email">{c.email}</a>
            : <p className="text-sm font-medium" data-testid="contact-email">{NA}</p>}
          {c.email_source && <p className="mt-0.5 text-[10px] text-muted-foreground">Unverified · {c.email_source.label}</p>}
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
      <p className="text-[11px] text-muted-foreground" data-testid="contact-message">{c.message}</p>
    </section>
  )
}
