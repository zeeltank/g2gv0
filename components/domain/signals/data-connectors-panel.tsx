'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Clock3, Globe, Loader2, Plus, RefreshCw, Trash2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { LaravelContext } from '@/lib/laravel-context'
import { apiErrorText } from '@/lib/api-messages'
import { isDataConnectorMockModeEnabled } from '@/lib/signals/data-connectors-mock'
import {
  opportunitiesService,
  type DataConnectorInfo,
  type DataConnectorsResponse,
} from '@/services/signals/opportunities'

const connectorTypes: { value: DataConnectorInfo['type']; label: string }[] = [
  { value: 'public_web_page', label: 'Public website or article' },
  { value: 'youtube', label: 'YouTube channel' },
  { value: 'linkedin', label: 'LinkedIn organization' },
  { value: 'facebook_page', label: 'Facebook Page' },
  { value: 'instagram_business', label: 'Instagram professional account' },
]

const statusLabel: Record<DataConnectorInfo['connection_status'], string> = {
  connected: 'Connected',
  disconnected: 'Disconnected',
  error: 'Error',
  not_configured: 'Not Configured',
  permission_required: 'Permission Required',
  token_expired: 'Token Expired',
  rate_limited: 'Rate Limited',
}

const statusVariant: Record<DataConnectorInfo['connection_status'], 'success' | 'muted' | 'destructive' | 'warning'> = {
  connected: 'success',
  disconnected: 'muted',
  error: 'destructive',
  not_configured: 'warning',
  permission_required: 'warning',
  token_expired: 'warning',
  rate_limited: 'warning',
}

function dateLabel(value: string | null): string {
  if (!value) return 'Never'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function platformLabel(type: DataConnectorInfo['type']): string {
  return connectorTypes.find((connector) => connector.value === type)?.label ?? type
}

function regionsFromText(value: string): DataConnectorInfo['regions'] {
  return value.split(';').flatMap((selection) => {
    const [country, state, city] = selection.split('|').map((part) => part.trim())
    return country ? [{ country, state: state || null, city: city || null }] : []
  })
}

function regionText(regions: DataConnectorInfo['regions']): string {
  return (regions ?? []).map((region) => [region.country, region.state, region.city].filter(Boolean).join(' | ')).join('; ')
}

function sanitizeConnectorError(err: unknown, fallback: string): string {
  const raw = apiErrorText(err, fallback)
  if (
    /SQLSTATE/i.test(raw) ||
    /doesn't exist/i.test(raw) ||
    /no such table/i.test(raw) ||
    /Table '.*' doesn't exist/i.test(raw) ||
    /select \* from/i.test(raw)
  ) {
    return 'Data connector database tables are not yet migrated on the server. Please run "php artisan migrate" to activate this feature.'
  }
  return raw
}

export function DataConnectorsPanel({
  context,
  productKey,
  productReady,
}: {
  context: LaravelContext
  productKey: string | null
  productReady: boolean
}) {
  const [connectors, setConnectors] = useState<DataConnectorInfo[]>([])
  const [catalog, setCatalog] = useState<DataConnectorsResponse['available']>([])
  const [globalScheduleEnabled, setGlobalScheduleEnabled] = useState(true)
  const [tablesMigrated, setTablesMigrated] = useState(true)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [type, setType] = useState<DataConnectorInfo['type']>('public_web_page')
  const [accountId, setAccountId] = useState('')
  const [offerId, setOfferId] = useState('')
  const [customerModel, setCustomerModel] = useState<DataConnectorInfo['customer_model']>('b2b')
  const [region, setRegion] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [editAccountId, setEditAccountId] = useState('')
  const [editOfferId, setEditOfferId] = useState('')
  const [editCustomerModel, setEditCustomerModel] = useState<DataConnectorInfo['customer_model']>('b2b')
  const [editRegion, setEditRegion] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await opportunitiesService.listConnectors(context)
      setConnectors(response.data)
      setCatalog(response.available)
      setGlobalScheduleEnabled(response.global_schedule_enabled)
      setTablesMigrated(response.tables_migrated !== false)
      setError(null)
    } catch (err) {
      setTablesMigrated(false)
      setError(sanitizeConnectorError(err, 'Could not load data connectors'))
    } finally {
      setLoading(false)
    }
  }, [context])

  useEffect(() => {
    Promise.resolve().then(() => { void load() })
  }, [load])

  useEffect(() => {
    const pending = connectors.some((connector) =>
      connector.history.some((run) => run.status === 'running' || run.status === 'queued'),
    )
    if (!pending) return

    const timer = setInterval(() => { void load() }, 2500)
    return () => clearInterval(timer)
  }, [connectors, load])

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!productKey || !productReady || saving) return
    setSaving(true)
    setError(null)
    try {
      await opportunitiesService.createConnector(context, {
        type,
        name: name.trim(),
        ...(type === 'public_web_page' ? { url: url.trim() } : {}),
        ...(type === 'linkedin' ? { external_account_id: accountId.trim() } : {}),
        product_key: productKey,
        offer_id: offerId.trim() || null,
        customer_model: customerModel,
        regions: regionsFromText(region),
      })
      setName('')
      setUrl('')
      setAccountId('')
      setOfferId('')
      setCustomerModel('b2b')
      setRegion('')
      await load()
    } catch (err) {
      setError(sanitizeConnectorError(err, 'Could not configure this connector'))
    } finally {
      setSaving(false)
    }
  }

  const authorize = async (connector: DataConnectorInfo) => {
    setBusyId(connector.id)
    setError(null)
    try {
      const response = await opportunitiesService.authorizeConnector(context, connector.id)
      window.open(response.data.authorization_url, '_self')
    } catch (err) {
      setError(sanitizeConnectorError(err, 'Could not start platform authorization'))
      setBusyId(null)
    }
  }

  const runSync = async (connector: DataConnectorInfo) => {
    setBusyId(connector.id)
    setError(null)
    try {
      if (isDataConnectorMockModeEnabled()) {
        await opportunitiesService.syncConnector(context, connector.id)
        await load()
        return
      }
      if (connector.type !== 'public_web_page' && connector.connection_status !== 'connected' && connector.connection_status !== 'rate_limited') {
        await authorize(connector)
        return
      }
      if (connector.type === 'public_web_page' && connector.connection_status === 'disconnected') {
        await opportunitiesService.connectConnector(context, connector.id)
      }
      await opportunitiesService.syncConnector(context, connector.id)
      await load()
    } catch (err) {
      setError(sanitizeConnectorError(err, 'Connector sync failed'))
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const selectAccount = async (event: React.ChangeEvent<HTMLSelectElement>, connector: DataConnectorInfo) => {
    const selected = event.target.value
    if (!selected) return
    setBusyId(connector.id)
    setError(null)
    try {
      await opportunitiesService.selectConnectorAccount(context, connector.id, selected)
      await load()
    } catch (err) {
      setError(sanitizeConnectorError(err, 'Could not select this platform account'))
    } finally {
      setBusyId(null)
    }
  }

  const disconnect = async (connector: DataConnectorInfo) => {
    setBusyId(connector.id)
    setError(null)
    try {
      await opportunitiesService.disconnectConnector(context, connector.id)
      await load()
    } catch (err) {
      setError(sanitizeConnectorError(err, 'Could not disconnect this connector'))
    } finally {
      setBusyId(null)
    }
  }

  const removeConnector = async (connector: DataConnectorInfo) => {
    if (typeof window !== 'undefined' && !window.confirm(`Are you sure you want to delete "${connector.name}"?`)) {
      return
    }
    setBusyId(connector.id)
    setError(null)
    try {
      await opportunitiesService.deleteConnector(context, connector.id)
      await load()
    } catch (err) {
      setError(sanitizeConnectorError(err, 'Could not delete this connector'))
    } finally {
      setBusyId(null)
    }
  }

  const saveEdit = async (event: React.FormEvent, connector: DataConnectorInfo) => {
    event.preventDefault()
    setBusyId(connector.id)
    setError(null)
    try {
      await opportunitiesService.updateConnector(context, connector.id, {
        name: editName.trim(),
        ...(connector.type === 'public_web_page' ? { url: editUrl.trim() } : {}),
        ...(connector.type === 'linkedin' ? { external_account_id: editAccountId.trim() } : {}),
        product_key: connector.product_key,
        offer_id: editOfferId.trim() || null,
        customer_model: editCustomerModel,
        regions: regionsFromText(editRegion),
      })
      setEditId(null)
      await load()
    } catch (err) {
      setError(sanitizeConnectorError(err, 'Could not update this connector'))
    } finally {
      setBusyId(null)
    }
  }

  const saveSchedule = async (event: React.FormEvent<HTMLFormElement>, connector: DataConnectorInfo) => {
    event.preventDefault()
    setBusyId(connector.id)
    setError(null)
    const form = new FormData(event.currentTarget)
    try {
      await opportunitiesService.saveConnectorSchedule(context, connector.id, {
        sync_enabled: form.get('connector-enabled') === 'on',
        schedule_enabled: form.get('schedule-enabled') === 'on',
        schedule_interval_minutes: Number(form.get('schedule-interval')),
        schedule_timezone: String(form.get('schedule-timezone') ?? ''),
      })
      await load()
    } catch (err) {
      setError(sanitizeConnectorError(err, 'Could not save this connector schedule'))
    } finally {
      setBusyId(null)
    }
  }

  const selectedSetup = catalog.find((entry) => entry.key === type)
  const requiresAccountId = type === 'linkedin'
  const validNewConnector = name.trim() && productKey && productReady &&
    (type !== 'public_web_page' || url.trim()) &&
    (!requiresAccountId || /^\d+$/.test(accountId.trim()))

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm" aria-labelledby="data-connectors-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="data-connectors-title" className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Globe className="size-4 text-primary" />
            Data Connectors
          </h2>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Connect official platform APIs or public pages. Retrieved content goes through the existing ingestion, evidence validation and opportunity pipeline. Scheduled sync is optional; Sync now remains available.
          </p>
        </div>
        <Badge variant="outline">Official APIs</Badge>
      </div>

      {!tablesMigrated && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning space-y-1.5" role="status">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="size-4 shrink-0" />
            Database Setup Required
          </div>
          <p className="text-xs text-muted-foreground">
            The data connector tables have not been created on the database yet. Run <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">php artisan migrate</code> on your backend server to activate live connectors.
          </p>
        </div>
      )}

      {isDataConnectorMockModeEnabled() && (
        <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning">
          Development mock mode: connector changes are kept in memory. No provider is connected or contacted, and sync attempts are skipped without creating opportunities.
        </p>
      )}

      {!globalScheduleEnabled && (
        <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning">
          {isDataConnectorMockModeEnabled()
            ? 'Scheduled sync is disabled in this local mock. Per-connector settings are editable, but no scheduler runs.'
            : 'Scheduled sync is disabled by the server configuration. Per-connector schedule settings are saved but will not run until it is enabled.'}
        </p>
      )}

      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}

      <form onSubmit={create} className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4 md:grid-cols-2 xl:grid-cols-4">
        <Input
          required
          maxLength={191}
          aria-label="Connector name"
          placeholder="Connector name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={saving || !tablesMigrated}
        />
        <select
          aria-label="Platform"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          value={type}
          onChange={(event) => {
            setType(event.target.value as DataConnectorInfo['type'])
            setUrl('')
            setAccountId('')
          }}
          disabled={saving || !tablesMigrated}
        >
          {connectorTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {type === 'public_web_page' ? (
          <Input
            required
            type="url"
            maxLength={2000}
            aria-label="Public page URL"
            placeholder="https://example.com/news-or-company-page"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            disabled={saving || !tablesMigrated}
          />
        ) : type === 'linkedin' ? (
          <Input
            required
            inputMode="numeric"
            aria-label="LinkedIn organization ID"
            placeholder="Numeric LinkedIn organization ID"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            disabled={saving || !tablesMigrated}
          />
        ) : (
          <p className="self-center text-xs text-muted-foreground">The authorized account is selected after platform sign-in.</p>
        )}
        <Input
          maxLength={191}
          aria-label="Optional sub-product offer ID"
          placeholder="Sub-product offer ID (optional)"
          value={offerId}
          onChange={(event) => setOfferId(event.target.value)}
          disabled={saving || !tablesMigrated}
        />
        <select
          aria-label="Customer model"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          value={customerModel}
          onChange={(event) => setCustomerModel(event.target.value as DataConnectorInfo['customer_model'])}
          disabled={saving || !tablesMigrated}
        >
          <option value="b2b">B2B</option>
          <option value="b2c">B2C</option>
          <option value="b2g">B2G</option>
        </select>
        <Input
          aria-label="Optional region scope"
          placeholder="Country | State | City; Country | State (optional)"
          value={region}
          onChange={(event) => setRegion(event.target.value)}
          disabled={saving || !tablesMigrated}
        />
        <Button type="submit" disabled={saving || !validNewConnector || !tablesMigrated} className="gap-2">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add
        </Button>
        {!productReady && (
          <p className="text-xs text-warning md:col-span-2 xl:col-span-4">Choose a configured product before adding a source. Each source is evaluated against that product&apos;s ICP.</p>
        )}
        {selectedSetup && selectedSetup.requirements.length > 0 && (
          <p className="text-xs text-muted-foreground md:col-span-2 xl:col-span-4">
            Setup requirements: {selectedSetup.requirements.join(' · ')}.
          </p>
        )}
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading connectors…</p>
      ) : connectors.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No connectors configured. Add a platform or public page above to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {connectors.map((connector) => (
            <article key={connector.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-foreground">{connector.name}</h3>
                    <Badge variant={statusVariant[connector.connection_status]}>{statusLabel[connector.connection_status]}</Badge>
                    <span className="text-xs text-muted-foreground">{platformLabel(connector.type)}</span>
                  </div>
                  {(connector.account_name || connector.url) && (
                    <a href={connector.url ?? undefined} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-primary hover:underline">
                      {connector.account_name ?? connector.url}
                    </a>
                  )}
                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Last sync: {dateLabel(connector.last_sync_at)}</span>
                    <span>Next scheduled: {dateLabel(connector.next_sync_at)}</span>
                    {connector.last_error && <span className="text-destructive">{connector.last_error}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    setEditId(editId === connector.id ? null : connector.id)
                    setEditName(connector.name)
                    setEditUrl(connector.url ?? '')
                    setEditAccountId(connector.external_account_id ?? '')
                    setEditOfferId(connector.offer_id ?? '')
                    setEditCustomerModel(connector.customer_model)
                    setEditRegion(regionText(connector.regions))
                  }}>
                    Configure
                  </Button>
                  <Button type="button" size="sm" disabled={busyId === connector.id || !connector.sync_enabled} onClick={() => void runSync(connector)} className="gap-1.5">
                    {busyId === connector.id ? <Loader2 className="size-3.5 animate-spin" /> : connector.connection_status === 'connected' ? <RefreshCw className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                    {connector.connection_status === 'connected' || connector.connection_status === 'rate_limited'
                      ? 'Sync now'
                      : connector.type === 'public_web_page' ? 'Sync now' : 'Connect'}
                  </Button>
                  {connector.connection_status !== 'disconnected' && (
                    <Button type="button" variant="outline" size="sm" disabled={busyId === connector.id} onClick={() => void disconnect(connector)}>
                      Disconnect
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyId === connector.id}
                    onClick={() => void removeConnector(connector)}
                    className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Delete ${connector.name}`}
                  >
                    {busyId === connector.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                    Delete
                  </Button>
                </div>
              </div>

              {connector.available_accounts.length > 0 && (
                <label className="mt-3 block max-w-xl space-y-1 text-xs text-muted-foreground">
                  <span>Select the account granted to G2G</span>
                  <select
                    aria-label={`Select ${platformLabel(connector.type)} account`}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    value=""
                    disabled={busyId === connector.id}
                    onChange={(event) => void selectAccount(event, connector)}
                  >
                    <option value="">Choose an account…</option>
                    {connector.available_accounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                </label>
              )}

              {editId === connector.id && (
                <form onSubmit={(event) => void saveEdit(event, connector)} className="mt-4 grid gap-2 border-t border-border pt-3 md:grid-cols-2 xl:grid-cols-4">
                  <Input required aria-label="Edit connector name" value={editName} onChange={(event) => setEditName(event.target.value)} />
                  {connector.type === 'public_web_page' ? (
                    <Input required type="url" aria-label="Edit connector URL" value={editUrl} onChange={(event) => setEditUrl(event.target.value)} />
                  ) : connector.type === 'linkedin' ? (
                    <Input required inputMode="numeric" aria-label="LinkedIn organization ID" value={editAccountId} onChange={(event) => setEditAccountId(event.target.value)} />
                  ) : (
                    <p className="self-center text-xs text-muted-foreground">Account changes require disconnecting and authorizing again.</p>
                  )}
                  <Input maxLength={191} aria-label="Edit sub-product offer ID" placeholder="Sub-product offer ID (optional)" value={editOfferId} onChange={(event) => setEditOfferId(event.target.value)} />
                  <select
                    aria-label="Edit customer model"
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    value={editCustomerModel}
                    onChange={(event) => setEditCustomerModel(event.target.value as DataConnectorInfo['customer_model'])}
                  >
                    <option value="b2b">B2B</option>
                    <option value="b2c">B2C</option>
                    <option value="b2g">B2G</option>
                  </select>
                  <Input aria-label="Edit region scope" placeholder="Country | State | City; Country | State (optional)" value={editRegion} onChange={(event) => setEditRegion(event.target.value)} />
                  <Button type="submit" size="sm" disabled={busyId === connector.id}>Save</Button>
                </form>
              )}

              <form onSubmit={(event) => void saveSchedule(event, connector)} className="mt-4 grid gap-3 border-t border-border pt-3 md:grid-cols-[auto_auto_140px_1fr_auto] md:items-end">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" name="connector-enabled" defaultChecked={connector.sync_enabled} />
                  Connector enabled
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" name="schedule-enabled" defaultChecked={connector.schedule_enabled} />
                  Schedule sync
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>Every (minutes)</span>
                  <Input required type="number" min={15} max={10080} step={15} name="schedule-interval" defaultValue={connector.schedule_interval_minutes} />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>Timezone (IANA)</span>
                  <Input required name="schedule-timezone" defaultValue={connector.schedule_timezone} placeholder="Asia/Kolkata" />
                </label>
                <Button type="submit" size="sm" variant="outline" disabled={busyId === connector.id}>Save schedule</Button>
              </form>

              {connector.history.length > 0 && (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground"><Clock3 className="size-3.5" /> Recent syncs</p>
                  <ul className="space-y-2">
                    {connector.history.map((run) => (
                      <li key={run.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {run.status === 'failed' ? <XCircle className="size-3.5 text-destructive" /> : run.status === 'completed' ? <CheckCircle2 className="size-3.5 text-success" /> : <AlertCircle className="size-3.5 text-warning" />}
                        <span>{dateLabel(run.started_at)}</span>
                        <span className="font-medium capitalize text-foreground">{run.status}</span>
                        <span>{run.records_fetched} fetched · {run.records_processed} processed · {run.records_created} created · {run.records_duplicate} duplicates · {run.records_skipped} skipped · {run.records_failed} failed</span>
                        {run.error_message && <span className="text-destructive">{run.error_message}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
