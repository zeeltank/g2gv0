'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DownloadCloud,
  Edit2,
  Eye,
  Filter,
  Layers,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/use-auth'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { LaravelContext } from '@/lib/laravel-context'
import { ApiError } from '@/services/core'
import { portfolioService } from '@/services/portfolio/portfolio-service'
import type { ProductOffer, ReadinessLogEntry, TaxonomyData } from '@/services/portfolio/types'

export function PortfolioView({ context, canManage = true }: { context: LaravelContext; canManage?: boolean }) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offers, setOffers] = useState<ProductOffer[]>([])
  const [taxonomy, setTaxonomy] = useState<TaxonomyData | null>(null)
  const [stats, setStats] = useState<{
    total_offers: number
    partner_sellable: number
    readiness_confirmed: number
    by_parent_product: Record<string, number>
  } | null>(null)

  // Pagination & Filters
  const [search, setSearch] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [readinessFilter, setReadinessFilter] = useState('')
  const [sellableFilter, setSellableFilter] = useState('')
  const [needFilter, setNeedFilter] = useState('')
  const [segmentFilter, setSegmentFilter] = useState('')
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)

  // Dialogs
  const [detailOffer, setDetailOffer] = useState<ProductOffer | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editOffer, setEditOffer] = useState<ProductOffer | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)

  // Readiness confirmation: administrators only. The server enforces it and records who and when.
  const { user } = useAuth()
  const isAdmin = user?.role === 'administrator'
  const [readinessAction, setReadinessAction] = useState<'confirm' | 'remove' | null>(null)
  const [readinessNote, setReadinessNote] = useState('')
  const [readinessSaving, setReadinessSaving] = useState(false)
  const [readinessError, setReadinessError] = useState<string | null>(null)
  const [readinessLog, setReadinessLog] = useState<ReadinessLogEntry[] | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [taxRes, statsRes, listRes] = await Promise.all([
        portfolioService.getTaxonomy(context),
        portfolioService.getPortfolioStats(context),
        portfolioService.getOffers(context, {
          search: search.trim() || undefined,
          parent_product: productFilter || undefined,
          readiness_status: readinessFilter || undefined,
          partner_sellable: sellableFilter ? sellableFilter === 'yes' : undefined,
          need: needFilter || undefined,
          segment: segmentFilter || undefined,
          page,
          per_page: 12,
        }),
      ])

      setTaxonomy(taxRes.data)
      setStats(statsRes.data)
      setOffers(listRes.data.data)
      setLastPage(listRes.data.last_page)
      setTotal(listRes.data.total)
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load portfolio.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [context, search, productFilter, readinessFilter, sellableFilter, needFilter, segmentFilter, page])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  const handleTriggerImport = async () => {
    if (!canManage) return
    setImporting(true)
    setImportMsg(null)
    try {
      const res = await portfolioService.triggerImport(context)
      setImportMsg(
        `Import complete: ${res.data.imported} imported, ${res.data.updated} updated, ${res.data.skipped} skipped.`
      )
      loadData()
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!canManage || !confirm('Are you sure you want to delete this offer?')) return
    try {
      await portfolioService.deleteOffer(context, id)
      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete offer.')
    }
  }

  const loadReadinessLog = async (offerId: number) => {
    if (!canManage) return
    try {
      setReadinessLog((await portfolioService.getReadinessLog(context, offerId)).data)
    } catch {
      setReadinessLog([])
    }
  }

  const viewOfferDetail = async (offer: ProductOffer) => {
    setDetailOffer(offer)
    setReadinessLog(null)
    setDetailLoading(true)
    void loadReadinessLog(offer.id)
    try {
      const full = await portfolioService.getOffer(context, offer.id)
      setDetailOffer(full.data)
    } catch {
      // fallback to current
    } finally {
      setDetailLoading(false)
    }
  }

  const submitReadiness = async () => {
    if (!detailOffer || !readinessAction) return
    const confirmed = readinessAction === 'confirm'
    if (confirmed && readinessNote.trim().length < 5) {
      setReadinessError('Say what was verified (at least 5 characters).')
      return
    }
    setReadinessSaving(true)
    setReadinessError(null)
    try {
      const res = await portfolioService.setReadiness(context, detailOffer.id, confirmed, readinessNote.trim() || undefined)
      setDetailOffer({ ...detailOffer, ...res.data })
      setReadinessAction(null)
      setReadinessNote('')
      void loadReadinessLog(detailOffer.id)
      loadData()
    } catch (err) {
      setReadinessError(err instanceof Error ? err.message : 'Could not update readiness.')
    } finally {
      setReadinessSaving(false)
    }
  }

  return (
    <div className="space-y-6 p-4 @xl:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="navy" className="gap-1">
              <Package className="size-3" /> Foundation Data
            </Badge>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Product Portfolio
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Offer-level catalog across G2G Core, Enterprise Brain, Scholar K-12, Higher Ed, and Bundles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing || loading}>
            <RefreshCw className={`size-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {canManage && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTriggerImport}
                disabled={importing}
                title="Sync from G2G_Foundation_Data_Portfolio_Partners.xlsx"
              >
                <DownloadCloud className={`size-3.5 mr-1.5 ${importing ? 'animate-spin' : ''}`} />
                {importing ? 'Syncing...' : 'Sync Excel'}
              </Button>

              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-3.5 mr-1.5" />
                Add Offer
              </Button>
            </>
          )}
        </div>
      </div>

      {importMsg && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary flex items-center justify-between">
          <span>{importMsg}</span>
          <button type="button" onClick={() => setImportMsg(null)} className="text-xs font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* KPI Stats Cards */}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Offers
            </div>
            <div className="mt-1 text-2xl font-bold text-foreground">{stats.total_offers}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Across 5 parent products</div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Partner Sellable
            </div>
            <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.partner_sellable}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Live, Proven on real data, or Built
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Readiness Confirmed
            </div>
            <div className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.readiness_confirmed}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">Human-verified production status</div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              G2G Core / EB Split
            </div>
            <div className="mt-1 text-sm font-semibold text-foreground flex items-center gap-2">
              <span>G2G: {stats.by_parent_product['G2G'] ?? 0}</span>
              <span>·</span>
              <span>EB: {stats.by_parent_product['EB'] ?? 0}</span>
              <span>·</span>
              <span>K12: {stats.by_parent_product['Scholar K-12'] ?? 0}</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              HE: {stats.by_parent_product['HE'] ?? 0} · Bundles: {stats.by_parent_product['Bundle'] ?? 0}
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search offers by name, what it does, or ID..."
              className="pl-9 text-xs"
            />
          </div>

          <select
            value={productFilter}
            onChange={(e) => {
              setProductFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">All Parent Products</option>
            {taxonomy?.parent_products &&
              Object.entries(taxonomy.parent_products).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
          </select>

          <select
            value={sellableFilter}
            onChange={(e) => {
              setSellableFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">All Readiness States</option>
            <option value="yes">Partner Sellable Only (9)</option>
            <option value="no">In Development / Pilot / Concept (16)</option>
          </select>

          <select
            value={needFilter}
            onChange={(e) => {
              setNeedFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">All Needs (N01 - N20)</option>
            {taxonomy?.needs &&
              Object.entries(taxonomy.needs).map(([code, label]) => (
                <option key={code} value={code}>
                  {code} - {label}
                </option>
              ))}
          </select>

          <select
            value={segmentFilter}
            onChange={(e) => {
              setSegmentFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">All Buyer Segments</option>
            {taxonomy?.segments &&
              Object.entries(taxonomy.segments).map(([code, label]) => (
                <option key={code} value={code}>
                  {code} - {label}
                </option>
              ))}
          </select>

          {(search || productFilter || sellableFilter || needFilter || segmentFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('')
                setProductFilter('')
                setSellableFilter('')
                setNeedFilter('')
                setSegmentFilter('')
                setPage(1)
              }}
              className="text-xs"
            >
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {/* Offers Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Could not load portfolio" description={error} retry={() => { void loadData() }} />
      ) : offers.length === 0 ? (
        <EmptyState
          title="No offers found"
          description={
            search || productFilter || readinessFilter || sellableFilter
              ? 'No offers match the selected filter criteria. Try clearing some filters.'
              : 'The product portfolio catalog is currently empty. Run Sync Excel to import foundation offers.'
          }
          action={
            canManage ? (
              <Button size="sm" onClick={handleTriggerImport} disabled={importing}>
                Sync Foundation Excel
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-xs font-bold text-primary">
                      {offer.offer_id}
                    </span>
                    <Badge variant={offer.partner_sellable ? 'success' : 'outline'} className="text-[10px]">
                      {offer.readiness_status}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-foreground line-clamp-1">
                      {offer.name}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {offer.what_it_does || 'No description recorded'}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-1 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">Product:</span>
                      <span>{offer.parent_product}</span>
                      {offer.deployment_model && <span>· {offer.deployment_model}</span>}
                    </div>

                    {offer.needs_solved && offer.needs_solved.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        <span className="font-medium text-foreground mr-1">Needs:</span>
                        {offer.needs_solved.slice(0, 3).map((nc) => (
                          <Badge key={nc} variant="muted" className="text-[10px] px-1.5 py-0">
                            {nc}
                          </Badge>
                        ))}
                        {offer.needs_solved.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{offer.needs_solved.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                  <span className="text-[11px] text-muted-foreground">
                    {offer.typical_deal_band ? `Deal: ${offer.typical_deal_band}` : 'Band: To fill'}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => viewOfferDetail(offer)}>
                      <Eye className="size-3.5 mr-1" /> View
                    </Button>
                    {canManage && (
                      <Button variant="ghost" size="sm" onClick={() => setEditOffer(offer)}>
                        <Edit2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {lastPage > 1 && (
            <div className="flex items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
              <span>
                Page {page} of {lastPage} · {total} offers
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4 mr-1" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= lastPage}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight className="size-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Offer Detail Dialog */}
      <Dialog open={detailOffer !== null} onOpenChange={(open) => !open && setDetailOffer(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailOffer && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-primary">
                    {detailOffer.offer_id}
                  </span>
                  <Badge variant={detailOffer.partner_sellable ? 'success' : 'outline'}>
                    {detailOffer.readiness_status}
                  </Badge>
                  {detailOffer.readiness_confirmed && (
                    <Badge variant="navy">Confirmed</Badge>
                  )}
                </div>
                <DialogTitle className="text-lg font-bold">{detailOffer.name}</DialogTitle>
                <DialogDescription className="text-xs">
                  Parent: {detailOffer.parent_product} · Deployment: {detailOffer.deployment_model || 'Unspecified'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2 text-xs">
                <section className="space-y-1">
                  <h4 className="font-semibold text-muted-foreground uppercase text-[11px]">
                    What It Does
                  </h4>
                  <p className="text-foreground leading-relaxed">
                    {detailOffer.what_it_does || 'No functional overview available.'}
                  </p>
                </section>

                {detailOffer.modules_components && (
                  <section className="space-y-1">
                    <h4 className="font-semibold text-muted-foreground uppercase text-[11px]">
                      Modules &amp; Components
                    </h4>
                    <p className="text-foreground leading-relaxed">
                      {detailOffer.modules_components}
                    </p>
                  </section>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/60 space-y-1">
                    <span className="font-semibold text-[11px] text-muted-foreground uppercase">
                      Needs Solved
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {detailOffer.needs_solved && detailOffer.needs_solved.length > 0 ? (
                        detailOffer.needs_solved.map((n) => (
                          <Badge key={n} variant="muted" className="text-[11px]">
                            {n} - {taxonomy?.needs[n] || n}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">None specified</span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/40 border border-border/60 space-y-1">
                    <span className="font-semibold text-[11px] text-muted-foreground uppercase">
                      Primary Segments
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {detailOffer.primary_segments && detailOffer.primary_segments.length > 0 ? (
                        detailOffer.primary_segments.map((s) => (
                          <Badge key={s} variant="outline" className="text-[11px]">
                            {s} - {taxonomy?.segments[s] || s}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">Cross-segment</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Typical Deal Band:</span>{' '}
                    <span className="text-foreground">{detailOffer.typical_deal_band || 'To fill'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Pricing Model:</span>{' '}
                    <span className="text-foreground">{detailOffer.pricing_model || 'To fill'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Implementation Effort:</span>{' '}
                    <span className="text-foreground">{detailOffer.implementation_effort || 'To fill'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">Delivery Owner:</span>{' '}
                    <span className="text-foreground">{detailOffer.delivery_owner || 'To fill'}</span>
                  </div>
                </div>

                {detailOffer.proof_points && (
                  <section className="space-y-1 p-3 rounded-lg border border-border/60 bg-muted/30">
                    <h4 className="font-semibold text-muted-foreground uppercase text-[11px]">
                      Customer Proof Points &amp; Outcomes
                    </h4>
                    <p className="text-foreground leading-relaxed">{detailOffer.proof_points}</p>
                  </section>
                )}

                <section className="space-y-2 rounded-lg border border-border/60 p-3" aria-label="Readiness">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-semibold text-muted-foreground uppercase text-[11px]">Readiness</h4>
                    {detailOffer.readiness_confirmed ? <Badge variant="success">Verified</Badge> : <Badge variant="warning">Not yet verified</Badge>}
                  </div>
                  <p className="text-foreground">
                    Stage: <span className="font-medium">{detailOffer.readiness_status}</span>.{' '}
                    {detailOffer.readiness_confirmed
                      ? `Confirmed by an administrator${detailOffer.readiness_confirmed_at ? ` on ${new Date(detailOffer.readiness_confirmed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}.`
                      : 'No administrator has confirmed this offer is ready to deliver.'}
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Verified offers are shown as deliverable when they are matched to a signal. Nothing is confirmed automatically, and confirmation never changes a match score.
                  </p>
                  {isAdmin ? (
                    <Button
                      size="sm"
                      variant={detailOffer.readiness_confirmed ? 'outline' : 'default'}
                      onClick={() => { setReadinessError(null); setReadinessNote(''); setReadinessAction(detailOffer.readiness_confirmed ? 'remove' : 'confirm') }}
                    >
                      <ShieldCheck className="mr-1.5 size-3.5" />
                      {detailOffer.readiness_confirmed ? 'Remove confirmation' : 'Confirm readiness'}
                    </Button>
                  ) : (
                    <p className="text-muted-foreground">Only an administrator can confirm readiness.</p>
                  )}
                  {readinessLog && readinessLog.length > 0 && (
                    <ul className="divide-y divide-border/60 border-t border-border/60 pt-1">
                      {readinessLog.map((entry) => (
                        <li key={entry.id} className="py-1.5">
                          <span className="font-medium text-foreground">{entry.action === 'confirmed' ? 'Confirmed' : 'Confirmation removed'}</span>{' '}
                          <span className="text-muted-foreground">· {new Date(entry.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · user #{entry.actor_id ?? '?'}</span>
                          {entry.note && <p className="text-muted-foreground">{entry.note}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {detailOffer.notes && (
                  <section className="space-y-1">
                    <h4 className="font-semibold text-muted-foreground uppercase text-[11px]">Notes</h4>
                    <p className="text-muted-foreground italic leading-relaxed">{detailOffer.notes}</p>
                  </section>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={readinessAction !== null} onOpenChange={(open) => { if (!open && !readinessSaving) setReadinessAction(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{readinessAction === 'confirm' ? 'Confirm readiness' : 'Remove confirmation'}</DialogTitle>
            <DialogDescription>
              {readinessAction === 'confirm'
                ? `You are stating that ${detailOffer?.offer_id ?? 'this offer'} (${detailOffer?.name ?? ''}) is ready to deliver. Your name and the time are recorded.`
                : `${detailOffer?.offer_id ?? 'This offer'} will go back to Not yet verified. The change is recorded.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="readiness-note" className="text-xs font-medium text-foreground">
              {readinessAction === 'confirm' ? 'What was verified? (required)' : 'Reason (optional)'}
            </label>
            <Textarea
              id="readiness-note"
              rows={3}
              value={readinessNote}
              onChange={(e) => setReadinessNote(e.target.value)}
              placeholder={readinessAction === 'confirm' ? 'e.g. Running in production at a client, checked on 8 Oct' : ''}
              disabled={readinessSaving}
            />
            {readinessError && <p role="alert" className="text-xs text-destructive">{readinessError}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setReadinessAction(null)} disabled={readinessSaving}>Cancel</Button>
            <Button size="sm" onClick={() => void submitReadiness()} disabled={readinessSaving}>
              {readinessSaving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <ShieldCheck className="mr-1.5 size-3.5" />}
              {readinessAction === 'confirm' ? 'Confirm readiness' : 'Remove confirmation'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default PortfolioView

