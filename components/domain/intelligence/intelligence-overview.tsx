'use client'

import { AlertTriangle, RefreshCw, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useIntelligence } from '@/hooks/use-intelligence'
import { CLASS_LABEL } from './intelligence-shared'
import { InsightCard } from './insight-card'
import { ReadinessChecks } from './readiness-checks'

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

function LoadingState() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading Intelligence">
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-72" />
      <Skeleton className="h-72" />
    </div>
  )
}

/**
 * THE INTELLIGENCE PAGE.
 *
 * Reads one read-only endpoint and shows what needs attention, with the evidence, the reasoning, a recommended action
 * and the expected impact kept visibly separate. It computes nothing itself: if a number is on this screen it came
 * from the organisation's records via the server.
 */
export function IntelligenceOverview() {
  const { overview, emptyReason, isLoading, isRefreshing, error, denied, refetch } = useIntelligence()

  if (isLoading) return <LoadingState />

  if (error) {
    return (
      <ErrorState
        title={denied ? 'Intelligence is for HR and administrators' : 'Intelligence could not be loaded'}
        description={
          denied
            ? 'Your profile does not have permission to view organisation-wide findings. Your own capability and tasks are on your Home page.'
            : (error.message ?? 'Please try again.')
        }
        retry={denied ? undefined : () => void refetch()}
      />
    )
  }

  if (!overview) return null

  const { summary, insights, readiness, unavailable_sources: unavailable, limits } = overview
  const asOf = new Date(overview.generated_at)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-semibold text-foreground">Intelligence</h1>
            <Badge variant="navy">New</Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            What needs attention across your organisation, why it matters, the records behind it, and what to do next.
            Everything here is calculated from your own records when you open the page; nothing is estimated or stored.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">As of {asOf.toLocaleString()}</span>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isRefreshing}>
            <RefreshCw className={isRefreshing ? 'size-3.5 animate-spin' : 'size-3.5'} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Summary">
        <Tile label="Findings" value={String(summary.insight_count)} hint="Things that need attention now" />
        <Tile label="High priority" value={String(summary.high)} hint="Expired credentials or mandatory gaps" />
        <Tile
          label="Data checks needing attention"
          value={String(summary.measures_needing_attention)}
          hint={`of ${readiness.length} checks on the records behind the findings`}
        />
      </section>

      {unavailable.length > 0 && (
        <div role="alert" className="flex gap-3 rounded-md border border-warning/30 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <p className="text-foreground">
            Some information could not be read right now ({unavailable.join(', ')}). Findings for those areas are missing
            from this page, so their absence does not mean there is nothing to report.
          </p>
        </div>
      )}

      <section className="space-y-4" aria-label="Findings">
        <h2 className="text-lg font-semibold text-foreground">Findings</h2>
        {insights.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              {emptyReason ?? 'No findings were produced from the records that can be measured.'}
            </CardContent>
          </Card>
        ) : (
          insights.map((insight) => <InsightCard key={insight.key} insight={insight} />)
        )}
      </section>

      <ReadinessChecks measures={readiness} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to read this page</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="space-y-1">
            {Object.values(CLASS_LABEL).map((c) => (
              <li key={c.label}>
                <span className="font-medium text-foreground">{c.label}:</span> {c.hint}
              </li>
            ))}
          </ul>
          <ul className="list-disc space-y-1 pl-5">
            {limits.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
