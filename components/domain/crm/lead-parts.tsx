'use client'

import { useId } from 'react'
import { NativeSelect } from '@/components/shared/scaffolds'
import { leadCampaignName } from '@/lib/campaigns/model'
import { consentSentence, consentViews, emailConsent, isFromSignal, type Choice, type ConsentView } from '@/lib/leads/model'
import { CHIP_BASE, LEAD_CHIP } from '@/lib/leads/tones'
import { cn } from '@/lib/utils'
import type { Lead } from '@/types/crm'

/**
 * The small parts the Leads screen gained with slice 6 (hp_erp docs/agentic-crm/slices/S06-leads.md): a filter box, the consent chip, the "from a signal"
 * marker and the line under a lead's name that says what it is for. The rules (what a chip says, when a part shows) are in lib/leads/model.ts; the colours in
 * lib/leads/tones.ts. Every chip says its state in WORDS; the colour of its border only helps, and the text is plain foreground on a solid surface.
 */

/** A labelled native select: it takes the label wiring, and the lists here are short. */
export function LeadFacet({ label, value, choices, onChange }: { label: string; value: string; choices: readonly Choice[]; onChange: (value: string) => void }) {
  const id = useId()
  return (
    <div className="flex min-w-[9rem] flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
      <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
      </NativeSelect>
    </div>
  )
}

/** What a channel may do, in words ("Blocked: opted out", "Opted in"). The whole sentence, reason included, is the tooltip. */
export function ConsentChip({ view }: { view: ConsentView }) {
  return (
    <span
      className={cn(CHIP_BASE, view.allowed ? LEAD_CHIP.allowed : LEAD_CHIP.blocked)}
      title={consentSentence(view)}
      data-consent={view.channel}
      data-allowed={view.allowed ? 'true' : 'false'}
    >
      {view.word}
    </span>
  )
}

/** The consent chip a list row shows under the email address, from what the lead's own record says; nothing at all for a lead nobody has recorded anything for. */
export function EmailConsentChip({ lead }: { lead: Lead }) {
  const view = emailConsent(lead)
  return view ? <div className="mt-1"><ConsentChip view={view} /></div> : null
}

/** The list's marker for a lead that was made from a signal. It is words, and it adds no column. */
export function SignalMarker() {
  return <span className={cn(CHIP_BASE, LEAD_CHIP.signal)} title="This lead was made from a signal" data-from-signal>From a signal</span>
}

/**
 * Under a lead's name on its page: the product and organisation account it is for, what each channel may do with the reason in plain words, and, for a lead
 * made from a signal, a button to the Evidence tab. Draws nothing when the server told it nothing (an older server), so the header is as it was.
 */
export function LeadContextLine({ lead, onOpenEvidence }: { lead: Lead; onOpenEvidence?: () => void }) {
  const views = consentViews(lead)
  const product = lead.product ?? null
  const organisation = lead.organisationAccount ?? null
  // Slice 9: the campaign the lead first came from (the server reads it through the lead's own organisation); nothing for a lead that came from none.
  const campaign = leadCampaignName(lead.campaign)
  const fromSignal = isFromSignal(lead)
  if (views.length === 0 && !product && !organisation && !campaign && !fromSignal) return null

  const explained = views.filter((view) => view.reason)
  return (
    <div className="mt-2 space-y-1.5" data-lead-context>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        {product && <span data-lead-product>Product: <span className="font-medium text-foreground">{product.name}</span></span>}
        {organisation && <span data-lead-organisation>Organisation: <span className="font-medium text-foreground">{organisation.name}</span></span>}
        {campaign && <span className="break-words" data-lead-campaign>Campaign: <span className="font-medium text-foreground">{campaign}</span></span>}
        {views.map((view) => (
          <span key={view.channel} className="inline-flex items-center gap-1.5">
            {view.label}
            <ConsentChip view={view} />
          </span>
        ))}
        {fromSignal && (onOpenEvidence ? (
          <button
            type="button"
            onClick={onOpenEvidence}
            className={cn(CHIP_BASE, LEAD_CHIP.signal, 'hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
            data-from-signal
          >
            From a signal: see the evidence
          </button>
        ) : <SignalMarker />)}
      </div>
      {explained.map((view) => (
        <p key={view.channel} className="text-xs text-muted-foreground" data-consent-reason={view.channel}>{view.label}: {view.reason}</p>
      ))}
    </div>
  )
}
