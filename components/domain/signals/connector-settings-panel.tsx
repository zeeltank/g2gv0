'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, KeyRound, Loader2, RefreshCw, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { LaravelContext } from '@/lib/laravel-context'
import { apiErrorText } from '@/lib/api-messages'
import {
  cardStatus,
  overallStatus,
  providerCards,
  updatedLabel,
  type ProviderCard,
  type ProviderSettings,
} from '@/lib/signals/connector-settings'
import { opportunitiesService } from '@/services/signals/opportunities'
import { ConnectorSettingsDialog } from './connector-settings-dialog'
import { ProviderIcon, StatusChip } from './connector-settings-parts'

/**
 * Connector Settings (administrators only; the caller decides who sees it). One compact card per provider with its real status and two actions:
 * Configure (opens the credential form) and Connect Account (the existing connect flow). Credentials are never shown here, only whether they exist.
 */
export function ConnectorSettingsPanel({
  context,
  onConnectAccount,
  onSettingsChanged,
}: {
  context: LaravelContext
  /** Starts the existing connect flow for a platform. */
  onConnectAccount: (type: ProviderCard['connectorType']) => void
  /** Told after credentials were saved or removed, so the connector list re-reads each provider's readiness. */
  onSettingsChanged?: () => void
}) {
  const [providers, setProviders] = useState<ProviderSettings[] | null>(null)
  const [storageReady, setStorageReady] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ProviderCard | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await opportunitiesService.getConnectorSettings(context)
      setProviders(res.data.providers)
      setStorageReady(res.data.storage_ready)
      setError(null)
    } catch (cause) {
      setError(apiErrorText(cause, 'Could not load connector settings.'))
    } finally {
      setLoading(false)
    }
  }, [context])

  useEffect(() => {
    Promise.resolve().then(() => { void load() })
  }, [load])

  const cards = providerCards(providers ?? [])
  const overall = overallStatus(cards)

  const changed = (settings: ProviderSettings) => {
    setProviders((current) => (current ?? []).map((p) => (p.provider === settings.provider ? settings : p)))
    // keep the open form on the fresh values
    setEditing((open) => (open ? { ...open, settings: open.provider === settings.provider ? settings : open.settings } : open))
    onSettingsChanged?.()
  }

  return (
    <section aria-label="Connector Settings" className="space-y-4 rounded-2xl border border-border/80 bg-card p-4 shadow-xs sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-primary">
            <KeyRound className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground">Connector Settings</h3>
            <p className="text-xs text-muted-foreground">Configure provider credentials and manage connection readiness.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {cards.length > 0 && <StatusChip tone={overall.tone}>{overall.label}</StatusChip>}
          <Button type="button" variant="ghost" size="icon" aria-label="Reload settings" onClick={() => void load()} disabled={loading} className="size-8">
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          </Button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => void load()} className="font-semibold underline">Retry</button>
        </div>
      )}

      {!storageReady && !error && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>Saving credentials in G2G is not available yet: the server&apos;s database update for it has not been applied. Ask your server administrator.</span>
        </div>
      )}

      {loading && providers === null ? (
        <div className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Loading providers">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl border border-border/60 bg-muted/30" />)}
        </div>
      ) : cards.length === 0 && !error ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">No providers are available.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {cards.map((card) => {
            const status = cardStatus(card.settings)
            const connectable = card.settings.status === 'authorization_required' || card.settings.status === 'connected'
            const updated = updatedLabel(card.settings.updated_at)
            return (
              <li key={card.key} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background p-3.5 transition-shadow hover:shadow-sm">
                <div className="flex items-start gap-3">
                  <ProviderIcon card={card} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <h4 className="text-sm font-semibold text-foreground">{card.title}</h4>
                      <StatusChip tone={status.tone}>{status.label}</StatusChip>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{card.summary}</p>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {status.hint}
                  {card.settings.source === 'environment' && ' Credentials come from the server.'}
                  {updated && ` ${updated}.`}
                </p>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditing(card)} className="h-8 gap-1.5 text-xs">
                    <Settings2 className="size-3.5" aria-hidden />
                    {card.settings.status === 'not_configured' ? 'Configure' : 'Edit'}
                  </Button>
                  {connectable && (
                    <Button type="button" size="sm" onClick={() => onConnectAccount(card.connectorType)} className="h-8 text-xs font-semibold">
                      Connect Account
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ConnectorSettingsDialog
        context={context}
        card={editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onChanged={changed}
        onConnect={onConnectAccount}
      />
    </section>
  )
}
