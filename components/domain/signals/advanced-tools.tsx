'use client'

import { useState } from 'react'
import { ChevronDown, History, RefreshCw, Settings2, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { LaravelContext } from '@/lib/laravel-context'
import { ApiError } from '@/services/core'
import { opportunitiesService, type ResearchRun, type ResearchSourceInfo, type ResearchStatusResponse } from '@/services/signals/opportunities'
import { ProductProfileDialog } from '@/components/domain/organization/department-management/product-profile-dialog'
import { ProviderStatusPanel } from '@/components/domain/organization/department-management/provider-status-panel'

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
function fmt(value?: string | null, withTime = true) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}
const errText = (cause: unknown, fallback: string) => (cause instanceof ApiError || cause instanceof Error ? cause.message : fallback)

/**
 * The secondary tools of Company opportunities, folded away until wanted: provider connectivity, the report history of the selected product,
 * the company profile, and a refresh. Nothing here starts research.
 */
export function AdvancedTools({
  context, productKey, productLabel, status, onRefresh, onChanged,
}: {
  context: LaravelContext
  productKey: string
  productLabel: string
  status: ResearchStatusResponse['data'] | null
  onRefresh: () => void
  onChanged: () => void
}) {
  const [providers, setProviders] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<ResearchRun[] | null>(null)
  const [historyError, setHistoryError] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const last = status?.last_successful_run

  async function showHistory() {
    setHistoryOpen(true)
    setHistory(null)
    setHistoryError('')
    try {
      const all = (await opportunitiesService.getRuns(context)).data
      // This product's runs. Runs made before products were recorded are ScholarClone's.
      setHistory(all.filter((r) => (r.product_key ?? 'scholarclone') === productKey))
    } catch (e) {
      setHistoryError(e instanceof ApiError || e instanceof Error ? e.message : 'Could not load the report history.')
    }
  }

  return (
    <details className="group rounded-xl border border-border/60 bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
        <span>Advanced tools</span>
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t border-border/60 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Last successful run for {productLabel}: {last ? when(last.completed_at) : 'none yet'}. Automatic daily generation is off; research runs only when you press Generate Signals.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onRefresh}><RefreshCw className="mr-1.5 size-4" /> Refresh</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setProviders(true)}><ShieldCheck className="mr-1.5 size-4" /> Providers</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void showHistory()}><History className="mr-1.5 size-4" /> Report history</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setProfileOpen(true)}><Settings2 className="mr-1.5 size-4" /> Company profile</Button>
        </div>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{productLabel} research history</DialogTitle><DialogDescription>Every run for this product is kept, including skipped and failed ones.</DialogDescription></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {historyError ? <p className="text-sm text-destructive" role="alert">{historyError}</p>
              : !history ? <Skeleton className="h-24" />
              : history.length === 0 ? <p className="text-sm text-muted-foreground">No research runs for this product yet.</p>
              : <ul className="divide-y divide-border/60">{history.map((r) => <RunLine key={r.id} run={r} context={context} />)}</ul>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={providers} onOpenChange={setProviders}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>AI &amp; web search connectivity</DialogTitle><DialogDescription>Shows which AI and search providers are configured, and lets you run a real test call.</DialogDescription></DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto">
            <ProviderStatusPanel context={context} canTest onChanged={onChanged} />
          </div>
        </DialogContent>
      </Dialog>

      <ProductProfileDialog open={profileOpen} context={context} onOpenChange={setProfileOpen} onSaved={onChanged} />
    </details>
  )
}

/**
 * Relocated from the now-deleted department-local opportunities-view.tsx (Sales & Marketing
 * merge, Phase 5: that file's own department-scoping was dead code, replaced by a focused
 * DepartmentSignalsPanel - this one piece, the research-run row with its expandable source
 * list, wasn't department-specific at all and is still needed here, its only remaining caller.
 */
function RunLine({ run, context }: { run: ResearchRun; context: LaravelContext }) {
  const tone = run.status === 'failed' ? 'destructive' : run.status === 'skipped' ? 'muted' : run.status === 'partial' ? 'warning' : 'success'
  const [sources, setSources] = useState<ResearchSourceInfo[] | null>(null)
  const [openSources, setOpenSources] = useState(false)
  const [sourcesError, setSourcesError] = useState('')

  async function toggle() {
    const next = !openSources
    setOpenSources(next)
    if (next && sources === null) {
      try {
        setSources((await opportunitiesService.getRunSources(context, run.id)).data)
      } catch (cause) {
        setSourcesError(errText(cause, 'Could not load the sources.'))
      }
    }
  }

  return (
    <li className="space-y-1 py-3 text-sm first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">{fmt(run.report_date, false)}</span>
        <Badge variant={tone}>{run.status}</Badge>
        <Badge variant="muted">{run.trigger}</Badge>
        <span className="ml-auto text-xs text-muted-foreground">{fmt(run.started_at)}</span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {run.sources_found} sources · {run.companies_researched} companies · {run.opportunities_qualified} qualified ({run.opportunities_new} new)
        {run.queries_failed > 0 && ` · ${run.queries_failed}/${run.queries_run} searches failed`}
      </p>
      {run.error_message && <p className="text-xs leading-relaxed text-foreground">{run.error_message}</p>}
      {run.sources_found > 0 && (
        <>
          <button type="button" onClick={() => void toggle()} className="text-xs font-medium text-primary hover:underline">{openSources ? 'Hide sources' : 'View sources'}</button>
          {openSources && (
            <ul className="mt-2 space-y-2 rounded-lg bg-muted/40 p-3">
              {sourcesError && <li className="text-xs text-destructive">{sourcesError}</li>}
              {sources === null && !sourcesError && <li className="text-xs text-muted-foreground">Loading…</li>}
              {sources?.map((src, i) => (
                <li key={i} className="min-w-0 text-xs leading-relaxed">
                  <a href={src.url} target="_blank" rel="noopener noreferrer" className="break-words font-medium text-primary hover:underline">{src.title}</a>
                  <span className="block break-all text-muted-foreground">{src.domain} · published {fmt(src.published_at, false)} · {src.page_fetched ? 'full page read' : 'search excerpt'}{src.cited ? ' · cited by a signal' : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  )
}
