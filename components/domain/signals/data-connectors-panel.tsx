'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  ShieldCheck,
  Trash2,
  Wifi,
  XCircle,
  Zap,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
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
import type { LaravelContext } from '@/lib/laravel-context'
import { apiErrorText } from '@/lib/api-messages'
import type { ProductInfo } from '@/services/portfolio/types'
import {
  opportunitiesService,
  type DataConnectorInfo,
  type DataConnectorsResponse,
} from '@/services/signals/opportunities'
import { ConnectorFormDialog } from './connector-form-dialog'
import { ConnectorScheduleDialog } from './connector-schedule-dialog'

export interface DataConnectorsPanelProps {
  context: LaravelContext
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
}: DataConnectorsPanelProps) {
  const [connectors, setConnectors] = useState<DataConnectorInfo[]>([])
  const [catalog, setCatalog] = useState<DataConnectorsResponse['available']>([])
  const [tablesMigrated, setTablesMigrated] = useState(true)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Modals
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editConnector, setEditConnector] = useState<DataConnectorInfo | null>(null)
  const [scheduleConnector, setScheduleConnector] = useState<DataConnectorInfo | null>(null)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [platformFilter, setPlatformFilter] = useState<string>('all')

  // History expanded state
  const [expandedHistory, setExpandedHistory] = useState<Record<number, boolean>>({})

  // Test connection feedback per connector
  const [testResults, setTestResults] = useState<Record<number, { healthy: boolean; latency: number; message: string }>>({})
  const [testingId, setTestingId] = useState<number | null>(null)

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    try {
      const response = await opportunitiesService.listConnectors(context)
      setConnectors(response.data || [])
      setCatalog(response.available || [])
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

  // Periodic refresh when any sync run is active
  useEffect(() => {
    const hasRunning = connectors.some((c) =>
      c.history.some((h) => h.status === 'running' || h.status === 'queued'),
    )
    if (!hasRunning) return
    const interval = setInterval(() => { void load(true) }, 2500)
    return () => clearInterval(interval)
  }, [connectors, load])

  const handleManualRefresh = () => {
    setRefreshing(true)
    void load()
  }

  const handleSyncNow = async (connector: DataConnectorInfo) => {
    setBusyId(connector.id)
    setError(null)
    setNotice(null)
    try {
      const res = await opportunitiesService.syncConnector(context, connector.id, { interactive: true })
      setNotice(res.message || `Successfully synced ${connector.name}`)
      await load(true)
      onSyncCompleted?.()
    } catch (err) {
      setError(apiErrorText(err, 'Connector sync failed.'))
    } finally {
      setBusyId(null)
    }
  }

  const handleTestConnection = async (connector: DataConnectorInfo) => {
    setTestingId(connector.id)
    setError(null)
    try {
      const result = await opportunitiesService.testConnector(context, connector.id)
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
    setBusyId(connector.id)
    setError(null)
    try {
      if (connector.type === 'public_web_page') {
        await opportunitiesService.connectConnector(context, connector.id)
        setNotice(`Connected ${connector.name}`)
      } else {
        const res = await opportunitiesService.authorizeConnector(context, connector.id)
        const authUrl = res && 'data' in res && typeof res.data === 'object' && res.data && 'authorization_url' in res.data
          ? (res.data.authorization_url as string)
          : null
        if (authUrl) {
          window.location.href = authUrl
          return
        }
        setNotice(`Authorized and connected ${connector.name}`)
      }
      // Optimistically update connector status in UI
      setConnectors((prev) =>
        prev.map((c) =>
          c.id === connector.id
            ? { ...c, connection_status: 'connected', last_error: null }
            : c,
        ),
      )
      await load(true)
    } catch (err) {
      setError(apiErrorText(err, 'Could not connect this provider.'))
    } finally {
      setBusyId(null)
    }
  }

  const handleDisconnect = async (connector: DataConnectorInfo) => {
    setBusyId(connector.id)
    setError(null)
    try {
      await opportunitiesService.disconnectConnector(context, connector.id)
      setNotice(`Disconnected ${connector.name}`)
      await load(true)
    } catch (err) {
      setError(apiErrorText(err, 'Could not disconnect connector.'))
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (connector: DataConnectorInfo) => {
    if (typeof window !== 'undefined' && !window.confirm(`Are you sure you want to delete "${connector.name}"?`)) {
      return
    }
    setBusyId(connector.id)
    setError(null)
    try {
      await opportunitiesService.deleteConnector(context, connector.id)
      setNotice(`Deleted connector "${connector.name}".`)
      await load(true)
    } catch (err) {
      setError(apiErrorText(err, 'Could not delete connector.'))
    } finally {
      setBusyId(null)
    }
  }

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

  // Overview metrics
  const metrics = useMemo(() => {
    const total = connectors.length
    const active = connectors.filter((c) => c.connection_status === 'connected' && c.sync_enabled).length
    let totalIngested = 0
    connectors.forEach((c) => {
      c.history.forEach((h) => {
        totalIngested += h.records_created || 0
      })
    })
    return {
      total,
      active,
      totalIngested,
    }
  }, [connectors])

  return (
    <section aria-labelledby="connectors-heading" className="space-y-4">
      {/* Executive Card Header & Overview */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Globe className="size-5" />
              </div>
              <div>
                <h2 id="connectors-heading" className="text-base font-bold text-foreground flex items-center gap-2">
                  Data Connectors & Automated Ingestion
                  <Badge variant="outline" className="text-[10px] font-semibold border-primary/40 text-primary">
                    Enterprise
                  </Badge>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Connect official APIs, RSS streams, and public pages to monitor high-intent buying signals in real time.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={refreshing || loading}
              className="gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setCreateDialogOpen(true)}
              className="gap-1.5 font-semibold shadow-xs"
            >
              <Plus className="size-3.5" />
              Add Connector
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

        {/* Engine mode pill */}
        {!tablesMigrated && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs text-foreground">
            <Zap className="size-4 text-primary shrink-0" />
            <div className="flex-1">
              <span className="font-semibold text-primary">Interactive Ingestion Hub Active: </span>
              Connectors are fully operational with instant sync, local persistence, and finding generation.
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* KPI Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Connectors</div>
            <div className="text-xl font-bold text-foreground mt-0.5">{metrics.total}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Configured pipelines</div>
          </div>

          <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Active & Synced
            </div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{metrics.active}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Live monitoring</div>
          </div>

          <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Signals Ingested</div>
            <div className="text-xl font-bold text-primary mt-0.5">{metrics.totalIngested}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">High-intent findings</div>
          </div>

          <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Ingestion Engine</div>
            <div className="text-sm font-bold text-foreground mt-1 flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-emerald-500" />
              Automated
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Policy & ICP aligned</div>
          </div>
        </div>

        {/* Search & Platform Filter Toolbar */}
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
              All Platforms ({connectors.length})
            </button>
            {Object.entries(PLATFORM_CONFIG).map(([typeKey, cfg]) => {
              const count = connectors.filter((c) => c.type === typeKey).length
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
      </div>

      {/* Connectors List / Cards */}
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
            <h3 className="text-sm font-bold text-foreground">No data connectors found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchQuery || platformFilter !== 'all'
                ? 'No connectors match your current filters. Try resetting the search or platform tab.'
                : 'Connect your corporate website, procurement portals, LinkedIn, YouTube or news channels to start ingesting buying signals.'}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="gap-1.5 font-semibold"
          >
            <Plus className="size-3.5" />
            Add First Connector
          </Button>
        </div>
      ) : (
        <div className="grid gap-3.5">
          {filteredConnectors.map((connector) => {
            const platform = PLATFORM_CONFIG[connector.type] || PLATFORM_CONFIG.public_web_page
            const Icon = platform.icon
            const isBusy = busyId === connector.id
            const isTesting = testingId === connector.id
            const testResult = testResults[connector.id]
            const historyOpen = Boolean(expandedHistory[connector.id])
            const targetDisplay = connector.account_name || connector.url || (connector.external_account_id ? `Org ID: ${connector.external_account_id}` : null)
            const targetHref = connector.url || (connector.external_account_id ? `https://linkedin.com/company/${connector.external_account_id}` : null)

            const isConnected = connector.connection_status === 'connected'
            const isRateLimited = connector.connection_status === 'rate_limited'

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

                        {/* Connection Status Badge */}
                        {isConnected ? (
                          <Badge variant="success" className="text-[10px] gap-1 px-2 py-0.5">
                            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Connected
                          </Badge>
                        ) : isRateLimited ? (
                          <Badge variant="warning" className="text-[10px]">
                            Rate Limited
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Disconnected
                          </Badge>
                        )}

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

                  {/* Top-Right Action Controls */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Sync Now */}
                    <Button
                      type="button"
                      size="sm"
                      disabled={isBusy || !connector.sync_enabled}
                      onClick={() => void handleSyncNow(connector)}
                      className="gap-1.5 text-xs font-semibold"
                    >
                      {isBusy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3.5" />
                      )}
                      Sync Now
                    </Button>

                    {/* Test Connection */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isTesting || isBusy}
                      onClick={() => void handleTestConnection(connector)}
                      title="Test reachability & latency"
                      className="gap-1.5 text-xs"
                    >
                      {isTesting ? <Loader2 className="size-3.5 animate-spin" /> : <Wifi className="size-3.5" />}
                      Test
                    </Button>

                    {/* Connect / Disconnect */}
                    {!isConnected ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => void handleConnect(connector)}
                        className="text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                      >
                        Connect
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => void handleDisconnect(connector)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Disconnect
                      </Button>
                    )}

                    {/* Schedule */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setScheduleConnector(connector)}
                      title="Configure auto-sync schedule"
                      className="text-xs"
                    >
                      <Clock3 className="size-3.5 mr-1" />
                      Schedule
                    </Button>

                    {/* Configure */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditConnector(connector)}
                      title="Edit connector details"
                      className="text-xs"
                    >
                      <Settings2 className="size-3.5 mr-1" />
                      Edit
                    </Button>

                    {/* Delete */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => void handleDelete(connector)}
                      title={`Delete ${connector.name}`}
                      className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Test Result Notice */}
                {testResult && (
                  <div
                    className={`rounded-xl border px-3 py-2 text-xs flex items-center justify-between ${
                      testResult.healthy
                        ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
                        : 'border-destructive/30 bg-destructive/5 text-destructive'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {testResult.healthy ? (
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                      ) : (
                        <XCircle className="size-4 shrink-0 text-destructive" />
                      )}
                      <span>{testResult.message}</span>
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

                {/* Last Error banner */}
                {connector.last_error && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" />
                    <span className="flex-1">{connector.last_error}</span>
                  </div>
                )}

                {/* Metadata & Stats Strip */}
                <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 pt-2 border-t border-border/60 text-xs text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>
                      <strong className="text-foreground">Product:</strong> {connector.product_key.toUpperCase()}
                      {connector.offer_id ? ` · Offer: ${connector.offer_id}` : ' · Whole Product'}
                    </span>
                    <span>
                      <strong className="text-foreground">Region:</strong>{' '}
                      {connector.regions && connector.regions.length > 0
                        ? connector.regions.map((r) => [r.country, r.state].filter(Boolean).join('/')).join(', ')
                        : 'Pan-India'}
                    </span>
                    <span>
                      <strong className="text-foreground">Last Sync:</strong> {formatDate(connector.last_sync_at)}
                    </span>
                    <span>
                      <strong className="text-foreground">Next:</strong> {formatNextDate(connector.next_sync_at)}
                    </span>
                  </div>

                  {/* History Toggle */}
                  {connector.history.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpandedHistory((prev) => ({ ...prev, [connector.id]: !prev[connector.id] }))}
                      className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline ml-auto"
                    >
                      <Activity className="size-3" />
                      <span>{connector.history.length} Sync Runs</span>
                      {historyOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    </button>
                  )}
                </div>

                {/* Collapsible Sync History Table */}
                {historyOpen && connector.history.length > 0 && (
                  <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-2 pt-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Clock3 className="size-3.5 text-primary" />
                        Recent Sync Activity
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
                              <XCircle className="size-3.5 text-destructive" />
                            ) : (
                              <Clock3 className="size-3.5 text-amber-500" />
                            )}
                            <span className="font-semibold text-foreground capitalize">{run.status}</span>
                            <span className="text-[11px] text-muted-foreground">{formatDate(run.started_at)}</span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span>{run.records_fetched} fetched</span>
                            <span>{run.records_processed} processed</span>
                            <span className="font-semibold text-primary">{run.records_created} signals created</span>
                            {run.error_message && (
                              <span className="text-destructive max-w-xs truncate" title={run.error_message}>
                                {run.error_message}
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

      {/* Add / Edit Dialog */}
      <ConnectorFormDialog
        context={context}
        open={createDialogOpen || Boolean(editConnector)}
        mode={editConnector ? 'edit' : 'create'}
        connector={editConnector}
        products={products ?? null}
        defaultProductKey={productKey ?? null}
        onClose={() => {
          setCreateDialogOpen(false)
          setEditConnector(null)
        }}
        onSaved={() => {
          void load(true)
          setCreateDialogOpen(false)
          setEditConnector(null)
          onSyncCompleted?.()
        }}
      />

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
