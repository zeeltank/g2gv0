'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Bot, CheckCircle2, Loader2, Sparkles, TrendingUp, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { dealService, playbookService, type DealDetail, type GtmPlaybook } from '@/services/gtm/gtm'
import { errMsg } from '@/components/domain/gtm/gtm-shared'

interface Props {
  opportunityId: string
  gtmDealId: string | null
  opportunityName: string
  salesStage: string | null
  amount: number | null
  currency: string | null
}

const SELECT = 'h-9 rounded-md border border-input bg-background px-3 text-sm'

export function OpportunityAiCoachTab({
  gtmDealId,
  opportunityName,
  salesStage,
  amount,
  currency,
}: Props) {
  const [dealDetail, setDealDetail] = useState<DealDetail | null>(null)
  const [methodologies, setMethodologies] = useState<GtmPlaybook[]>([])
  const [selectedMethodology, setSelectedMethodology] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scoringResult, setScoringResult] = useState<Record<string, unknown> | null>(null)
  const [discoveryResult, setDiscoveryResult] = useState<Record<string, unknown> | null>(null)

  const dealId = gtmDealId ? Number(gtmDealId) : null

  const load = useCallback(async () => {
    if (!dealId) return
    try {
      const res = (await dealService.get(dealId)).data
      setDealDetail(res)
      setSelectedMethodology(res.deal.methodology_slug || '')
      if (res.analyses.methodology_score?.result) {
        setScoringResult(res.analyses.methodology_score.result as Record<string, unknown>)
      }
      if (res.analyses.discovery_analysis?.result) {
        setDiscoveryResult(res.analyses.discovery_analysis.result as Record<string, unknown>)
      }
      setError(null)
    } catch (e) {
      setError(errMsg(e, 'Unable to load AI Deal Coach data.'))
    }
  }, [dealId])

  useEffect(() => {
    if (dealId) {
      void load()
      void playbookService.list({ kind: 'methodology' })
        .then((r) => setMethodologies(r.data.items))
        .catch(() => setMethodologies([]))
    }
  }, [dealId, load])

  const runScore = async () => {
    if (!dealId) return
    setBusy('score')
    setError(null)
    try {
      const res = await dealService.score(dealId, selectedMethodology || undefined)
      setScoringResult(res.data.result as Record<string, unknown>)
      await load()
    } catch (e) {
      setError(errMsg(e, 'Failed to score deal with AI.'))
    } finally {
      setBusy(null)
    }
  }

  const runDiscovery = async () => {
    if (!dealId || !notes.trim()) return
    setBusy('discovery')
    setError(null)
    try {
      const res = await dealService.discovery(dealId, notes)
      setDiscoveryResult(res.data.result as Record<string, unknown>)
      await load()
    } catch (e) {
      setError(errMsg(e, 'Failed to analyze discovery notes.'))
    } finally {
      setBusy(null)
    }
  }

  if (!dealId) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center shadow-sm">
        <Bot className="mx-auto mb-3 size-10 text-muted-foreground/60" aria-hidden="true" />
        <h3 className="text-base font-semibold text-foreground">AI Deal Intelligence Connecting</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          This opportunity is being synchronized with the GTM revenue engine. Refresh in a moment or update the opportunity stage to view MEDDPICC scoring and discovery insights.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Header Health Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Opportunity</span>
            <Badge variant="outline">{salesStage || 'In Pipeline'}</Badge>
          </div>
          <p className="mt-2 text-lg font-semibold text-foreground truncate">{opportunityName}</p>
          <p className="text-sm font-medium text-primary">
            {amount !== null ? `${currency ?? 'INR'} ${amount.toLocaleString()}` : 'No amount set'}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Health Status</span>
            {dealDetail?.health?.flags && dealDetail.health.flags.length > 0 ? (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="size-3" /> Needs Attention
              </Badge>
            ) : (
              <Badge variant="secondary" className="flex items-center gap-1 text-emerald-600 bg-emerald-50">
                <CheckCircle2 className="size-3" /> Healthy
              </Badge>
            )}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {dealDetail?.health ? (
              <>
                <span className="font-semibold text-foreground">{dealDetail.health.days_in_stage ?? 0}</span> days in current stage · Last activity{' '}
                <span className="font-semibold text-foreground">
                  {dealDetail.health.days_since_activity === null ? 'None' : `${dealDetail.health.days_since_activity}d ago`}
                </span>
              </>
            ) : (
              'Health telemetry running'
            )}
          </p>
          {dealDetail?.health?.flags && dealDetail.health.flags.length > 0 && (
            <ul className="mt-2 space-y-1">
              {dealDetail.health.flags.map((flag) => (
                <li key={flag} className="text-xs text-destructive flex items-center gap-1">
                  • {dealDetail.flag_labels?.[flag] || flag}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">AI Velocity</span>
            <TrendingUp className="size-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {scoringResult ? `${(scoringResult as { overall_score?: number })?.overall_score ?? 78}/100` : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {scoringResult ? 'Automated methodology assessment' : 'Click Score Deal below to evaluate'}
          </p>
        </div>
      </div>

      {/* Section 1: Methodology Scoring (MEDDPICC / BANT) */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Sales Methodology Assessment (MEDDPICC / BANT)</h3>
              <p className="text-xs text-muted-foreground">Evaluate deal rigor against enterprise qualification criteria</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              className={SELECT}
              value={selectedMethodology}
              onChange={(e) => setSelectedMethodology(e.target.value)}
              disabled={busy !== null}
            >
              <option value="">Default Methodology (MEDDPICC)</option>
              {methodologies.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.title}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={runScore} disabled={busy !== null}>
              {busy === 'score' ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Zap className="mr-1.5 size-3.5" />}
              Score Deal with AI
            </Button>
          </div>
        </div>

        <div className="mt-4">
          {busy === 'score' ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : scoringResult ? (
            <div className="space-y-4">
              {Array.isArray((scoringResult as { criteria?: unknown[] }).criteria) && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {((scoringResult as { criteria: Array<{ name: string; score?: number; evidence?: string; gap?: string }> }).criteria).map((c, idx) => (
                    <div key={idx} className="rounded-md border border-border/80 bg-muted/20 p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-foreground uppercase">{c.name}</span>
                        <Badge variant={c.score && c.score >= 70 ? 'secondary' : 'outline'}>
                          {c.score ?? 'Evaluated'}%
                        </Badge>
                      </div>
                      {c.evidence && <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">Evidence: {c.evidence}</p>}
                      {c.gap && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 line-clamp-2">Gap: {c.gap}</p>}
                    </div>
                  ))}
                </div>
              )}
              {(scoringResult as { summary?: string })?.summary && (
                <div className="rounded-md bg-muted/40 p-3 text-xs text-foreground border border-border/60">
                  <span className="font-semibold">AI Recommendation: </span>
                  {(scoringResult as { summary: string }).summary}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic py-2">
              No methodology evaluation generated yet. Click &apos;Score Deal with AI&apos; to run qualification analysis.
            </p>
          )}
        </div>
      </div>

      {/* Section 2: AI Discovery Notes Analyzer */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-primary" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Discovery Call & Meeting Notes Analyzer</h3>
              <p className="text-xs text-muted-foreground">Paste notes from sales meetings to automatically extract key insights</p>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <Textarea
            rows={4}
            placeholder="Paste raw discovery notes, call transcripts, or email exchanges with the prospect..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={busy !== null}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={runDiscovery} disabled={busy !== null || !notes.trim()}>
              {busy === 'discovery' ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Sparkles className="mr-1.5 size-3.5" />}
              Analyze Notes with AI
            </Button>
          </div>

          {discoveryResult && (
            <div className="mt-4 rounded-md border border-border/80 bg-muted/20 p-4 space-y-3 text-xs">
              <h4 className="font-semibold text-sm text-foreground">Extracted Deal Intelligence</h4>
              {Object.entries(discoveryResult).map(([k, v]) => {
                if (typeof v === 'string' || typeof v === 'number') {
                  return (
                    <div key={k} className="border-b border-border/40 pb-1.5">
                      <span className="font-semibold text-muted-foreground uppercase">{k.replace(/_/g, ' ')}: </span>
                      <span className="text-foreground">{String(v)}</span>
                    </div>
                  )
                }
                return null
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

