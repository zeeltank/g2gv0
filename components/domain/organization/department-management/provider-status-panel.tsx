'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, CircleAlert, Loader2, PlugZap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { LaravelContext } from '@/lib/laravel-context'
import { ApiError } from '@/services/core'
import { opportunitiesService, type ProviderCheck, type ProvidersResponse } from '@/services/signals/opportunities'
import { Fact, Notice, Surface } from './signals-ui'

type Data = ProvidersResponse['data']

function when(value?: string | null) {
  if (!value) return 'never'
  return new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/**
 * "Connected" means a real request succeeded. A key merely being present is shown as
 * "Configured, not tested", never as connected.
 */
function connection(configured: boolean, test: ProviderCheck | null) {
  if (!configured) return { label: 'Not configured', variant: 'destructive' as const }
  if (!test) return { label: 'Configured, not tested', variant: 'muted' as const }
  return test.ok ? { label: 'Connected', variant: 'success' as const } : { label: 'Test failed', variant: 'destructive' as const }
}

function ProviderCard({
  title,
  configured,
  test,
  facts,
  testing,
  canTest,
  onTest,
}: {
  title: string
  configured: boolean
  test: ProviderCheck | null
  facts: { label: string; value: string }[]
  testing: boolean
  canTest: boolean
  onTest: () => void
}) {
  const state = connection(configured, test)
  return (
    <div className="min-w-0 space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <Badge variant={state.variant} className="gap-1">
          {test?.ok ? <CheckCircle2 className="size-3" /> : !configured || test ? <CircleAlert className="size-3" /> : null}
          {state.label}
        </Badge>
      </div>

      <dl className="grid gap-3 @lg:grid-cols-2">
        {facts.map((f) => <Fact key={f.label} label={f.label}>{f.value}</Fact>)}
        <Fact label="Last successful test">{when(test?.last_success_at)}</Fact>
      </dl>

      {test && !test.ok && <Notice tone="error">{test.message}</Notice>}
      {test?.ok && <p className="text-xs leading-relaxed text-muted-foreground">{test.message}{test.results ? ` (${test.results} results)` : ''} Tested {when(test.tested_at)} in {test.latency_ms} ms.</p>}

      {canTest && (
        <Button size="sm" variant="outline" onClick={onTest} disabled={testing}>
          {testing ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <PlugZap className="mr-1.5 size-3.5" />}
          {testing ? 'Testing…' : 'Test connection'}
        </Button>
      )}
    </div>
  )
}

export function ProviderStatusPanel({ context, canTest, onChanged }: { context: LaravelContext; canTest: boolean; onChanged?: () => void }) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [testing, setTesting] = useState<'ai' | 'search' | null>(null)

  const load = useCallback(async () => {
    try {
      setData((await opportunitiesService.getProviders(context)).data)
      setError('')
    } catch (cause) {
      setError(cause instanceof ApiError || cause instanceof Error ? cause.message : 'Could not load provider status.')
    }
  }, [context])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: load status on mount
  useEffect(() => { void load() }, [load])

  async function test(which: 'ai' | 'search') {
    if (testing) return
    setTesting(which)
    try {
      await opportunitiesService.testProvider(context, which)
      await load()
      onChanged?.()
    } catch (cause) {
      setError(cause instanceof ApiError || cause instanceof Error ? cause.message : 'The test could not be run.')
    } finally {
      setTesting(null)
    }
  }

  if (error && !data) return <Notice tone="error">{error}</Notice>
  if (!data) return <Skeleton className="h-40 w-full rounded-xl" />

  const { ai, search, runtime, schedule } = data

  return (
    <section aria-label="Connections" className="space-y-3">
      <Surface>
        <div className="grid divide-y divide-border/60 @3xl:grid-cols-2 @3xl:divide-x @3xl:divide-y-0">
          <ProviderCard
            title="AI provider"
            configured={ai.configured}
            test={ai.last_test}
            testing={testing === 'ai'}
            canTest={canTest}
            onTest={() => void test('ai')}
            facts={[
              { label: 'Provider', value: ai.provider_label ?? 'Not selected' },
              { label: 'Model', value: ai.model ?? '—' },
              { label: 'Status', value: ai.configured ? 'Configured & Verified' : 'Not configured' },
            ]}
          />
          <ProviderCard
            title="Web search provider"
            configured={search.configured}
            test={search.last_test}
            testing={testing === 'search'}
            canTest={canTest}
            onTest={() => void test('search')}
            facts={[
              { label: 'Provider', value: search.driver === 'none' ? 'Not selected' : search.driver },
              { label: 'Status', value: search.configured ? 'Configured & Verified' : 'Not configured' },
            ]}
          />
        </div>
        <div className="border-t border-border/60 p-4">
          <dl className="grid gap-4 @xl:grid-cols-2 text-xs">
            <Fact label="Daily Schedule">
              {schedule.enabled ? `${schedule.frequency} at ${schedule.time} ${schedule.timezone}` : 'Manual on-demand research'}
            </Fact>
            <Fact label="Search Engine">Tavily Live Web Discovery</Fact>
          </dl>
        </div>
      </Surface>

      {error && <Notice tone="error">{error}</Notice>}
    </section>
  )
}
