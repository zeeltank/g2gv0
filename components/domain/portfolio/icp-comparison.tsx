'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, HelpCircle, Loader2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { apiErrorText } from '@/lib/api-messages'
import { comparisonScope, scoreLabel, scoreTone } from '@/lib/icp-products'
import type { LaravelContext } from '@/lib/laravel-context'
import { productIcpService, type IcpComparison, type IcpComparisonResult } from '@/services/signals/product-icp'

const TONE: Record<string, string> = {
  strong: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
  partial: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300',
  weak: 'border-destructive/40 bg-destructive/10 text-destructive',
  unknown: 'border-border bg-muted text-muted-foreground',
}

function Result({ r }: { r: IcpComparisonResult }) {
  const tone = scoreTone(r.score)

  return (
    <article aria-label={`${r.offer.name} compared with the ICP`} className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="break-words text-sm font-semibold text-foreground">{r.offer.name} <span className="font-normal text-muted-foreground">· {r.offer.offer_id}</span></h4>
          <p className="text-xs text-muted-foreground">{r.offer.parent_product}</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-semibold ${TONE[tone]}`} data-testid="score">
          {tone === 'unknown' && <HelpCircle className="size-3.5" aria-hidden />}
          {scoreLabel(r)}
        </span>
      </header>

      <p className="break-words text-sm text-foreground">{r.summary}</p>

      <ul className="space-y-3">
        {r.dimensions.map((d) => (
          <li key={d.key} className="space-y-1.5 rounded-lg bg-muted/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{d.label} <span className="text-xs font-normal text-muted-foreground">· weight {d.weight}%</span></p>
              <Badge variant={d.score === null ? 'muted' : 'default'}>{d.score === null ? 'Insufficient data' : `${d.score}%`}</Badge>
            </div>
            {d.score !== null && (
              <div role="progressbar" aria-label={`${d.label} score`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={d.score} className="h-1.5 w-full overflow-hidden rounded-full bg-primary/15">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(d.score, 3)}%` }} />
              </div>
            )}
            <p className="text-xs text-muted-foreground">{d.note}</p>
            {d.evidence.length > 0 && (
              <ul className="space-y-0.5 text-xs text-foreground">
                {d.evidence.map((e) => <li key={e} className="flex gap-1.5"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden /><span className="min-w-0 break-words">{e}</span></li>)}
              </ul>
            )}
            {d.missing.length > 0 && (
              <ul className="space-y-0.5 text-xs text-foreground">
                {d.missing.map((m) => <li key={m} className="flex gap-1.5"><XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden /><span className="min-w-0 break-words">{m}</span></li>)}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Target market</p>
        <p>ICP: {r.market.icp_industry ?? 'not stated'}{r.market.icp_regions.length > 0 ? ` · ${r.market.icp_regions.join(', ')}` : ''}</p>
        <p>Product serves: {r.market.product_segments.length > 0 ? r.market.product_segments.join(', ') : 'no segments stated'}{r.market.deployment_model ? ` · ${r.market.deployment_model}` : ''}</p>
        <p>{r.market.note}</p>
      </div>

      <p className="text-xs text-muted-foreground">
        Status: {r.facts.readiness_status ?? 'not stated'}{r.facts.readiness_confirmed ? ' (confirmed)' : ' (not confirmed)'} · Pricing: {r.facts.pricing_model ?? 'none stored'}{r.facts.typical_deal_band ? ` · ${r.facts.typical_deal_band}` : ''}. These do not change the score.
      </p>

      {r.recommendations.length > 0 && (
        <div>
          <p className="text-sm font-medium text-foreground">What to do about it</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {r.recommendations.map((t) => <li key={t} className="break-words">{t}</li>)}
          </ul>
        </div>
      )}
    </article>
  )
}

/**
 * How well the chosen portfolio products fit this product's saved ICP. It asks the server (deterministic scoring; no AI, nothing is saved) and
 * shows the score with how it was worked out, what matched, what is missing, the words behind each conclusion, and what to do about it.
 */
export function IcpComparison({
  context, productKey, offerIds, dirty, catalogVersion,
}: {
  context: LaravelContext
  productKey: string
  /** The products currently chosen in the form (may differ from what is saved). */
  offerIds: string[]
  dirty: boolean
  catalogVersion: number
}) {
  const [data, setData] = useState<IcpComparison['data'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const ids = offerIds.join(',')

  // A new product, a change to the list, or a portfolio edit makes an earlier answer out of date.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null); setError('')
  }, [productKey, ids, catalogVersion])

  async function compare() {
    if (loading || offerIds.length === 0) return
    setLoading(true)
    setError('')
    try {
      setData((await productIcpService.compare(context, productKey, offerIds)).data)
    } catch (e) {
      setError(apiErrorText(e, 'Could not compare the products.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <fieldset className="space-y-3 rounded-lg border border-border/60 p-4">
      <legend className="px-1 text-sm font-semibold text-foreground">ICP and product comparison</legend>
      <p className="max-w-prose text-xs text-muted-foreground">{comparisonScope({ saved: data?.icp.saved ?? true, dirty, count: offerIds.length })}</p>
      <Button type="button" size="sm" variant="outline" disabled={loading || offerIds.length === 0} onClick={() => void compare()}>
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}Compare {offerIds.length === 1 ? 'this product' : 'these products'}
      </Button>
      {error && <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle className="size-4" aria-hidden />{error}</p>}
      {data && (
        <div className="space-y-3" aria-live="polite">
          <p className="text-xs text-muted-foreground">{data.method}</p>
          {data.unknown_offer_ids.length > 0 && <p role="alert" className="text-sm text-destructive">Not found in your portfolio: {data.unknown_offer_ids.join(', ')}. Remove them from the list.</p>}
          {data.results.map((r) => <Result key={r.offer.offer_id ?? r.offer.id} r={r} />)}
        </div>
      )}
    </fieldset>
  )
}
