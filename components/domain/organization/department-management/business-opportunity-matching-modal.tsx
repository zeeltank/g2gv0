'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  BookmarkPlus,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Handshake,
  HelpCircle,
  Loader2,
  Package,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ReadinessBadge } from './market-evidence'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, type LaravelContext } from '@/lib/laravel-context'
import { portfolioService } from '@/services/portfolio/portfolio-service'
import type {
  OfferMatchResult,
  PartnerEvaluation,
  SignalMatchingResponse,
} from '@/services/portfolio/types'

export interface BusinessOpportunityMatchingModalProps {
  open: boolean
  onClose?: () => void
  onOpenChange?: (open: boolean) => void
  signalType: 'signal' | 'company_opportunity' | 'opportunity' | 'ingestion_finding' | 'ingestion_signal'
  signalId: number
  signalTitle: string
  signalDescription?: string
  context?: LaravelContext
}

export function BusinessOpportunityMatchingModal({
  open,
  onClose,
  onOpenChange,
  signalType,
  signalId,
  signalTitle,
  signalDescription,
  context,
}: BusinessOpportunityMatchingModalProps) {
  const { user } = useAuth()
  const ctx = context ?? getLaravelContext(user)

  const handleClose = useCallback(() => {
    onOpenChange?.(false)
    onClose?.()
  }, [onOpenChange, onClose])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<SignalMatchingResponse | null>(null)
  const [selectedOfferIndex, setSelectedOfferIndex] = useState(0)
  const [actionBusy, setActionBusy] = useState(false)
  const [followUpNotes, setFollowUpNotes] = useState('')
  const [showNotesInput, setShowNotesInput] = useState(false)

  const loadMatches = useCallback(async () => {
    if (!open || !signalId) return
    setLoading(true)
    setError(null)
    try {
      let res
      if (signalType === 'signal') {
        res = await portfolioService.getSignalMatches(ctx, signalId)
      } else if (signalType === 'opportunity' || signalType === 'company_opportunity') {
        res = await portfolioService.getOpportunityMatches(ctx, signalId)
      } else {
        res = await portfolioService.getFindingMatches(ctx, signalId)
      }
      setData(res.data)
      setSelectedOfferIndex(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to match offers and partners')
    } finally {
      setLoading(false)
    }
  }, [open, signalType, signalId, ctx])

  useEffect(() => {
    if (open) {
      void loadMatches()
    }
  }, [open, loadMatches])

  const handleAction = async (action: 'review' | 'follow-up' | 'dismiss') => {
    const activeMatch = data?.offer_matches[selectedOfferIndex]
    if (!activeMatch) return

    setActionBusy(true)
    try {
      await portfolioService.actOnMatch(ctx, {
        signal_type: signalType,
        signal_id: signalId,
        offer_id: activeMatch.offer.offer_id,
        partner_id: activeMatch.partner_evaluations[0]?.partner.partner_id ?? null,
        action,
        review_notes: followUpNotes || undefined,
      })

      // Update local state
      setData((prev) => {
        if (!prev) return prev
        const updated = [...prev.offer_matches]
        const actionLabel = action === 'review' ? 'Reviewed' : action === 'follow-up' ? 'Follow-up' : 'Dismissed'
        updated[selectedOfferIndex] = {
          ...updated[selectedOfferIndex],
          match_status: actionLabel,
          review_notes: followUpNotes || null,
        }
        return { ...prev, offer_matches: updated }
      })
      setShowNotesInput(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionBusy(false)
    }
  }

  const currentMatch: OfferMatchResult | undefined = data?.offer_matches[selectedOfferIndex]

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="navy" className="flex items-center gap-1">
              <Sparkles className="size-3" /> Business Opportunity Intelligence
            </Badge>
            <span className="text-xs text-muted-foreground uppercase font-mono tracking-wider">
              {signalType.replace(/_/g, ' ')} #{signalId}
            </span>
          </div>
          <DialogTitle className="text-lg leading-snug">
            {signalTitle}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Signal evidence → Identified Need → Matching Offers → Eligible Partners → Review & Follow-up
          </DialogDescription>
        </DialogHeader>

        {signalDescription && (
          <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/60">
            {signalDescription}
          </div>
        )}

        {loading ? (
          <div className="space-y-4 py-6">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : error ? (
          <ErrorState title="Matching Engine Error" description={error} retry={() => { void loadMatches() }} />
        ) : !data || data.offer_matches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground space-y-2">
            <Package className="size-8 mx-auto opacity-40 text-muted-foreground" />
            <p className="font-semibold text-foreground">No matching product offers found</p>
            <p className="text-xs max-w-md mx-auto">
              The signal evidence did not match any of the 25 portfolio offers on needs or trigger signals.
            </p>
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {/* 1. Evidence & Identified Needs Bar */}
            <section className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" /> Step 1: Extracted Signal Evidence
              </h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-muted/50 p-2.5 rounded-lg border border-border/60">
                  <div className="text-[11px] font-medium text-muted-foreground uppercase">Identified Needs</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {data.evidence.identified_needs.length > 0 ? (
                      data.evidence.identified_needs.map((n) => (
                        <Badge key={n} variant="default" className="text-xs">
                          {n}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">General fit</span>
                    )}
                  </div>
                </div>

                <div className="bg-muted/50 p-2.5 rounded-lg border border-border/60">
                  <div className="text-[11px] font-medium text-muted-foreground uppercase">Target Segments</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {data.evidence.target_segments.length > 0 ? (
                      data.evidence.target_segments.map((s) => (
                        <Badge key={s} variant="outline" className="text-xs">
                          {s}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">Cross-segment</span>
                    )}
                  </div>
                </div>

                <div className="bg-muted/50 p-2.5 rounded-lg border border-border/60">
                  <div className="text-[11px] font-medium text-muted-foreground uppercase">Trigger Signals</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {data.evidence.trigger_signals.length > 0 ? (
                      data.evidence.trigger_signals.map((ts) => (
                        <Badge key={ts} variant="outline" className="text-xs">
                          {ts}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">Standard lead</span>
                    )}
                  </div>
                </div>

                <div className="bg-muted/50 p-2.5 rounded-lg border border-border/60">
                  <div className="text-[11px] font-medium text-muted-foreground uppercase">Geography</div>
                  <div className="mt-1 text-xs font-medium text-foreground">
                    {data.evidence.geography || 'All India'}
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Step 2: Matching Offers Carousel / Tabs */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Package className="size-3.5 text-primary" /> Step 2: Matching Portfolio Offers ({data.offer_matches.length})
                </h4>
                <span className="text-xs text-muted-foreground">
                  Select an offer to inspect eligible partner network
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.offer_matches.map((m, index) => {
                  const isSelected = index === selectedOfferIndex
                  return (
                    <button
                      key={m.offer.offer_id}
                      type="button"
                      onClick={() => {
                        setSelectedOfferIndex(index)
                        setShowNotesInput(false)
                      }}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm'
                          : 'border-border bg-card hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                          {m.offer.offer_id}
                        </span>
                        <Badge
                          variant={m.match_score >= 80 ? 'success' : m.match_score >= 50 ? 'warning' : 'outline'}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {m.match_score}% fit
                        </Badge>
                      </div>
                      <div className="font-semibold text-xs text-foreground line-clamp-1">
                        {m.offer.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                        {m.offer.parent_product} · {m.offer.deployment_model || 'SaaS'}
                      </div>
                      <div className="mt-1">
                        <ReadinessBadge offer={{ is_deliverable: Boolean(m.offer.readiness_confirmed), readiness_status: m.offer.readiness_status }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="text-xs font-medium text-primary flex items-center gap-0.5">
                          {m.partner_evaluations.filter((p) => p.eligibility_status === 'eligible').length} eligible partners
                        </span>
                        {m.match_status && m.match_status !== 'Matched' && (
                          <Badge variant={m.match_status === 'Reviewed' ? 'success' : m.match_status === 'Follow-up' ? 'warning' : 'outline'} className="text-[10px]">
                            {m.match_status}
                          </Badge>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* 3. Detailed Selected Offer & Partner Eligibility */}
            {currentMatch && (
              <section className="rounded-xl border border-border bg-card p-5 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary">
                        {currentMatch.offer.offer_id}
                      </span>
                      <h3 className="text-base font-bold text-foreground">
                        {currentMatch.offer.name}
                      </h3>
                      {currentMatch.offer.partner_sellable ? (
                        <Badge variant="success" className="text-[10px]">
                          Partner Sellable
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          {currentMatch.offer.readiness_status}
                        </Badge>
                      )}
                      <ReadinessBadge offer={{ is_deliverable: Boolean(currentMatch.offer.readiness_confirmed), readiness_status: currentMatch.offer.readiness_status }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
                      {currentMatch.offer.what_it_does}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-extrabold text-foreground">
                      {currentMatch.match_score}<span className="text-sm font-normal text-muted-foreground">/100</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground uppercase font-medium tracking-wide">
                      Match Confidence
                    </div>
                  </div>
                </div>

                {/* Explainable Matching Reasons */}
                <div className="space-y-2 bg-muted/30 p-3.5 rounded-lg border border-border/60">
                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Explainable Match Rationale
                  </h5>
                  <ul className="space-y-1.5 text-xs text-foreground">
                    {currentMatch.match_reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 className="size-3.5 text-emerald-600 mt-0.5 shrink-0" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Step 3: Partner Network Eligibility */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Users className="size-3.5 text-primary" /> Step 3: Partner Eligibility Evaluation ({currentMatch.partner_evaluations.length})
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      Evaluated against 7 strict workbook eligibility rules
                    </span>
                  </div>

                  {currentMatch.partner_evaluations.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground rounded-lg border border-dashed border-border">
                      No partners currently onboarded in the Partner Network. Add active partners via the Partner Network view.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {currentMatch.partner_evaluations.map((pe) => {
                        const statusBadge =
                          pe.eligibility_status === 'eligible' ? (
                            <Badge variant="success" className="gap-1">
                              <ShieldCheck className="size-3" /> Eligible Partner
                            </Badge>
                          ) : pe.eligibility_status === 'needs_review' ? (
                            <Badge variant="warning" className="gap-1">
                              <AlertCircle className="size-3" /> Needs Review
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <ShieldAlert className="size-3" /> Ineligible
                            </Badge>
                          )

                        return (
                          <div
                            key={pe.partner.partner_id}
                            className="p-4 rounded-xl border border-border bg-card/60 space-y-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <span className="font-mono text-[10px] text-muted-foreground mr-1.5">
                                  {pe.partner.partner_id}
                                </span>
                                <span className="font-semibold text-sm text-foreground">
                                  {pe.partner.partner_name}
                                </span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({pe.partner.partner_type})
                                </span>
                              </div>
                              {statusBadge}
                            </div>

                            {/* 7 Rule Breakdown Badges / Indicators */}
                            <div className="grid gap-1.5 text-xs sm:grid-cols-2 md:grid-cols-3 pt-1">
                              {Object.entries(pe.rule_evaluations).map(([k, r]) => (
                                <div
                                  key={k}
                                  className={`flex items-start gap-1.5 p-2 rounded-md border text-[11px] ${
                                    r.passed
                                      ? 'border-emerald-500/20 bg-emerald-500/5 text-foreground'
                                      : 'border-destructive/20 bg-destructive/5 text-muted-foreground'
                                  }`}
                                >
                                  {r.passed ? (
                                    <CheckCircle2 className="size-3 text-emerald-600 shrink-0 mt-0.5" />
                                  ) : (
                                    <XCircle className="size-3 text-destructive shrink-0 mt-0.5" />
                                  )}
                                  <div>
                                    <div className="font-semibold capitalize">
                                      {k.replace('_', ' ')}
                                    </div>
                                    <div className="text-[10px] opacity-80">{r.detail}</div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-1 border-t border-border/40">
                              <span>
                                Available capacity: <strong>{pe.partner.capacity_available ?? 0} slots</strong> · Active deals: {pe.partner.active_deals_now ?? 0}
                              </span>
                              {pe.partner.contact_email && (
                                <span>Contact: {pe.partner.sales_contact_name} ({pe.partner.contact_email})</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Step 4: Human Review & Follow-up Actions */}
                <div className="border-t border-border/80 pt-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Step 4: Human Review &amp; Follow-up Decision
                      </h4>
                      {currentMatch.match_status && currentMatch.match_status !== 'Matched' && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Status: <strong className="text-foreground">{currentMatch.match_status}</strong>
                          {currentMatch.review_notes && ` — "${currentMatch.review_notes}"`}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionBusy || currentMatch.match_status === 'Dismissed'}
                        onClick={() => handleAction('dismiss')}
                      >
                        <XCircle className="size-3.5 mr-1" /> Dismiss
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionBusy || currentMatch.match_status === 'Reviewed'}
                        onClick={() => handleAction('review')}
                      >
                        <CheckCircle2 className="size-3.5 mr-1" /> Mark Reviewed
                      </Button>

                      <Button
                        size="sm"
                        disabled={actionBusy}
                        onClick={() => setShowNotesInput(!showNotesInput)}
                      >
                        <BookmarkPlus className="size-3.5 mr-1" />
                        {showNotesInput ? 'Hide Follow-up' : 'Add to Follow-up'}
                      </Button>
                    </div>
                  </div>

                  {showNotesInput && (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                      <label className="text-xs font-medium text-foreground">
                        Follow-up action notes &amp; next steps:
                      </label>
                      <Input
                        value={followUpNotes}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFollowUpNotes(e.target.value)}
                        placeholder="e.g. Discuss with Gujarat partner on Wednesday for GeM bid submission"
                        className="text-xs"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAction('follow-up')}
                          disabled={actionBusy}
                        >
                          Save Follow-up
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        <div className="flex justify-end border-t border-border pt-3">
          <Button variant="outline" size="sm" onClick={handleClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default BusinessOpportunityMatchingModal

