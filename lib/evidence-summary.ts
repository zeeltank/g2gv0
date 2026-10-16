import type { Opportunity } from '@/services/signals/opportunities'

/**
 * The evidence behind one signal, sorted into what the source itself shows, what is our own reading of it, and what has not been established.
 * Every line comes from a field the backend stored (nothing is added or guessed): an absent field produces no "verified" line, and a missing
 * date, an unconfirmed identity or an unread page appear under "not established" rather than being left out.
 */
export interface EvidenceSummary {
  verified: string[]
  inferred: string[]
  missing: string[]
}

const day = (iso?: string | null) => {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null
  if (!m) return null
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`
}

export function summariseEvidence(o: Opportunity): EvidenceSummary {
  const a = o.assessment
  const e = a?.evidence
  const out: EvidenceSummary = { verified: [], inferred: [], missing: [] }

  if (e?.quote_verified) out.verified.push('The quoted wording was found in the source text.')
  if (e) out.verified.push(e.read_as === 'page_text' ? 'The full page was read.' : '')
  const published = day(e?.source_published_at ?? o.source_published_at)
  if (published) out.verified.push(`The source was published on ${published}.`)
  if (a?.identity?.status === 'target_exact') out.verified.push(`It is a school on your target list${a.identity.account_name ? ` (${a.identity.account_name})` : ''}: name and place match.`)
  const stated = a?.buying_intent?.indicators ?? []
  if (stated.length > 0) out.verified.push(`The source itself shows ${stated.length === 1 ? 'a buying sign' : `${stated.length} buying signs`}.`)
  for (const f of (o.confirmed_facts ?? []).slice(0, 3)) out.verified.push(f)

  if (e?.stated_or_inferred === 'inferred' && e.inference_reasoning) out.inferred.push(e.inference_reasoning)
  if (a?.product_fit?.reason) out.inferred.push(`Fit with the product: ${a.product_fit.reason}`)
  for (const p of a?.sales_pull ?? []) if (p.basis === 'inferred') out.inferred.push(`${p.label}: our reading, not stated by the source.`)

  if (a) {
    if (!published) out.missing.push('No publication date on the source, so how recent this is is unknown.')
    if (e?.read_as === 'search_snippet') out.missing.push('Only a search snippet was read, not the whole page.')
    if (a.identity?.status === 'target_possible') out.missing.push('Which school this is has not been confirmed.')
    if (a.identity?.status === 'unrelated') out.missing.push('It is not on your target list.')
    if (stated.length === 0 && a.buying_intent) out.missing.push('Nothing in the source shows a purchase process: this is a possible need.')
  } else if (!published) {
    out.missing.push('No publication date on the source, so how recent this is is unknown.')
  }
  for (const u of a?.unverified ?? []) if (!out.missing.includes(u)) out.missing.push(u)
  for (const u of o.unverified_claims ?? []) if (!out.missing.includes(u)) out.missing.push(u)

  out.verified = out.verified.filter(Boolean)

  return out
}
