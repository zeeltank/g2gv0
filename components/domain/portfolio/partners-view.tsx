'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  Briefcase,
  Building,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Eye,
  Filter,
  Handshake,
  Layers,
  Loader2,
  MapPin,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
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
import type { Partner, TaxonomyData } from '@/services/portfolio/types'

export function PartnersView({
  context,
  canManage = true,
}: {
  context: LaravelContext
  canManage?: boolean
}) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [partners, setPartners] = useState<Partner[]>([])
  const [taxonomy, setTaxonomy] = useState<TaxonomyData | null>(null)
  const [stats, setStats] = useState<{
    total_partners: number
    active_partners: number
    pipeline_partners: number
    total_capacity: number
  } | null>(null)

  // Filters & Pagination
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [capacityOnly, setCapacityOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Modals & Panels
  const [detailPartner, setDetailPartner] = useState<Partner | null>(null)
  const [editPartner, setEditPartner] = useState<Partner | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [deleteConfirmPartner, setDeleteConfirmPartner] = useState<Partner | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState<Partial<Partner>>({
    partner_id: '',
    partner_name: '',
    partner_type: 'Regional SI',
    partner_status: 'Active',
    hq_state: 'Delhi',
    states_covered: [],
    segments_covered: [],
    needs_addressed: [],
    procurement_routes: ['Direct', 'GeM'],
    offers_authorized: [],
    empanelments: [],
    delivery_capability: 'L1/L2 Support',
    max_concurrent_deals: 5,
    active_deals_now: 0,
    sales_contact_name: '',
    contact_email: '',
    contact_phone: '',
    commercial_model: 'Margin Share',
    referral_margin_pct: 15,
    deal_registration_agreed: true,
    conflicts: 'None',
  })

  // Load Initial Taxonomy & Stats
  useEffect(() => {
    async function loadMeta() {
      try {
        const [taxRes, statsRes] = await Promise.all([
          portfolioService.getTaxonomy(context),
          portfolioService.getPartnerStats(context),
        ])
        setTaxonomy(taxRes.data)
        setStats(statsRes.data)
      } catch (e) {
        console.error('Failed to load partner metadata', e)
      }
    }
    void loadMeta()
  }, [context])

  // Load Partners List
  const loadPartners = useCallback(async () => {
    try {
      setError(null)
      const res = await portfolioService.getPartners(context, {
        search: search || undefined,
        partner_type: typeFilter || undefined,
        status: statusFilter || undefined,
        state: stateFilter || undefined,
        has_capacity: capacityOnly ? true : undefined,
        page,
        per_page: 12,
      })
      setPartners(res.data.data)
      setTotalPages(res.data.last_page)
      setTotalCount(res.data.total)
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message)
      } else {
        setError('Failed to load partner network.')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [context, search, typeFilter, statusFilter, stateFilter, capacityOnly, page])

  useEffect(() => {
    void loadPartners()
  }, [loadPartners])

  const handleRefresh = () => {
    setRefreshing(true)
    void loadPartners()
    portfolioService.getPartnerStats(context).then((res) => setStats(res.data)).catch(() => {})
  }

  const handleOpenCreate = () => {
    setFormData({
      partner_id: `PT-${Math.floor(100 + Math.random() * 900)}`,
      partner_name: '',
      partner_type: 'Regional SI',
      partner_status: 'Active',
      hq_state: 'Delhi',
      states_covered: ['Delhi'],
      segments_covered: ['State Government'],
      needs_addressed: [],
      procurement_routes: ['Direct', 'GeM'],
      offers_authorized: [],
      empanelments: ['GeM Registered'],
      delivery_capability: 'L1/L2 Support',
      max_concurrent_deals: 5,
      active_deals_now: 0,
      sales_contact_name: '',
      contact_email: '',
      contact_phone: '',
      commercial_model: 'Margin Share',
      referral_margin_pct: 15,
      deal_registration_agreed: true,
      conflicts: 'None',
    })
    setFormError(null)
    setIsCreating(true)
  }

  const handleOpenEdit = (partner: Partner) => {
    setEditPartner(partner)
    setFormData({
      ...partner,
    })
    setFormError(null)
  }

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formData.partner_id || !formData.partner_name) {
      setFormError('Partner ID and Partner Name are required.')
      return
    }

    setIsSaving(true)
    try {
      if (isCreating) {
        await portfolioService.createPartner(context, formData)
        setIsCreating(false)
      } else if (editPartner) {
        await portfolioService.updatePartner(context, editPartner.id, formData)
        setEditPartner(null)
      }
      void loadPartners()
      portfolioService.getPartnerStats(context).then((res) => setStats(res.data)).catch(() => {})
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message)
      } else {
        setFormError('Failed to save partner record.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (partner: Partner) => {
    try {
      await portfolioService.deletePartner(context, partner.id)
      setDeleteConfirmPartner(null)
      if (detailPartner?.id === partner.id) setDetailPartner(null)
      void loadPartners()
      portfolioService.getPartnerStats(context).then((res) => setStats(res.data)).catch(() => {})
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to delete partner')
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Partner Network
            </h1>
            <Badge variant="outline" className="text-xs">
              Phase 1
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage regional system integrators, distributors, and delivery partners for offer fulfillment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            <RefreshCw className={`mr-2 size-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {canManage && (
            <Button size="sm" onClick={handleOpenCreate}>
              <Plus className="mr-2 size-4" />
              Add Partner
            </Button>
          )}
        </div>
      </div>

      {/* KPI Stats Banner */}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Total Partners</span>
              <Building className="size-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">{stats.total_partners}</div>
            <div className="mt-1 text-xs text-muted-foreground">Empanelled partner ecosystem</div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Active Partners</span>
              <CheckCircle2 className="size-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600">{stats.active_partners}</div>
            <div className="mt-1 text-xs text-muted-foreground">Ready for deal routing</div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Pipeline Partners</span>
              <Users className="size-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">{stats.pipeline_partners}</div>
            <div className="mt-1 text-xs text-muted-foreground">Under onboarding / review</div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Available Capacity</span>
              <ShieldCheck className="size-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-blue-600">{stats.total_capacity} slots</div>
            <div className="mt-1 text-xs text-muted-foreground">Concurrent deal availability</div>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search partners by name, ID, or territory..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-9 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value)
              setPage(1)
            }}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All Partner Types</option>
            {taxonomy?.partner_types &&
              Object.entries(taxonomy.partner_types).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All Statuses</option>
            {taxonomy?.partner_statuses &&
              Object.entries(taxonomy.partner_statuses).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
          </select>

          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-muted-foreground select-none px-2 py-1 rounded border border-border bg-muted/30">
            <input
              type="checkbox"
              checked={capacityOnly}
              onChange={(e) => {
                setCapacityOnly(e.target.checked)
                setPage(1)
              }}
              className="rounded border-border text-primary focus:ring-0"
            />
            Has Capacity Only
          </label>

          {(search || typeFilter || statusFilter || capacityOnly) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('')
                setTypeFilter('')
                setStatusFilter('')
                setCapacityOnly(false)
                setPage(1)
              }}
              className="text-xs"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border p-5 space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Error Loading Partners"
          description={error}
          retry={() => {
            void loadPartners()
          }}
        />
      ) : partners.length === 0 ? (
        <EmptyState
          title="No Partners Found"
          description="Try modifying your search criteria or add new partners to your distribution network."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {partners.map((partner) => {
            const hasCapacity = partner.capacity_available > 0
            const isGovReady = partner.empanelments?.some((e) =>
              e.toLowerCase().includes('gem') || e.toLowerCase().includes('empanel')
            )

            return (
              <div
                key={partner.id}
                className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-muted-foreground">
                          {partner.partner_id}
                        </span>
                        <Badge
                          variant={
                            partner.partner_status === 'Active'
                              ? 'success'
                              : partner.partner_status === 'Pipeline'
                              ? 'warning'
                              : 'outline'
                          }
                          className="text-[10px]"
                        >
                          {partner.partner_status}
                        </Badge>
                      </div>
                      <h3 className="mt-1 text-base font-bold text-foreground line-clamp-1">
                        {partner.partner_name}
                      </h3>
                      <p className="text-xs text-muted-foreground">{partner.partner_type}</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => setDetailPartner(partner)}
                        title="View details"
                      >
                        <Eye className="size-4" />
                      </Button>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => handleOpenEdit(partner)}
                          title="Edit partner"
                        >
                          <Edit2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Territory & HQ */}
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3.5 text-primary shrink-0" />
                    <span className="truncate">
                      HQ: {partner.hq_state || 'Not specified'}
                      {partner.states_covered && partner.states_covered.length > 0
                        ? ` · Covers ${partner.states_covered.length} state(s)`
                        : ''}
                    </span>
                  </div>

                  {/* Badges for Segments & GeM */}
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {isGovReady && (
                      <Badge variant="navy" className="text-[10px] gap-1">
                        <ShieldCheck className="size-3" /> GeM Empanelled
                      </Badge>
                    )}
                    {partner.delivery_capability && (
                      <Badge variant="outline" className="text-[10px]">
                        {partner.delivery_capability}
                      </Badge>
                    )}
                  </div>

                  {/* Capacity Bar */}
                  <div className="mt-4 rounded-lg bg-muted/40 p-2.5 border border-border/50 text-xs">
                    <div className="flex items-center justify-between font-medium">
                      <span className="text-muted-foreground">Deal Capacity</span>
                      <span className={hasCapacity ? 'text-emerald-600 font-bold' : 'text-destructive font-bold'}>
                        {partner.capacity_available} / {partner.max_concurrent_deals} Available
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          hasCapacity ? 'bg-emerald-500' : 'bg-destructive'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              ((partner.max_concurrent_deals - partner.capacity_available) /
                                (partner.max_concurrent_deals || 1)) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer with Performance and Contact */}
                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>Won: <strong>{partner.deals_won}</strong></span>
                    {partner.conversion_rate != null && (
                      <span>({Math.round(partner.conversion_rate)}% rate)</span>
                    )}
                  </div>
                  {partner.contact_email ? (
                    <span className="truncate max-w-[140px]" title={partner.contact_email}>
                      {partner.sales_contact_name || partner.contact_email}
                    </span>
                  ) : (
                    <span>No contact</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div className="text-xs text-muted-foreground">
            Showing {partners.length} of {totalCount} partners
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="size-4 mr-1" /> Previous
            </Button>
            <span className="text-xs text-muted-foreground font-medium">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Partner Detail Dialog */}
      <Dialog open={!!detailPartner} onOpenChange={(open) => !open && setDetailPartner(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailPartner && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-primary">
                    {detailPartner.partner_id}
                  </span>
                  <Badge
                    variant={
                      detailPartner.partner_status === 'Active'
                        ? 'success'
                        : detailPartner.partner_status === 'Pipeline'
                        ? 'warning'
                        : 'outline'
                    }
                  >
                    {detailPartner.partner_status}
                  </Badge>
                </div>
                <DialogTitle className="text-xl font-bold">
                  {detailPartner.partner_name}
                </DialogTitle>
                <DialogDescription>
                  {detailPartner.partner_type} · HQ: {detailPartner.hq_state || 'Not specified'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2 text-xs">
                {/* Capacity & Commercials */}
                <div className="grid gap-3 sm:grid-cols-3 bg-muted/40 p-3 rounded-lg border border-border">
                  <div>
                    <span className="text-muted-foreground uppercase text-[10px] font-semibold">
                      Capacity Available
                    </span>
                    <div className="text-base font-bold text-foreground mt-0.5">
                      {detailPartner.capacity_available} / {detailPartner.max_concurrent_deals} slots
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground uppercase text-[10px] font-semibold">
                      Active Deals Now
                    </span>
                    <div className="text-base font-bold text-foreground mt-0.5">
                      {detailPartner.active_deals_now}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground uppercase text-[10px] font-semibold">
                      Commercial Model
                    </span>
                    <div className="text-base font-bold text-foreground mt-0.5">
                      {detailPartner.commercial_model || 'Standard'}
                      {detailPartner.referral_margin_pct != null
                        ? ` (${detailPartner.referral_margin_pct}%)`
                        : ''}
                    </div>
                  </div>
                </div>

                {/* States Covered */}
                <div>
                  <h4 className="font-semibold text-foreground uppercase tracking-wider text-[11px] mb-1.5">
                    States Covered
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {detailPartner.states_covered && detailPartner.states_covered.length > 0 ? (
                      detailPartner.states_covered.map((st) => (
                        <Badge key={st} variant="outline" className="text-xs">
                          {st}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">National / All India</span>
                    )}
                  </div>
                </div>

                {/* Segments & Procurement */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <h4 className="font-semibold text-foreground uppercase tracking-wider text-[11px] mb-1.5">
                      Buyer Segments Covered
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {detailPartner.segments_covered?.map((seg) => (
                        <Badge key={seg} variant="secondary" className="text-xs">
                          {seg}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground uppercase tracking-wider text-[11px] mb-1.5">
                      Procurement Routes
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {detailPartner.procurement_routes?.map((pr) => (
                        <Badge key={pr} variant="outline" className="text-xs">
                          {pr}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Authorized Offers */}
                <div>
                  <h4 className="font-semibold text-foreground uppercase tracking-wider text-[11px] mb-1.5">
                    Authorized Portfolio Offers
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {detailPartner.offers_authorized && detailPartner.offers_authorized.length > 0 ? (
                      detailPartner.offers_authorized.map((off) => (
                        <Badge key={off} variant="navy" className="text-xs font-mono">
                          {off}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">All standard catalog offers</span>
                    )}
                  </div>
                </div>

                {/* Empanelments & Delivery */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <h4 className="font-semibold text-foreground uppercase tracking-wider text-[11px] mb-1.5">
                      Empanelments &amp; Certifications
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {detailPartner.empanelments?.map((emp) => (
                        <Badge key={emp} variant="outline" className="text-xs">
                          {emp}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground uppercase tracking-wider text-[11px] mb-1.5">
                      Delivery Capability
                    </h4>
                    <p className="text-muted-foreground">
                      {detailPartner.delivery_capability || 'Standard deployment'}
                    </p>
                  </div>
                </div>

                {/* Contact & Conflicts */}
                <div className="border-t border-border pt-3 space-y-2">
                  <h4 className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
                    Sales Contact &amp; Governance
                  </h4>
                  <div className="flex flex-wrap gap-4 text-muted-foreground">
                    {detailPartner.sales_contact_name && (
                      <span>Contact: <strong className="text-foreground">{detailPartner.sales_contact_name}</strong></span>
                    )}
                    {detailPartner.contact_email && (
                      <span className="flex items-center gap-1">
                        <Mail className="size-3" /> {detailPartner.contact_email}
                      </span>
                    )}
                    {detailPartner.contact_phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="size-3" /> {detailPartner.contact_phone}
                      </span>
                    )}
                  </div>
                  {detailPartner.conflicts && detailPartner.conflicts !== 'None' && (
                    <div className="mt-2 text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
                      <strong>Conflict Note:</strong> {detailPartner.conflicts}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between border-t border-border pt-4">
                {canManage ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDeleteConfirmPartner(detailPartner)
                    }}
                  >
                    <Trash2 className="size-3.5 mr-1" /> Delete Partner
                  </Button>
                ) : <div />}
                <Button variant="outline" size="sm" onClick={() => setDetailPartner(null)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add / Edit Partner Modal */}
      <Dialog
        open={isCreating || !!editPartner}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreating(false)
            setEditPartner(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCreating ? 'Add Partner to Network' : `Edit Partner: ${editPartner?.partner_name}`}
            </DialogTitle>
            <DialogDescription>
              Configure partner profile, authorization, capacity, and SLA commitments.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveForm} className="space-y-4 pt-2 text-xs">
            {formError && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
                {formError}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="font-medium text-foreground block mb-1">
                  Partner ID <span className="text-destructive">*</span>
                </label>
                <Input
                  value={formData.partner_id || ''}
                  onChange={(e) => setFormData({ ...formData, partner_id: e.target.value })}
                  placeholder="e.g. PT-014"
                  required
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">
                  Partner Name <span className="text-destructive">*</span>
                </label>
                <Input
                  value={formData.partner_name || ''}
                  onChange={(e) => setFormData({ ...formData, partner_name: e.target.value })}
                  placeholder="e.g. Indic Infotech Pvt Ltd"
                  required
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="font-medium text-foreground block mb-1">Partner Type</label>
                <select
                  value={formData.partner_type || 'Regional SI'}
                  onChange={(e) => setFormData({ ...formData, partner_type: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                >
                  {taxonomy?.partner_types &&
                    Object.entries(taxonomy.partner_types).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Status</label>
                <select
                  value={formData.partner_status || 'Active'}
                  onChange={(e) => setFormData({ ...formData, partner_status: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                >
                  {taxonomy?.partner_statuses &&
                    Object.entries(taxonomy.partner_statuses).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">HQ State</label>
                <Input
                  value={formData.hq_state || ''}
                  onChange={(e) => setFormData({ ...formData, hq_state: e.target.value })}
                  placeholder="e.g. Maharashtra"
                />
              </div>
            </div>

            {/* Capacity Controls */}
            <div className="grid gap-3 sm:grid-cols-2 bg-muted/40 p-3 rounded-lg border border-border">
              <div>
                <label className="font-medium text-foreground block mb-1">
                  Max Concurrent Deals
                </label>
                <Input
                  type="number"
                  min="1"
                  value={formData.max_concurrent_deals ?? 5}
                  onChange={(e) =>
                    setFormData({ ...formData, max_concurrent_deals: parseInt(e.target.value) || 1 })
                  }
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">
                  Active Deals Now
                </label>
                <Input
                  type="number"
                  min="0"
                  value={formData.active_deals_now ?? 0}
                  onChange={(e) =>
                    setFormData({ ...formData, active_deals_now: parseInt(e.target.value) || 0 })
                  }
                />
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Available capacity will be{' '}
                  <strong>
                    {Math.max(
                      0,
                      (formData.max_concurrent_deals ?? 5) - (formData.active_deals_now ?? 0)
                    )}{' '}
                    slots
                  </strong>
                </span>
              </div>
            </div>

            {/* Contact Details */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="font-medium text-foreground block mb-1">Sales Contact</label>
                <Input
                  value={formData.sales_contact_name || ''}
                  onChange={(e) => setFormData({ ...formData, sales_contact_name: e.target.value })}
                  placeholder="e.g. Rajesh Sharma"
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Contact Email</label>
                <Input
                  type="email"
                  value={formData.contact_email || ''}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  placeholder="rajesh@partner.com"
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Contact Phone</label>
                <Input
                  value={formData.contact_phone || ''}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            {/* Delivery Capability & Conflicts */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="font-medium text-foreground block mb-1">
                  Delivery Capability
                </label>
                <Input
                  value={formData.delivery_capability || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, delivery_capability: e.target.value })
                  }
                  placeholder="e.g. L1/L2 Support, Full Turnkey, Onsite engineers"
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">
                  Commercial Conflicts
                </label>
                <Input
                  value={formData.conflicts || ''}
                  onChange={(e) => setFormData({ ...formData, conflicts: e.target.value })}
                  placeholder="e.g. None or Exclusive with Competitor X in State Y"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreating(false)
                  setEditPartner(null)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                {isCreating ? 'Create Partner' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmPartner}
        onOpenChange={(open) => !open && setDeleteConfirmPartner(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Partner</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete partner{' '}
              <strong>{deleteConfirmPartner?.partner_name}</strong> ({deleteConfirmPartner?.partner_id})?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmPartner(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteConfirmPartner && void handleDelete(deleteConfirmPartner)}
            >
              Delete Partner
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

