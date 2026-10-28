'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Circle } from 'lucide-react'
import type { LaravelContext } from '@/lib/laravel-context'
import type { RegionSelection } from '@/lib/region-scope'
import { icpHref } from '@/lib/product-selection'
import { portfolioService } from '@/services/portfolio/portfolio-service'
import type { ResearchContext } from '@/services/portfolio/types'

/** One line saying what the run will be built from (product, ICP and version, regions), with the saved/missing detail folded away. */
export function ResearchContextNotice({ context, productKey, regions = [], refreshKey }: { context: LaravelContext; productKey: string; /** The places this run will be limited to (added ones plus a pending country). [] = none chosen. */ regions?: RegionSelection[]; refreshKey?: number }) {
  const [data, setData] = useState<ResearchContext | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null); setError('')
    portfolioService.getResearchContext(context, productKey, regions)
      .then((res) => { if (live) setData(res.data.research_context) })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : 'Could not load what this run will use.') })
    return () => { live = false }
  }, [context, productKey, refreshKey, JSON.stringify(regions)])   // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p role="status" className="mt-3 text-xs text-muted-foreground">{error}</p>
  if (!data) return null

  return <ResearchContextView data={data} />
}

/** The presentational part: what the run will use, the warnings, and which saved fields feed which stage. Takes the backend's report as it is. */
export function ResearchContextView({ data }: { data: ResearchContext }) {
  const icp = data.icp
  // Product and ICP on one line; the REGION of this run on its own line, so the saved ICP regions are never read as the person's selection.
  const line = icp
    ? `Will use: ${data.product.label} · ICP “${icp.name ?? 'unnamed'}”${icp.version ? ` v${icp.version}` : ''} (${icp.saved ? 'saved' : 'built-in definition'}) · ${data.offer_count} offer${data.offer_count === 1 ? '' : 's'}`
    : `${data.product.label} has no active ICP.`
  const region = data.region
  const regionLine = !region ? null
    : region.source === 'request' ? `Region for this run: ${region.label} (your selection). Searches use it instead of the ICP's saved regions${region.saved_regions.length > 0 ? ` (${region.saved_regions.slice(0, 3).join(', ')}${region.saved_regions.length > 3 ? '…' : ''})` : ''}.`
      : region.source === 'saved ICP' ? `Region for this run: none chosen. The ICP's saved regions apply as the default: ${region.saved_regions.slice(0, 4).join(', ')}${region.saved_regions.length > 4 ? '…' : ''}.`
        : 'Region for this run: All Regions (not limited to a place).'

  return (
    <div className="mt-3 space-y-2 text-xs">
      <p className="text-muted-foreground">{line}</p>
      {icp && regionLine && <p className="text-muted-foreground" data-region-source={region?.source}>{regionLine}</p>}
      {data.warnings.length > 0 && (
        <ul role="status" className="space-y-0.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-800 dark:text-amber-300">
          {data.warnings.map((w) => <li key={w} className="flex gap-1.5"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />{w}</li>)}
          <li><Link href={icpHref(data.product.key ?? '')} className="font-medium underline underline-offset-2">Open its product page</Link></li>
        </ul>
      )}
      <details>
        <summary className="cursor-pointer text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">What the research uses</summary>
        <div className="mt-2 grid gap-3 @xl:grid-cols-2">
          {([['Product details', data.product_fields], ['ICP', data.icp_fields], ['Kept for your team, not used by research', data.kept_for_people ?? []]] as const).map(([title, fields]) => (
            <ul key={title} aria-label={title} className="space-y-1">
              {fields.map((f) => (
                <li key={f.field} className="flex gap-1.5">
                  {f.saved ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden /> : <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                  <span className={f.saved ? 'text-foreground' : 'text-muted-foreground'}>{f.used_for}{f.saved ? '' : ' (not saved)'}</span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </details>
    </div>
  )
}
