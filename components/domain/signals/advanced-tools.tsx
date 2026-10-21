'use client'

import { useState } from 'react'
import { ChevronDown, History, RefreshCw, Settings2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { LaravelContext } from '@/lib/laravel-context'
import { ApiError } from '@/services/core'
import { opportunitiesService, type ResearchRun, type ResearchStatusResponse } from '@/services/signals/opportunities'
import { ProductProfileDialog } from '@/components/domain/organization/department-management/product-profile-dialog'
import { ProviderStatusPanel } from '@/components/domain/organization/department-management/provider-status-panel'
import { RunLine } from '@/components/domain/organization/department-management/opportunities-view'

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

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
