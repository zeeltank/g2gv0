'use client'

/**
 * Administration > Integrations.
 *
 * Shows the integrations this backend actually has (n8n task webhook, Gemini
 * generation, FCM push) and whether each is configured - read live from the
 * server, which never exposes the keys themselves. Previously a hardcoded
 * card grid of products that were never integrated (Slack, Jira, GitHub) with
 * Connect buttons wired to nothing.
 *
 * Configuration happens in .env on purpose: these are server credentials, and
 * editing them from a browser form would put secrets in the request log.
 */

import { useEffect, useState } from 'react'
import { CheckCircle2, CircleOff, Link2, Webhook } from 'lucide-react'

import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { taskService } from '@/services/task'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import type { IntegrationStatus } from '@/types/task-management'

export function TmIntegrations() {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(async () => {
      const context = getLaravelContext()
      if (!isLaravelContextReady(context)) {
        if (active) { setError('Your ERP session is unavailable. Please sign in again.'); setLoading(false) }
        return
      }
      try {
        const response = await taskService.getIntegrations(context)
        if (active) setIntegrations(response.data.integrations)
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load integration status.')
      } finally {
        if (active) setLoading(false)
      }
    })
    return () => { active = false }
  }, [])

  return (
    <div className="g2g-scrollbar flex h-full flex-col gap-8 overflow-y-auto p-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-2.5 text-primary shadow-sm">
            <Link2 className="h-6 w-6" />
          </div>
          Integrations & Webhooks
        </h1>
        <p className="text-sm text-muted-foreground">
          Configured server-side via environment variables. Keys are never shown here.
        </p>
      </div>

      {error && <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</div>}
      {loading && <div className="flex h-40 items-center justify-center"><Spinner /></div>}

      {!loading && !error && (
        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {integrations.map((integration) => (
            <div
              key={integration.key}
              className="group flex flex-col overflow-hidden rounded-[24px] border border-primary/10 bg-card/90 shadow-xl backdrop-blur-2xl transition-all duration-500 hover:-translate-y-1 hover:border-primary/30 hover:shadow-2xl"
            >
              <div className="flex flex-1 flex-col p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
                    <Webhook className="h-6 w-6" />
                  </div>
                  <span
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-bold',
                      integration.configured
                        ? 'border-primary/20 bg-primary/10 text-primary'
                        : 'border-border bg-muted/40 text-muted-foreground',
                    )}
                  >
                    {integration.configured
                      ? <><CheckCircle2 className="h-3.5 w-3.5" /> Configured</>
                      : <><CircleOff className="h-3.5 w-3.5" /> Not configured</>}
                  </span>
                </div>
                <h3 className="mb-2 text-xl font-bold text-foreground">{integration.name}</h3>
                <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{integration.description}</p>
              </div>

              <div className="border-t border-primary/10 bg-background/50 p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  {integration.configured ? 'Managed via ' : 'Enable by setting '}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{integration.env}</code>
                  {' '}in the server environment.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
