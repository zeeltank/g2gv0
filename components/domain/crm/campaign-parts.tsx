'use client'

import { useId } from 'react'
import { NativeSelect } from '@/components/shared/scaffolds'
import { Label } from '@/components/ui/label'
import {
  FUNNEL_ABOVE_TEXT, FUNNEL_BASIS_TEXT, FUNNEL_EMPTY_TEXT, FUNNEL_QUIET_TEXT, funnelView, gtmCampaignText, leadsText, productChoices, productText, showProductChoice,
} from '@/lib/campaigns/model'
import { FUNNEL_BAR } from '@/lib/campaigns/tones'
import { cn } from '@/lib/utils'
import type { PmOption } from '@/services/product-master/types'
import type { Campaign, CampaignFunnel, CampaignProductRef } from '@/types/crm'

/**
 * The parts the campaign screens gained with slice 9 (hp_erp docs/agentic-crm/slices/S09-campaigns-to-leads.md): the Funnel section, the Product and links
 * section of a campaign's page, and the form's Product box. The rules (what a step says, when a part shows) are in lib/campaigns/model.ts and the colours in
 * lib/campaigns/tones.ts. Every part draws nothing when the server told it nothing (an older server), so the screens are as they were. Nothing here sends,
 * schedules or changes a campaign: it is all reading, apart from the Product box that the existing Save button submits.
 */

/** A small bar under a number. Hidden from a screen reader: the number and the share in words beside it say the same thing. */
function Bar({ percent }: { percent: number }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full', FUNNEL_BAR.track)} aria-hidden="true">
      <div className={cn('h-full rounded-full', FUNNEL_BAR.fill)} style={{ width: `${percent}%` }} />
    </div>
  )
}

/** One line of the funnel: the label on the left, the number and its share in words on the right; they wrap on a narrow screen rather than scroll. */
function FunnelLine({ label, count, shareText, percent, name }: { label: string; count: number; shareText: string | null; percent: number; name: string }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-sm font-medium text-foreground" data-funnel-label={name}>{label}</span>
        <span className="text-sm text-foreground">
          <span className="font-semibold tabular-nums" data-funnel-count={name}>{count}</span>
          {shareText && <span className="ml-2 text-muted-foreground" data-funnel-share={name}>{shareText}</span>}
        </span>
      </div>
      <Bar percent={percent} />
    </>
  )
}

/**
 * How a campaign is doing: targets, sent, opened, replied, meetings booked and converted as ordered steps, each with its share of the step before, and Opted
 * out apart from them. Words and numbers first; the bars only help the eye. Draws nothing when the server sent no funnel.
 */
export function CampaignFunnelSection({ funnel }: { funnel: CampaignFunnel | null | undefined }) {
  const headingId = useId()
  const view = funnelView(funnel)
  if (!view) return null

  return (
    <section className="space-y-3" aria-labelledby={headingId} data-campaign-funnel>
      <h2 id={headingId} className="text-sm font-semibold text-foreground">Funnel</h2>
      {view.empty ? (
        <p className="text-sm text-muted-foreground" data-funnel-empty>{FUNNEL_EMPTY_TEXT}</p>
      ) : (
        <>
          {view.quiet && <p className="text-sm text-muted-foreground" data-funnel-quiet>{FUNNEL_QUIET_TEXT}</p>}
          <ol className="space-y-3" aria-label="Campaign funnel, from targets to converted">
            {view.steps.map((step) => (
              <li key={step.key} className="space-y-1" data-funnel-step={step.key}>
                <FunnelLine label={step.label} count={step.count} shareText={step.shareText} percent={step.barPercent} name={step.key} />
              </li>
            ))}
          </ol>
          <div className="space-y-1" data-funnel-opted-out>
            <FunnelLine label={view.optedOut.label} count={view.optedOut.count} shareText={view.optedOut.shareText} percent={view.optedOut.barPercent} name="opted_out" />
          </div>
          <p className="text-xs text-muted-foreground" data-funnel-basis>{FUNNEL_BASIS_TEXT}</p>
          {view.anyAbove && <p className="text-xs text-muted-foreground" data-funnel-above>{FUNNEL_ABOVE_TEXT}</p>}
        </>
      )}
    </section>
  )
}

function LinkField({ label, value, name }: { label: string; value: string; name: string }) {
  return (
    <div className="space-y-0.5" data-campaign-link={name}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="break-words text-sm text-foreground">{value}</p>
    </div>
  )
}

/**
 * What a campaign is tied to: its product, the GTM campaign that is the same campaign, and how many leads first came from it. The leads count is plain text:
 * the Leads screen has no campaign filter to link to yet. Draws nothing when the server said none of the three.
 */
export function CampaignLinksSection({ campaign }: { campaign: Pick<Campaign, 'product' | 'gtmCampaign' | 'leads'> }) {
  const headingId = useId()
  const product = productText(campaign.product)
  const gtm = gtmCampaignText(campaign.gtmCampaign)
  const leads = leadsText(campaign.leads)
  if (product === null && gtm === null && leads === null) return null

  return (
    <section className="space-y-3" aria-labelledby={headingId} data-campaign-links>
      <h2 id={headingId} className="text-sm font-semibold text-foreground">Product and links</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {product !== null && <LinkField label="Product" value={product} name="product" />}
        {gtm !== null && <LinkField label="GTM campaign" value={gtm} name="gtm" />}
        {leads !== null && <LinkField label="Leads" value={leads} name="leads" />}
      </div>
    </section>
  )
}

/**
 * The form's optional Product box: "No product" and every product the Product Master lists. A native select: a short list that needs no search, it takes a
 * label, and it needs nothing special inside a dialog. Not drawn when there is nothing to choose and nothing chosen (no right, a server without the master).
 */
export function CampaignProductSelect({ options, current, value, onChange }: {
  options: readonly PmOption[]; current: CampaignProductRef | null; value: string; onChange: (value: string) => void
}) {
  const id = useId()
  if (!showProductChoice(options, current)) return null

  return (
    <div className="space-y-1.5" data-campaign-product-field>
      <Label htmlFor={id}>Product (optional)</Label>
      <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {productChoices(options, current).map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
      </NativeSelect>
    </div>
  )
}
