'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  KeyRound,
  ShieldCheck,
  Trash2,
  Wifi,
  XCircle,
  Zap,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Radar,
} from 'lucide-react'
import {
  PlatformWebIcon,
  PlatformLinkedInIcon,
  PlatformYouTubeIcon,
  PlatformFacebookIcon,
  PlatformInstagramIcon,
} from './platform-icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { LaravelContext } from '@/lib/laravel-context'
import { withTimeout } from '@/lib/with-timeout'
import { apiErrorText } from '@/lib/api-messages'
import type { ProductInfo } from '@/services/portfolio/types'
import {
  opportunitiesService,
  type DataConnectorInfo,
  type DataConnectorsResponse,
} from '@/services/signals/opportunities'
import {
  connectorStage,
  friendlyConnectorMessage,
  finishedSyncs,
  latestStatuses,
  oauthReturnMessage,
  parseOAuthReturn,
  syncButtonState,
  syncRequestedMessage,
  syncRunDisplay,
  syncStageCounts,
  workerWaitHint,
} from '@/lib/signals/connector-diagnostics'
import { ConnectorFormDialog } from './connector-form-dialog'
import { ConnectorScheduleDialog } from './connector-schedule-dialog'
import { ConnectorMonitoringDialog } from './connector-monitoring-dialog'
import { ConnectorSyncReport } from './connector-sync-report'

export interface DataConnectorsPanelProps {
  context: LaravelContext
  /** How long to wait for the server before the screen stops waiting (tests use a short one). */
  requestTimeoutMs?: number
  productKey?: string | null
  productReady?: boolean
  products?: ProductInfo[] | null
  onSyncCompleted?: () => void
}

const PLATFORM_CONFIG: Record<
  DataConnectorInfo['type'],
  {
    name: string
    icon: React.ComponentType<{ className?: string }>
    color: string
    bg: string
    border: string
    badgeClass: string
  }
> = {
  public_web_page: {
    name: 'Public Web Page',
    icon: PlatformWebIcon,
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-50 dark:bg-teal-950/40',
    border: 'border-teal-200 dark:border-teal-800',
    badgeClass: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300',
  },
  linkedin: {
    name: 'LinkedIn Org',
    icon: PlatformLinkedInIcon,
    color: 'text-[#0077b5]',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    border: 'border-blue-200 dark:border-blue-800',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  },
  youtube: {
    name: 'YouTube Channel',
    icon: PlatformYouTubeIcon,
    color: 'text-[#ff0000]',
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-200 dark:border-red-800',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  },
  facebook_page: {
    name: 'Facebook Page',
    icon: PlatformFacebookIcon,
    color: 'text-[#1877f2]',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    border: 'border-indigo-200 dark:border-indigo-800',
    badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300',
  },
  instagram_business: {
    name: 'Instagram Business',
    icon: PlatformInstagramIcon,
    color: 'text-[#e1306c]',
    bg: 'bg-pink-50 dark:bg-pink-950/40',
    border: 'border-pink-200 dark:border-pink-800',
    badgeClass: 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300',
  },
}

function formatDate(value: string | null): string {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const now = new Date()
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatNextDate(value: string | null): string {
  if (!value) return 'Manual only'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const now = new Date()
  const diffMinutes = Math.floor((date.getTime() - now.getTime()) / (1000 * 60))
  if (diffMinutes < 0) return 'Pending sync'
  if (diffMinutes < 60) return `in ${diffMinutes}m`
  if (diffMinutes < 1440) return `in ${Math.floor(diffMinutes / 60)}h`
  return date.toLocaleDateString()
}

export function DataConnectorsPanel({
  context,
  productKey,
  products,
  onSyncCompleted,
  requestTimeoutMs,
}: DataConnectorsPanelProps) {
  const timed = <T,>(request: Promise<T>) => withTimeout(request, requestTimeoutMs)
  const [connectors, setConnectors] = useState<DataConnectorInfo[]>([])
  const [catalog, setCatalog] = useState<DataConnectorsResponse['available']>([])
  const [tablesMigrated, setTablesMigrated] = useState(true)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  // The connectors with a request in flight: one connector's request never locks another's buttons.
  const [busyIds, setBusyIds] = useState<ReadonlySet<number>>(new Set())
  const startBusy = (id: number) => setBusyIds((b) => new Set(b).add(id))
  const endBusy = (id: number) => setBusyIds((b) => { const next = new Set(b); next.delete(id); return next })
  // The connector whose platform sign-in is opening (shown as Connecting, never as Connected).
  const [connectingId, setConnectingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Modals
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  // Connector Settings is for administrators: the server says who they are, and its routes refuse everyone else.
  const [canManageSettings, setCanManageSettings] = useState(false)
  const [createType, setCreateType] = useState<DataConnectorInfo['type'] | null>(null)
  const [editConnector, setEditConnector] = useState<DataConnectorInfo | null>(null)
  const [scheduleConnector, setScheduleConnector] = useState<DataConnectorInfo | null>(null)
  const [monitorConnector, setMonitorConnector] = useState<DataConnectorInfo | null>(null)
  const [reportTarget, setReportTarget] = useState<{ connectorId: number; syncId: number; name: string } | null>(null)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [platformFilter, setPlatformFilter] = useState<string>('all')

  // History expanded state
  const [expandedHistory, setExpandedHistory] = useState<Record<number, boolean>>({})
  // The connector list is open when you pick Connectors; the bar folds it. It re-opens by itself while a sync runs, so progress is never hidden.
  const [listOpen, setListOpen] = useState(true)

  // Test connection feedback per connector
  const [testResults, setTestResults] = useState<Record<number, { healthy: boolean; latency: number; message: string }>>({})
  const [testingId, setTestingId] = useState<number | null>(null)
  // Account the user picked per connector (Facebook Page / Instagram account) before saving.
  const [accountChoice, setAccountChoice] = useState<Record<number, string>>({})

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    try {
      const response = await timed(opportunitiesService.listConnectors(context))
      setConnectors(response.data || [])
      setCatalog(response.available || [])
      setCanManageSettings(response.can_manage_settings === true)
      setTablesMigrated(response.tables_migrated !== false)
      setError(null)
    } catch (err) {
      setError(apiErrorText(err, 'Failed to load data connectors.'))
    } finally {
      if (!isSilent) setLoading(false)
      setRefreshing(false)
    }
  }, [context])

  useEffect(() => {
    Promise.resolve().then(() => { void load() })
  }, [load])

  // The OAuth callback sends the browser back here with ?connector_oauth=...&reason=... Show the real
  // outcome once, then remove the parameters so a refresh does not repeat the message.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const returned = parseOAuthReturn(window.location.search)
    if (!returned) return
    const message = oauthReturnMessage(returned)
    if (message.tone === 'danger') {
      setError(message.text)
    } else {
      setNotice(message.text)
    }
    const params = new URLSearchParams(window.location.search)
    ;['connector_oauth', 'connector_id', 'reason'].forEach((key) => params.delete(key))
    const query = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash)
    void load(true)
  }, [load])

  // Periodic refresh when any sync run is active
  useEffect(() => {
    const hasRunning = connectors.some((c) =>
      c.history.some((h) => h.status === 'running' || h.status === 'queued'),
    )
    if (!hasRunning) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setListOpen(true)
    const interval = setInterval(() => { void load(true) }, 1500)
    return () => clearInterval(interval)
  }, [connectors, load])

  // Tell the page once, when a sync that was queued/running actually finished with data, so the signals list refreshes then and
  // not when the request was merely accepted. A failed or recovered sync never counts.
  const lastSyncStatuses = useRef<Record<number, string>>({})
  useEffect(() => {
    const finished = finishedSyncs(lastSyncStatuses.current, connectors)
    lastSyncStatuses.current = latestStatuses(connectors)
    if (finished.length > 0) onSyncCompleted?.()
  }, [connectors, onSyncCompleted])

  const handleManualRefresh = () => {
    setRefreshing(true)
    void load()
  }

  const handleSyncNow = async (connector: DataConnectorInfo) => {
    startBusy(connector.id)
    setError(null)
    setNotice(null)
    try {
      const res = await timed(opportunitiesService.syncConnector(context, connector.id, { interactive: true }))
      // The server answers 202 "queued": say that, never "synced". The card then follows the sync until it ends.
      setNotice(syncRequestedMessage(res.message, connector.name))
      await load(true)
    } catch (err) {
      setError(apiErrorText(err, 'Connector sync failed.'))
    } finally {
      endBusy(connector.id)
    }
  }

  const handleTestConnection = async (connector: DataConnectorInfo) => {
    setTestingId(connector.id)
    setError(null)
    try {
      const result = await timed(opportunitiesService.testConnector(context, connector.id))
      setTestResults((prev) => ({
        ...prev,
        [connector.id]: {
          healthy: result.healthy,
          latency: result.latency_ms,
          message: result.message,
        },
      }))
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [connector.id]: {
          healthy: false,
          latency: 0,
          message: apiErrorText(err, 'Connection test failed.'),
        },
      }))
    } finally {
      setTestingId(null)
    }
  }

  const handleConnect = async (connector: DataConnectorInfo) => {
    startBusy(connector.id)
    setError(null)
    setNotice(null)
    try {
      if (connector.type === 'public_web_page') {
        await timed(opportunitiesService.connectConnector(context, connector.id))
        setNotice(`${connector.name} is enabled. Click Sync Now to fetch the page.`)
      } else {
        const provider = catalog.find((entry) => entry.key === connector.type)
        if (provider && provider.ready === false) {
          setError(provider.readiness_message || 'This platform is not configured on the server yet. Ask an administrator to complete provider setup.')
          return
        }
        const res = await timed(opportunitiesService.authorizeConnector(context, connector.id))
        const authUrl = res && 'data' in res && typeof res.data === 'object' && res.data && 'authorization_url' in res.data
          ? (res.data.authorization_url as string)
          : null
        if (!authUrl) {
          setError('The server did not return an authorization link. Nothing was connected.')
          return
        }
        // Leaves the app for the official provider sign-in; the callback returns to this screen.
        setConnectingId(connector.id)
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- absolute provider URL issued by the server, not an internal route
        window.location.assign(authUrl)
        return
      }
      // Status always comes from the server; it is never assumed locally.
      await load(true)
    } catch (err) {
      setError(apiErrorText(err, 'Could not connect this provider.'))
      await load(true)
    } finally {
      endBusy(connector.id)
    }
  }

  const handleSelectAccount = async (connector: DataConnectorInfo, accountId: string) => {
    if (!accountId) {
      setError('Choose an account first.')
      return
    }
    startBusy(connector.id)
    setError(null)
    setNotice(null)
    try {
      const res = await timed(opportunitiesService.selectConnectorAccount(context, connector.id, accountId))
      setNotice(`Connected ${res.data.account_name || connector.name}. You can now sync.`)
      await load(true)
    } catch (err) {
      setError(apiErrorText(err, 'Could not save the selected account.'))
    } finally {
      endBusy(connector.id)
    }
  }

  const handleDisconnect = async (connector: DataConnectorInfo) => {
    startBusy(connector.id)
    setError(null)
    try {
      const res = await timed(opportunitiesService.disconnectConnector(context, connector.id))
      // The server says whether the platform confirmed the revocation; never claimed here.
      setNotice(res.message || `Disconnected ${connector.name}`)
      await load(true)
    } catch (err) {
      setError(apiErrorText(err, 'Could not disconnect connector.'))
    } finally {
      endBusy(connector.id)
    }
  }

  const handleDelete = async (connector: DataConnectorInfo) => {
    if (typeof window !== 'undefined' && !window.confirm(`Are you sure you want to delete "${connector.name}"?`)) {
      return
    }
    startBusy(connector.id)
    setError(null)
    try {
      await timed(opportunitiesService.deleteConnector(context, connector.id))
      setNotice(`Deleted connector "${connector.name}".`)
      await load(true)
    } catch (err) {
      setError(apiErrorText(err, 'Could not delete connector.'))
    } finally {
      endBusy(connector.id)
    }
  }

  // Connectors belong to a product: everything on this screen (the bar, its counts, the list) is the selected product's own.
  const productConnectors = useMemo(
    () => connectors.filter((c) => !(productKey && c.product_key && c.product_key !== productKey)),
    [connectors, productKey],
  )
  const productLabel = products?.find((p) => p.key === productKey)?.label ?? 'this product'
  // Where the connectors that are NOT on this product live, so the empty state can say so instead of looking like nothing was saved.
  const otherProductNames = useMemo(() => {
    const names = new Set<string>()
    connectors.forEach((c) => {
      if (productKey && c.product_key && c.product_key !== productKey) {
        names.add(products?.find((p) => p.key === c.product_key)?.label ?? c.product_key)
      }
    })
    return Array.from(names)
  }, [connectors, productKey, products])

  // Filtered connectors
  const filteredConnectors = useMemo(() => {
    return connectors.filter((c) => {
      if (productKey && c.product_key && c.product_key !== productKey) {
        // Allow viewing all if productKey is not set, or match selected product
        return false
      }
      if (platformFilter !== 'all' && c.type !== platformFilter) {
        return false
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matchesName = c.name.toLowerCase().includes(query)
        const matchesUrl = c.url?.toLowerCase().includes(query) ?? false
        const matchesAccount = c.account_name?.toLowerCase().includes(query) ?? false
        if (!matchesName && !matchesUrl && !matchesAccount) return false
      }
      return true
    })
  }, [connectors, productKey, platformFilter, searchQuery])

  return (
    <section aria-labelledby="connectors-heading" className="space-y-4">
      {/* Header: what this is, and the two things you can do */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Globe className="size-5" />
            </div>
            <div>
              <h2 id="connectors-heading" className="text-base font-bold text-foreground">Sources (connectors)</h2>
              <p className="text-xs text-muted-foreground">
                Connect a platform or page once, then click Sync now to find buying signals.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleManualRefresh}
              disabled={refreshing || loading}
              aria-label="Refresh sources"
              title="Refresh"
              className="size-8"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => { setCreateType(null); setCreateDialogOpen(true) }}
              className="gap-1.5 font-semibold shadow-xs"
            >
              <Plus className="size-3.5" />
              Add connector
            </Button>
          </div>
        </div>

        {/* Status notice */}
        {notice && (
          <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs text-primary">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="font-bold hover:opacity-80">
              ×
            </button>
          </div>
        )}

        {/* Storage not ready */}
        {!tablesMigrated && (
          <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-xs text-foreground">
            <AlertCircle className="size-4 text-warning shrink-0" />
            <div className="flex-1">
              <span className="font-semibold">Connector storage is not set up on the server. </span>
              Connectors cannot be saved or synced until an administrator runs the pending database migration.
            </div>
          </div>
        )}

        {/* A platform application that is not configured: administrators are pointed to Add Connector, which holds the credentials; everyone else is told plainly */}
        {catalog.some((entry) => entry.auth === 'oauth' && entry.ready === false) && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/25 bg-primary/5 px-4 py-2.5 text-xs text-foreground">
            <div className="flex min-w-0 items-center gap-2">
              <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="font-semibold">{catalog.filter((entry) => entry.auth === 'oauth' && entry.ready === false).map((entry) => entry.label).join(', ')}</span>
                {(() => {
                  const many = catalog.filter((entry) => entry.auth === 'oauth' && entry.ready === false).length > 1
                  return canManageSettings
                    ? ` ${many ? 'need' : 'needs'} provider credentials before accounts can be connected.`
                    : ` ${many ? 'are' : 'is'} not set up yet. An administrator needs to finish the one-time setup.`
                })()}
              </span>
            </div>
            {canManageSettings && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const first = catalog.find((entry) => entry.auth === 'oauth' && entry.ready === false)
                  setCreateType((first?.key as DataConnectorInfo['type'] | undefined) ?? null)
                  setCreateDialogOpen(true)
                }}
                className="h-7 gap-1.5 text-xs"
              >
                <KeyRound className="size-3.5" />
                Set up in Add Connector
              </Button>
            )}
          </div>
        )}

        {/* Deployment warnings that would break the OAuth round trip (e.g. localhost redirect in production) */}
        {Array.from(new Set(catalog.flatMap((entry) => entry.warnings ?? []))).map((warning) => (
          <div key={warning} className="flex items-start gap-2 rounded-xl border border-primary/25 bg-primary/5 px-4 py-2.5 text-xs text-foreground">
            <AlertCircle className="mt-0.5 size-4 text-primary shrink-0" />
            <span>{warning}</span>
          </div>
        ))}

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-4 py-2.5 text-xs text-foreground">
            <AlertCircle className="size-4 shrink-0 text-primary" />
            <span title={error}>{friendlyConnectorMessage(error)}</span>
          </div>
        )}

        {/* Search & Platform Filter Toolbar: only worth showing once there are many sources */}
        {productConnectors.length > 6 && listOpen && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-border/60">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <button
              type="button"
              onClick={() => setPlatformFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                platformFilter === 'all'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              All Platforms ({productConnectors.length})
            </button>
            {Object.entries(PLATFORM_CONFIG).map(([typeKey, cfg]) => {
              const count = productConnectors.filter((c) => c.type === typeKey).length
              return (
                <button
                  key={typeKey}
                  type="button"
                  onClick={() => setPlatformFilter(typeKey)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    platformFilter === typeKey
                      ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <cfg.icon className="size-3" />
                  <span>{cfg.name}</span>
                  {count > 0 && <span className="opacity-75">({count})</span>}
                </button>
              )
            })}
          </div>

          <div className="relative min-w-48 flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search connectors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </div>
        )}

        {/* The connector list bar: one line, folded; the arrow shows every connector so you can set them up */}
        {!loading && productConnectors.length > 0 && (
          <button
            type="button"
            onClick={() => setListOpen((open) => !open)}
            aria-expanded={listOpen}
            aria-controls="connector-list"
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span className="font-semibold text-foreground">Connector list ({productConnectors.length})</span>
              <span className="text-xs text-muted-foreground">
                {productConnectors.filter((c) => c.connection_status === 'connected').length} connected
                {' · '}
                {productConnectors.filter((c) => c.connection_status !== 'connected').length} to set up
              </span>
            </span>
            {listOpen ? <ChevronUp className="size-4 shrink-0 text-primary" /> : <ChevronDown className="size-4 shrink-0 text-primary" />}
          </button>
        )}
      </div>

      {/* Connectors List / Cards (folded until the bar above is opened) */}
      <div id="connector-list" hidden={!(listOpen || (!loading && productConnectors.length === 0))}>
      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-xs text-muted-foreground space-y-2">
          <Loader2 className="size-6 animate-spin mx-auto text-primary" />
          <p>Loading connectors...</p>
        </div>
      ) : filteredConnectors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center space-y-3">
          <div className="mx-auto size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Globe className="size-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">No connectors for {productLabel} yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchQuery || platformFilter !== 'all'
                ? 'No connectors match your current filters. Try resetting the search or platform tab.'
                : `Connectors belong to a product.${otherProductNames.length > 0 ? ` Your existing connectors are on ${otherProductNames.join(', ')}; switch product above to see them.` : ''} Add one for ${productLabel} to start finding its buying signals.`}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="gap-1.5 font-semibold"
          >
            <Plus className="size-3.5" />
            Add a connector for {productLabel}
          </Button>
        </div>
      ) : (
        <div className="grid gap-3.5">
          {filteredConnectors.map((connector) => {
            const platform = PLATFORM_CONFIG[connector.type] || PLATFORM_CONFIG.public_web_page
            const Icon = platform.icon
            const isBusy = busyIds.has(connector.id)
            const isTesting = testingId === connector.id
            const testResult = testResults[connector.id]
            const historyOpen = Boolean(expandedHistory[connector.id])
            const targetDisplay = connector.account_name || connector.url || (connector.external_account_id ? `Org ID: ${connector.external_account_id}` : null)
            const targetHref = connector.url || (connector.external_account_id ? `https://linkedin.com/company/${connector.external_account_id}` : null)

            const isConnected = connector.connection_status === 'connected'
            const isOauth = connector.type !== 'public_web_page'
            // A website needs no sign-in: it can be synced from its first moment (status "not configured") and after an error, just not once disconnected.
            const canSync = isConnected || connector.connection_status === 'rate_limited' || (!isOauth && connector.connection_status !== 'disconnected')
            const provider = catalog.find((entry) => entry.key === connector.type)
            const providerReady = provider?.ready !== false
            const needsAccount = connector.available_accounts.length > 0 && !isConnected
            const statusInfo = connectorStage(connector, connector.history, { oauth: isOauth, providerReady, needsAccount, connecting: connectingId === connector.id })
            const counts = syncStageCounts(connector.history[0])
            const chosenAccount = accountChoice[connector.id] ?? connector.available_accounts[0]?.id ?? ''
            const syncButton = syncButtonState(connector.history)

            return (
              <article
                key={connector.id}
                className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-border hover:shadow-sm space-y-3"
              >
                {/* Header row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`p-2.5 rounded-xl ${platform.bg} ${platform.color} border ${platform.border} shrink-0`}>
                      <Icon className="size-5" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-foreground truncate">{connector.name}</h3>

                        {/* Connection Status Badge (always the server's state) */}
                        <Badge
                          variant={statusInfo.tone === 'success' ? 'success' : statusInfo.tone === 'warning' || statusInfo.tone === 'danger' ? 'navy' : 'outline'}
                          className="text-[10px] gap-1 px-2 py-0.5"
                          title={statusInfo.action ?? undefined}
                        >
                          {isConnected && <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                          {statusInfo.label === 'Failed' ? 'Needs attention' : statusInfo.label}
                        </Badge>

                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${platform.badgeClass}`}>
                          {platform.name}
                        </span>

                        <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                          {connector.customer_model}
                        </Badge>
                      </div>

                      {/* Target Link */}
                      {targetDisplay && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {targetHref ? (
                            <a
                              href={targetHref}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline truncate max-w-md flex items-center gap-1"
                            >
                              <span>{targetDisplay}</span>
                              <ExternalLink className="size-3 shrink-0 opacity-70" />
                            </a>
                          ) : (
                            <span className="truncate">{targetDisplay}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* One main action, and everything else in the menu */}
                  <div className="flex items-center gap-1.5">
                    {canSync ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={isBusy || !connector.sync_enabled || syncButton.disabled}
                        title={syncButton.hint ?? undefined}
                        onClick={() => void handleSyncNow(connector)}
                        className="gap-1.5 text-xs font-semibold"
                      >
                        {isBusy || syncButton.disabled ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3.5" />
                        )}
                        {syncButton.label}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={isBusy || (isOauth && !providerReady)}
                        onClick={() => void handleConnect(connector)}
                        title={isOauth && !providerReady ? 'An administrator must complete platform setup first.' : undefined}
                        className="text-xs font-semibold"
                      >
                        {!isOauth
                          ? 'Enable'
                          : ['token_expired', 'permission_required', 'error', 'rate_limited'].includes(connector.connection_status)
                            ? 'Reconnect'
                            : 'Connect account'}
                      </Button>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" size="icon" className="size-8" aria-label={`More actions for ${connector.name}`}>
                          {isTesting ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem disabled={isTesting || isBusy} onSelect={() => void handleTestConnection(connector)}>
                          <Wifi className="size-3.5" /> Test connection
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setScheduleConnector(connector)}>
                          <Clock3 className="size-3.5" /> Schedule
                        </DropdownMenuItem>
                        {connector.type !== 'public_web_page' && (
                          <DropdownMenuItem onSelect={() => setMonitorConnector(connector)}>
                            <Radar className="size-3.5" /> What to monitor
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => setEditConnector(connector)}>
                          <Settings2 className="size-3.5" /> Edit
                        </DropdownMenuItem>
                        {canSync && (
                          <DropdownMenuItem disabled={isBusy} onSelect={() => void handleDisconnect(connector)}>
                            <XCircle className="size-3.5" /> Disconnect
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled={isBusy} onSelect={() => void handleDelete(connector)} className="text-destructive focus:text-destructive">
                          <Trash2 className="size-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Test Result Notice */}
                {testResult && (
                  <div
                    className={`rounded-xl border px-3 py-2 text-xs flex items-center justify-between ${
                      testResult.healthy
                        ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
                        : 'border-primary/25 bg-primary/5 text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {testResult.healthy ? (
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                      ) : (
                        <AlertCircle className="size-4 shrink-0 text-primary" />
                      )}
                      <span title={testResult.message}>{friendlyConnectorMessage(testResult.message)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTestResults((prev) => {
                        const copy = { ...prev }
                        delete copy[connector.id]
                        return copy
                      })}
                      className="font-bold opacity-70 hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                )}

                {/* Account selection after OAuth (Facebook Page / Instagram account) */}
                {needsAccount && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-xs">
                    <span className="font-medium text-foreground">Choose the account to monitor:</span>
                    <select
                      value={chosenAccount}
                      onChange={(e) => setAccountChoice((prev) => ({ ...prev, [connector.id]: e.target.value }))}
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                      aria-label={`Account for ${connector.name}`}
                    >
                      {connector.available_accounts.map((account) => (
                        <option key={account.id} value={account.id}>{account.name}</option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isBusy || !chosenAccount}
                      onClick={() => void handleSelectAccount(connector, chosenAccount)}
                      className="text-xs"
                    >
                      Use this account
                    </Button>
                  </div>
                )}

                {/* What to do next, when the connector is not working */}
                {!isConnected && statusInfo.action && !needsAccount && !connector.last_error && (
                  <div className="flex items-start gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                    <span>{statusInfo.action}</span>
                  </div>
                )}

                {/* Last Error banner */}
                {connector.last_error && (
                  <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-foreground flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0 text-primary" />
                    <span className="flex-1" title={connector.last_error}>{friendlyConnectorMessage(connector.last_error)}</span>
                  </div>
                )}

                {/* Live progress while a sync runs: waiting for a worker, reading the platform, analysing posts */}
                {!counts?.done && connector.history[0] && (() => {
                  const run = connector.history[0]
                  const pct = Math.max(2, Math.min(100, run.progress ?? 5))
                  const stage = run.status === 'queued'
                    ? (workerWaitHint(run) ?? 'Waiting in the queue for a worker…')
                    : run.records_fetched === 0
                      ? 'Fetching from the platform (channels, videos, Shorts, comments)…'
                      : `Analysing posts: ${run.records_fetched - (run.records_pending ?? 0)} of ${run.records_fetched} handled, ${run.records_pending ?? 0} waiting…`
                  return (
                    <div className="space-y-1" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Sync progress">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{stage}</span>
                        <span className="font-semibold text-foreground">{pct}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })()}

                {/* One summary line: when it last ran, what it found, when it runs next */}
                <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 pt-2 border-t border-border/60 text-xs text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Latest sync summary">
                    <span>Last sync <strong className="text-foreground">{formatDate(connector.last_sync_at)}</strong></span>
                    {counts && (
                      <>
                        <span aria-hidden>·</span>
                        <span><strong className="text-foreground">{counts.fetched}</strong> items read</span>
                        <span aria-hidden>·</span>
                        <span><strong className="text-primary">{counts.signals}</strong> signals found</span>
                        {!counts.done && <span className="italic">(in progress)</span>}
                      </>
                    )}
                    <span aria-hidden>·</span>
                    <span>Next: {formatNextDate(connector.next_sync_at)}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedHistory((prev) => ({ ...prev, [connector.id]: !prev[connector.id] }))}
                    className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline ml-auto"
                  >
                    <Activity className="size-3" />
                    <span>Details</span>
                    {historyOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                  </button>
                </div>

                {/* Collapsible Sync History Table */}
                {historyOpen && (
                  <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-2 pt-2.5">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        <strong className="text-foreground">Product:</strong> {connector.product_key.toUpperCase()}
                        {connector.offer_id ? ` · Offer: ${connector.offer_id}` : ' · Whole product'}
                      </span>
                      <span>
                        <strong className="text-foreground">Region:</strong>{' '}
                        {connector.regions && connector.regions.length > 0
                          ? connector.regions.map((r) => [r.country, r.state].filter(Boolean).join('/')).join(', ')
                          : 'Pan-India'}
                      </span>
                    </div>
                    {connector.history.length === 0 && <p className="text-xs text-muted-foreground">No syncs yet.</p>}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Clock3 className="size-3.5 text-primary" />
                        Recent syncs
                      </span>
                      <span className="text-[10px] text-muted-foreground">Latest 5 runs</span>
                    </div>

                    <div className="divide-y divide-border/60">
                      {connector.history.slice(0, 5).map((run) => (
                        <div key={run.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            {run.status === 'completed' ? (
                              <CheckCircle2 className="size-3.5 text-emerald-500" />
                            ) : run.status === 'failed' ? (
                              <AlertCircle className="size-3.5 text-primary" />
                            ) : run.status === 'partial' ? (
                              <AlertCircle className="size-3.5 text-primary" />
                            ) : run.status === 'skipped' ? (
                              <CheckCircle2 className="size-3.5 text-muted-foreground" />
                            ) : (
                              <Clock3 className="size-3.5 text-primary" />
                            )}
                            <span className="font-semibold text-foreground">{run.stage === 'interrupted' ? 'Interrupted' : run.status === 'failed' ? 'Needs attention' : run.stage === 'completed_with_errors' ? 'Completed with errors' : syncRunDisplay(run.status).label}</span>
                            <span className="text-[11px] text-muted-foreground">{formatDate(run.started_at)}</span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span>{run.records_fetched} fetched</span>
                            <span>{run.records_processed} processed</span>
                            <span className="font-semibold text-primary">{run.records_created} signals created</span>
                            <button
                              type="button"
                              onClick={() => setReportTarget({ connectorId: connector.id, syncId: run.id, name: `${connector.name} · ${formatDate(run.started_at)}` })}
                              className="font-semibold text-primary hover:underline"
                            >
                              Report
                            </button>
                            {run.error_message && (
                              <span className="text-primary max-w-xs truncate" title={run.error_message}>
                                {friendlyConnectorMessage(run.error_message)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
      </div>

      {/* Add / Edit Dialog */}
      <ConnectorFormDialog
        context={context}
        open={createDialogOpen || Boolean(editConnector)}
        mode={editConnector ? 'edit' : 'create'}
        connector={editConnector}
        products={products ?? null}
        defaultProductKey={productKey ?? null}
        defaultType={createType}
        catalog={catalog}
        canManageSettings={canManageSettings}
        onCredentialsSaved={() => void load(true)}
        onClose={() => {
          setCreateDialogOpen(false)
          setEditConnector(null)
          setCreateType(null)
        }}
        onSaved={(saved) => {
          const justCreated = !editConnector
          setCreateDialogOpen(false)
          setEditConnector(null)
          setCreateType(null)
          void load(true)
          onSyncCompleted?.()
          // New OAuth connector: go straight to the official sign-in (blocked with a clear message if the platform is not set up).
          if (justCreated && saved && saved.type !== 'public_web_page') {
            void handleConnect(saved)
          }
        }}
      />

      <ConnectorMonitoringDialog
        context={context}
        open={Boolean(monitorConnector)}
        connector={monitorConnector}
        onClose={() => setMonitorConnector(null)}
        onSaved={() => {
          void load(true)
          setMonitorConnector(null)
        }}
      />
      <ConnectorSyncReport context={context} target={reportTarget} onClose={() => setReportTarget(null)} />

      {/* Quick Schedule Dialog */}
      <ConnectorScheduleDialog
        context={context}
        open={Boolean(scheduleConnector)}
        connector={scheduleConnector}
        onClose={() => setScheduleConnector(null)}
        onSaved={() => {
          void load(true)
          setScheduleConnector(null)
        }}
      />
    </section>
  )
}
