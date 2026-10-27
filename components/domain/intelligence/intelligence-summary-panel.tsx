'use client'

import { ArrowRight, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useIntelligence } from '@/hooks/use-intelligence'
import { SeverityBadge } from './intelligence-shared'

const SHOWN = 3

/**
 * A SEPARATE PANEL, rendered beside the existing Home dashboard and never inside it.
 *
 * It shows the top findings and a link to the full Intelligence page. It is additive: the dashboard's own content,
 * including its "AI Insights" card, is untouched. It renders nothing for a profile that is not allowed to see
 * organisation-wide findings (403), so it can never add an error to someone else's home screen.
 */
export function IntelligenceSummaryPanel() {
  const router = useRouter()
  const { overview, isLoading, error, denied } = useIntelligence()

  if (denied) return null

  return (
    <Card className="mb-6 border-primary/20" data-testid="intelligence-summary-panel">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          <CardTitle className="text-base">Intelligence</CardTitle>
          <Badge variant="navy">New</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push('/intelligence')}>
          Open Intelligence
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-16" />}

        {!isLoading && error && (
          <p className="text-sm text-muted-foreground">Intelligence could not be loaded right now. Open the page to retry.</p>
        )}

        {!isLoading && !error && overview && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {overview.summary.insight_count === 0
                ? 'No findings from the records that can be measured.'
                : `${overview.summary.insight_count} ${overview.summary.insight_count === 1 ? 'finding needs' : 'findings need'} attention` +
                  (overview.summary.high > 0 ? `, ${overview.summary.high} high priority.` : '.')}
              {overview.unavailable_sources.length > 0 && ' Some sources could not be read, so this is not an all-clear.'}
            </p>
            <ul className="divide-y divide-border">
              {overview.insights.slice(0, SHOWN).map((i) => (
                <li key={i.key} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                  <span className="text-sm text-foreground">{i.title}</span>
                  <SeverityBadge severity={i.severity} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
