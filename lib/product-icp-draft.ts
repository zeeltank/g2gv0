import { lines, rid, toConfig, type FormState } from '@/lib/icp-form'
import type { IcpConfig } from '@/services/signals/product-icp'

/*
 * The individual ICP a person can fill in while adding a product. It is the SAME model the ICP editor uses (FormState -> toConfig -> the
 * product's own ICP API), so nothing is stored in a second place and the server validates it as it validates every ICP. The short text boxes
 * below are turned into the editor's rows here; the full editor stays the place for fine detail (structured rules, per-search settings).
 */

export interface IcpLines {
  /** One buying trigger per line: the situation that shows a customer needs this product. */
  triggers: string
  /** One discovery search per line (the words a buyer would use). */
  queries: string
  /** One exclusion per line: organisations that must never be returned (matched by these words). */
  exclusions: string
  /** Where the evidence for a trigger is expected to come from (one of the editor's source kinds). */
  source: string
  /** How many days a trigger stays fresh. Blank = until the item's own closing date. */
  freshness: string
}

export const emptyIcpLines = (): IcpLines => ({ triggers: '', queries: '', exclusions: '', source: 'news', freshness: '' })

export const emptyIcpForm = (): FormState => ({
  name: '', label: '', industry_label: '', pitch: '', guidance: '', buyer_types: '', regions: '', priority_cities: '', competitors: '', vendor_phrases: '',
  parts: [], triggers: [], queries: [], disqualifiers: [], must_have: [], catalogue: '', accounts: '', offer_ids: [],
})

/** A short lower-case key from a Product ID ("MY-01" -> "my_01"): letters, digits and underscores, starting with a letter, at most 20 characters. */
export function slugKey(offerId: string): string {
  const s = offerId.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const withLetter = /^[a-z]/.test(s) ? s : `p_${s}`

  return withLetter.slice(0, 20).replace(/_+$/, '')
}

const oneLine = (v: string, max: number) => v.replace(/\s+/g, ' ').trim().slice(0, max)

/** True when the person typed anything in the ICP section (an untouched section creates nothing). */
export function icpTouched(form: FormState, l: IcpLines): boolean {
  return [form.label, form.industry_label, form.pitch, form.guidance, form.buyer_types, form.regions, l.triggers, l.queries, l.exclusions].some((v) => v.trim() !== '')
}

/**
 * The ICP settings for a product, from what was typed. It links the ICP to THIS product only (`offer_ids`) and gives it the product's own part,
 * so each trigger is tied to something the product sells. Nothing is invented: a blank box produces nothing.
 */
export function buildIcpConfig(form: FormState, l: IcpLines, offer: { offer_id: string; name: string; what_it_does?: string | null }): IcpConfig {
  const part = slugKey(offer.offer_id) || 'product'
  const triggerLines = lines(l.triggers.replace(/,/g, ';')).flatMap((t) => t.split(';')).map((t) => t.trim()).filter(Boolean)
  const queryLines = l.queries.split('\n').map((q) => q.trim()).filter(Boolean)
  const exclusionLines = l.exclusions.split('\n').map((q) => q.trim()).filter(Boolean)

  const draft: FormState = {
    ...form,
    parts: [{ _id: rid(), key: part, what: oneLine(offer.what_it_does || offer.name, 300) }],
    triggers: triggerLines.map((t, i) => ({
      _id: rid(), key: `${part}_t${i + 1}`.slice(0, 40), source: l.source, part, decay: l.freshness, pain: oneLine(t, 160), phrases: oneLine(t, 80),
    })),
    queries: queryLines.map((q, i) => ({ _id: rid(), id: `${part}-q${i + 1}`.slice(0, 40), source: l.source, topic: l.source === 'news' ? 'news' : 'general', days: '45', q: oneLine(q, 300), domains: '' })),
    disqualifiers: exclusionLines.map((x) => ({ _id: rid(), label: oneLine(x, 60), phrases: oneLine(x, 60) })),
    offer_ids: [offer.offer_id],
  }

  return toConfig(draft)
}
