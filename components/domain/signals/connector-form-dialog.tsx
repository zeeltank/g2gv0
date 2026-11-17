'use client'

import { useMemo, useState } from 'react'
import {
  Globe,
  Check,
  Loader2,
  AlertCircle,
  Clock,
  Sparkles,
  Layers,
  MapPin,
  Building,
} from 'lucide-react'
import {
  PlatformWebIcon,
  PlatformLinkedInIcon,
  PlatformYouTubeIcon,
  PlatformFacebookIcon,
  PlatformInstagramIcon,
} from './platform-icons'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { LaravelContext } from '@/lib/laravel-context'
import { apiErrorText } from '@/lib/api-messages'
import type { ProductInfo } from '@/services/portfolio/types'
import {
  opportunitiesService,
  type ConnectorProviderInfo,
  type DataConnectorInfo,
} from '@/services/signals/opportunities'
import { ConnectorSetupGuide } from './connector-setup-guide'

export interface ConnectorFormDialogProps {
  context: LaravelContext
  open: boolean
  mode: 'create' | 'edit'
  connector?: DataConnectorInfo | null
  products: ProductInfo[] | null
  defaultProductKey?: string | null
  /** Preselect this platform when creating (used by Connector Settings > Connect Account). */
  defaultType?: DataConnectorInfo['type'] | null
  /** Platform readiness from the server, so the form can show whether the app credentials are in place. */
  catalog?: ConnectorProviderInfo[]
  /** Administrators can enter the platform's app credentials right inside this form. */
  canManageSettings?: boolean
  /** Called after credentials were saved here so the screen can refresh readiness. */
  onCredentialsSaved?: () => void
  onClose: () => void
  onSaved: (saved: DataConnectorInfo) => void
}

const PLATFORMS: {
  type: DataConnectorInfo['type']
  name: string
  desc: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  border: string
  urlPlaceholder: string
}[] = [
  {
    type: 'public_web_page',
    name: 'Public Website or News',
    desc: 'Monitor institutional websites, tender portals, news releases and articles',
    icon: PlatformWebIcon,
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-50 dark:bg-teal-950/30',
    border: 'border-teal-200 dark:border-teal-800',
    urlPlaceholder: 'https://example.com/press-releases-or-tenders',
  },
  {
    type: 'linkedin',
    name: 'LinkedIn Organization',
    desc: 'Monitor corporate announcements, executive hiring, and business updates',
    icon: PlatformLinkedInIcon,
    color: 'text-[#0077b5]',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    urlPlaceholder: 'Numeric LinkedIn Organization ID (e.g. 1337482)',
  },
  {
    type: 'youtube',
    name: 'YouTube Channel',
    desc: 'Scan keynote presentations, webinars, product demos and public briefings',
    icon: PlatformYouTubeIcon,
    color: 'text-[#ff0000]',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    urlPlaceholder: 'https://youtube.com/@channelName',
  },
  {
    type: 'facebook_page',
    name: 'Facebook Page',
    desc: 'Scan community initiatives, regional updates, and partner events',
    icon: PlatformFacebookIcon,
    color: 'text-[#1877f2]',
    bg: 'bg-indigo-50 dark:bg-indigo-950/30',
    border: 'border-indigo-200 dark:border-indigo-800',
    urlPlaceholder: 'https://facebook.com/PageName',
  },
  {
    type: 'instagram_business',
    name: 'Instagram Professional',
    desc: 'Monitor campaign launches, marketing activations, and brand partnerships',
    icon: PlatformInstagramIcon,
    color: 'text-[#e1306c]',
    bg: 'bg-pink-50 dark:bg-pink-950/30',
    border: 'border-pink-200 dark:border-pink-800',
    urlPlaceholder: 'https://instagram.com/businessAccount',
  },
]

const REGION_PRESETS = [
  { label: 'Pan-India', value: 'India' },
  { label: 'Delhi NCR', value: 'India | Delhi' },
  { label: 'Maharashtra / Mumbai', value: 'India | Maharashtra' },
  { label: 'Karnataka / Bangalore', value: 'India | Karnataka' },
  { label: 'All Global', value: 'Global' },
]

function parseRegions(value: string): DataConnectorInfo['regions'] {
  const trimmed = value.trim()
  if (!trimmed) return [{ country: 'India', state: null, city: null }]
  return trimmed.split(';').flatMap((chunk) => {
    const [country, state, city] = chunk.split('|').map((p) => p.trim())
    return country ? [{ country, state: state || null, city: city || null }] : []
  })
}

function stringifyRegions(regions: DataConnectorInfo['regions']): string {
  if (!regions || regions.length === 0) return 'India'
  return regions.map((r) => [r.country, r.state, r.city].filter(Boolean).join(' | ')).join('; ')
}

/**
 * The Radix Dialog and its content stay mounted while `open` changes, so the close animation plays. The form lives
 * INSIDE DialogContent, which Radix mounts when the dialog opens and unmounts only after the exit animation ends.
 * Each open therefore starts from fresh state taken from the props, with no reset-state-in-an-effect (which React's
 * lint rules reject).
 */
export function ConnectorFormDialog(props: ConnectorFormDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={(val) => { if (!val) props.onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:rounded-2xl p-6">
        <ConnectorFormBody {...props} />
      </DialogContent>
    </Dialog>
  )
}

function ConnectorFormBody({
  context,
  mode: modeProp,
  connector: connectorProp,
  products,
  defaultProductKey,
  defaultType,
  catalog,
  canManageSettings = false,
  onCredentialsSaved,
  onClose,
  onSaved,
}: ConnectorFormDialogProps) {
  // Frozen at mount: the parent clears its selected connector the moment the dialog starts closing, and the
  // fading-out form must not change title or fields while it animates away.
  const [{ mode, connector }] = useState(() => ({ mode: modeProp, connector: connectorProp }))
  const isEdit = mode === 'edit'

  const editing = isEdit && connector ? connector : null
  const initialProduct = editing?.product_key ?? (defaultProductKey || (products && products.length > 0 ? products[0].key : 'g2g'))
  const [type, setType] = useState<DataConnectorInfo['type']>(editing?.type ?? defaultType ?? 'public_web_page')
  const [name, setName] = useState(editing?.name ?? '')
  const [url, setUrl] = useState(editing?.url ?? '')
  const [accountId, setAccountId] = useState(editing?.external_account_id ?? '')
  const [productKey, setProductKey] = useState(initialProduct)
  const [offerId, setOfferId] = useState(editing?.offer_id ?? '')
  const [customerModel, setCustomerModel] = useState<DataConnectorInfo['customer_model']>(editing?.customer_model ?? 'b2b')
  const [regionText, setRegionText] = useState(editing ? stringifyRegions(editing.regions) : 'India')
  const [syncEnabled, setSyncEnabled] = useState(editing?.sync_enabled ?? true)
  const [scheduleEnabled, setScheduleEnabled] = useState(editing?.schedule_enabled ?? true)
  const [intervalMinutes, setIntervalMinutes] = useState(editing?.schedule_interval_minutes || 60)
  const [timezone, setTimezone] = useState(editing?.schedule_timezone || 'Asia/Kolkata')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Platforms whose app credentials were saved from inside this form (the server list is refreshed too, but this unlocks Create at once).
  const [savedHere, setSavedHere] = useState<string[]>([])

  // Determine available product key
  const availableProductKey = useMemo(() => {
    if (productKey) return productKey
    if (defaultProductKey) return defaultProductKey
    if (products && products.length > 0) return products[0].key
    return 'g2g'
  }, [productKey, defaultProductKey, products])

  // Get offers for chosen product
  const activeProduct = useMemo(() => {
    return products?.find((p) => p.key === availableProductKey) ?? null
  }, [products, availableProductKey])

  const selectedPlatform = PLATFORMS.find((p) => p.type === type) || PLATFORMS[0]
  const catalogEntry = catalog?.find((entry) => entry.key === type)
  const isOAuth = type !== 'public_web_page'
  const credentialsReady = !isOAuth || catalogEntry?.ready !== false || savedHere.includes(type)
  const blockedByCredentials = !isEdit && isOAuth && !credentialsReady

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    if (blockedByCredentials) {
      setError('Save the app credentials for this platform first (see the setup card above).')
      return
    }

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Please provide a name for this connector.')
      return
    }

    const trimmedUrl = url.trim()
    const trimmedAccountId = accountId.trim()

    if (type === 'public_web_page') {
      if (!trimmedUrl) {
        setError('Please provide a valid website URL.')
        return
      }
      if (!/^https?:\/\//i.test(trimmedUrl)) {
        setError('URL must start with http:// or https://')
        return
      }
    } else if (type === 'linkedin') {
      if (!trimmedAccountId) {
        setError('LinkedIn requires a numeric Organization ID.')
        return
      }
      if (!/^\d+$/.test(trimmedAccountId)) {
        setError('LinkedIn Organization ID must consist of digits only (e.g. 1337482).')
        return
      }
    }

    setSaving(true)
    setError(null)

    try {
      const regions = parseRegions(regionText)
      const chosenOfferId = offerId.trim() || null

      if (isEdit && connector) {
        const res = await opportunitiesService.updateConnector(context, connector.id, {
          name: trimmedName,
          ...(type === 'public_web_page' ? { url: trimmedUrl } : {}),
          ...(type === 'linkedin' ? { external_account_id: trimmedAccountId } : {}),
          product_key: availableProductKey,
          offer_id: chosenOfferId,
          customer_model: customerModel,
          regions,
        })

        // Also update schedule if changed
        await opportunitiesService.saveConnectorSchedule(context, connector.id, {
          sync_enabled: syncEnabled,
          schedule_enabled: scheduleEnabled,
          schedule_interval_minutes: intervalMinutes,
          schedule_timezone: timezone,
        })

        onSaved(res.data)
      } else {
        const res = await opportunitiesService.createConnector(context, {
          type,
          name: trimmedName,
          ...(type === 'public_web_page' ? { url: trimmedUrl } : {}),
          ...(type === 'linkedin' ? { external_account_id: trimmedAccountId } : {}),
          product_key: availableProductKey,
          offer_id: chosenOfferId,
          customer_model: customerModel,
          regions,
        })

        if (res.data) {
          await opportunitiesService.saveConnectorSchedule(context, res.data.id, {
            sync_enabled: syncEnabled,
            schedule_enabled: scheduleEnabled,
            schedule_interval_minutes: intervalMinutes,
            schedule_timezone: timezone,
          })
        }

        onSaved(res.data)
      }
      onClose()
    } catch (err) {
      setError(apiErrorText(err, 'Could not save data connector.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
        <DialogHeader className="space-y-1.5 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${selectedPlatform.bg} ${selectedPlatform.color}`}>
              <selectedPlatform.icon className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                {isEdit ? 'Configure Data Connector' : 'Add New Data Connector'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Connect and continuously ingest public intelligence, news feeds, and platform activity directly into your opportunity pipeline.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <p className="flex-1">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Step 1: Platform Selection */}
          {!isEdit && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Globe className="size-3.5" />
                1. Select Platform
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PLATFORMS.map((plat) => {
                  const Icon = plat.icon
                  const isSelected = type === plat.type
                  return (
                    <button
                      key={plat.type}
                      type="button"
                      onClick={() => {
                        setType(plat.type)
                        if (!name || PLATFORMS.some((p) => p.name === name)) {
                          setName(`${plat.name} Stream`)
                        }
                      }}
                      className={`flex items-start gap-3 p-3 text-left rounded-xl border transition-all ${
                        isSelected
                          ? `${plat.border} ${plat.bg} ring-2 ring-primary/30 shadow-xs`
                          : 'border-border/70 hover:border-border hover:bg-muted/40'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${plat.bg} ${plat.color} shrink-0`}>
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground">{plat.name}</span>
                          {isSelected && <Check className="size-3.5 text-primary" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{plat.desc}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* What this platform needs, in short steps, with the one-time credentials entered right here */}
          {!isEdit && (
            <ConnectorSetupGuide
              key={type}
              context={context}
              type={type}
              entry={catalogEntry}
              ready={credentialsReady}
              canManage={canManageSettings}
              onReady={(done, ok) => {
                setSavedHere((list) => (ok ? (list.includes(done) ? list : [...list, done]) : list.filter((t) => t !== done)))
                setError(null)
                onCredentialsSaved?.()
              }}
            />
          )}

          {/* Step 2: Connector Identity & Target */}
          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              2. Connector Identity & Target
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-foreground">
                  Connector Name <span className="text-destructive">*</span>
                </label>
                <Input
                  required
                  maxLength={191}
                  placeholder="e.g. Industry Procurement Monitor, MoE Announcements"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-background"
                />
              </div>

              {type === 'public_web_page' ? (
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-foreground">
                    Public Web Page or Article URL <span className="text-destructive">*</span>
                  </label>
                  <Input
                    required
                    type="url"
                    placeholder="https://example.com/tenders-or-press-releases"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="bg-background"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Direct web URL to crawl and ingest. Content is evaluated against your product qualifications.
                  </p>
                </div>
              ) : type === 'linkedin' ? (
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-foreground">
                    LinkedIn Organization ID <span className="text-destructive">*</span>
                  </label>
                  <Input
                    required
                    inputMode="numeric"
                    placeholder="e.g. 1337482"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="bg-background"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Find your Organization ID in your LinkedIn Page URL or page administration dashboard.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground sm:col-span-2">
                  After you click Create &amp; Connect, you will sign in with {selectedPlatform.name} and choose the account to monitor.
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Product & Market Scope */}
          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="size-3.5" />
              3. Target Product & Opportunity Scope
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Product selection */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground flex items-center gap-1">
                  <Building className="size-3 text-muted-foreground" />
                  Main Product
                </label>
                <select
                  value={availableProductKey}
                  onChange={(e) => {
                    setProductKey(e.target.value)
                    setOfferId('')
                  }}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {products && products.length > 0 ? (
                    products.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))
                  ) : (
                    <option value="g2g">G2G</option>
                  )}
                </select>
              </div>

              {/* Offer selection */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                  Sub-Product (Offer Scope)
                </label>
                <select
                  value={offerId}
                  onChange={(e) => setOfferId(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Whole Product (All Sub-Product Offers)</option>
                  {activeProduct?.offers?.map((off) => (
                    <option key={off.offer_id} value={off.offer_id}>
                      {off.name} ({off.offer_id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer model selection */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-foreground">
                  Customer Model
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['b2b', 'b2c', 'b2g'] as const).map((m) => {
                    const active = customerModel === m
                    const label = m === 'b2b' ? 'B2B Enterprise' : m === 'b2g' ? 'B2G Government' : 'B2C Consumer'
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setCustomerModel(m)}
                        className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                          active
                            ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                            : 'border-border bg-background text-foreground hover:bg-muted'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Region scope */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3 text-muted-foreground" />
                    Target Region Scope
                  </span>
                  <span className="text-[11px] text-muted-foreground">Format: Country | State | City</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {REGION_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setRegionText(preset.value)}
                      className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors ${
                        regionText === preset.value
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-border/80 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <Input
                  value={regionText}
                  onChange={(e) => setRegionText(e.target.value)}
                  placeholder="e.g. India | Maharashtra | Mumbai"
                  className="bg-background"
                />
              </div>
            </div>
          </div>

          {/* Step 4: Automated Schedule */}
          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="size-3.5" />
              4. Automated Ingestion & Schedule
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-background cursor-pointer hover:bg-muted/30">
                <input
                  type="checkbox"
                  checked={syncEnabled}
                  onChange={(e) => setSyncEnabled(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary size-4"
                />
                <div>
                  <span className="text-xs font-medium text-foreground block">Enable Ingestion</span>
                  <span className="text-[11px] text-muted-foreground">Active for automated and on-demand sync</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-background cursor-pointer hover:bg-muted/30">
                <input
                  type="checkbox"
                  checked={scheduleEnabled}
                  onChange={(e) => setScheduleEnabled(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary size-4"
                />
                <div>
                  <span className="text-xs font-medium text-foreground block">Scheduled Auto-Sync</span>
                  <span className="text-[11px] text-muted-foreground">Poll feed automatically in background</span>
                </div>
              </label>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Sync Interval</label>
                <select
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                  disabled={!scheduleEnabled}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  <option value={15}>Every 15 minutes</option>
                  <option value={30}>Every 30 minutes</option>
                  <option value={60}>Every 1 hour (Recommended)</option>
                  <option value={360}>Every 6 hours</option>
                  <option value={720}>Every 12 hours</option>
                  <option value={1440}>Every 24 hours (Daily)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Timezone</label>
                <Input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="Asia/Kolkata"
                  className="bg-background"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || blockedByCredentials} className="gap-2">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {isEdit ? 'Save Changes' : isOAuth ? 'Create & Connect' : 'Create Connector'}
            </Button>
          </div>
        </form>
    </>
  )
}
