'use client'

import { useState } from 'react'
import { AlertCircle, Check, CheckCircle2, Copy, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import type { LaravelContext } from '@/lib/laravel-context'
import { apiErrorText } from '@/lib/api-messages'
import { buildSavePayload, describeTest, formFor, type ProviderSettings, type SettingsTestResult } from '@/lib/signals/connector-settings'
import { opportunitiesService, type ConnectorProviderInfo, type DataConnectorInfo } from '@/services/signals/opportunities'

type Provider = 'youtube' | 'linkedin' | 'meta'

interface Guide {
  title: string
  /** Short A → B → C steps for getting the app credentials. Empty for platforms that need none. */
  steps: string[]
  idLabel: string
  secretLabel: string
  idPlaceholder: string
  /** What the user must know before pressing Create. */
  afterNote: string
}

const GUIDES: Record<Exclude<DataConnectorInfo['type'], 'public_web_page'>, Guide> = {
  linkedin: {
    title: 'LinkedIn app credentials',
    steps: [
      'Open linkedin.com/developers and create an app. Link it to your company page.',
      'Products tab: request "Community Management API" (LinkedIn must approve it).',
      'Auth tab: under Authorized redirect URLs, add the Callback URL shown below.',
      'Auth tab: copy the Client ID and Primary Client Secret, then paste them here.',
    ],
    idLabel: 'LinkedIn Client ID',
    secretLabel: 'LinkedIn Client Secret',
    idPlaceholder: 'Client ID from the Auth tab',
    afterNote: 'Your Organization ID is the number in linkedin.com/company/NUMBER/admin. Create the connector, then sign in as a page administrator.',
  },
  youtube: {
    title: 'Google (YouTube) app credentials',
    steps: [
      'Open console.cloud.google.com, create a project and enable "YouTube Data API v3".',
      'APIs & Services > Credentials: create an OAuth client ID of type "Web application".',
      'Add the Callback URL shown below as an Authorized redirect URI.',
      'Copy the Client ID and Client Secret, then paste them here.',
    ],
    idLabel: 'Google OAuth Client ID',
    secretLabel: 'Google OAuth Client Secret',
    idPlaceholder: '1234567890-abc.apps.googleusercontent.com',
    afterNote: 'Create the connector, then sign in with the Google account that owns the channel.',
  },
  facebook_page: {
    title: 'Meta (Facebook) app credentials',
    steps: [
      'Open developers.facebook.com and create an app.',
      'Add the "Facebook Login" product and put the Callback URL shown below under Valid OAuth Redirect URIs.',
      'App settings > Basic: copy the App ID and App Secret, then paste them here.',
    ],
    idLabel: 'Meta App ID',
    secretLabel: 'Meta App Secret',
    idPlaceholder: 'Numeric App ID',
    afterNote: 'Create the connector, then sign in and choose the Page. Only people with a role on the Meta app can connect until Meta approves the app.',
  },
  instagram_business: {
    title: 'Meta (Instagram) app credentials',
    steps: [
      'Link your Instagram Business or Creator account to a Facebook Page first.',
      'Open developers.facebook.com, create an app and add "Facebook Login". Put the Callback URL shown below under Valid OAuth Redirect URIs.',
      'App settings > Basic: copy the App ID and App Secret, then paste them here.',
    ],
    idLabel: 'Meta App ID',
    secretLabel: 'Meta App Secret',
    idPlaceholder: 'Numeric App ID',
    afterNote: 'Facebook and Instagram share one Meta app, so you only enter these once. Personal Instagram accounts cannot be read.',
  },
}

const WEB_STEPS = ['Paste the page address below.', 'Choose the product and region.', 'Click Create Connector, then Sync Now.']

/**
 * The "what do I need" card of the Add Connector window: short steps for the chosen platform and, for an administrator whose platform app is not set up,
 * the two credential fields so everything happens in one place. Secrets are sent once to the admin-only settings route and never kept in the browser.
 */
export function ConnectorSetupGuide({
  context,
  type,
  entry,
  ready,
  canManage,
  onReady,
}: {
  context: LaravelContext
  type: DataConnectorInfo['type']
  entry?: ConnectorProviderInfo
  /** Whether this platform's app credentials are in place. */
  ready: boolean
  canManage: boolean
  /** Called after credentials were saved or removed so the parent can unlock or lock Create and refresh readiness. */
  onReady: (type: DataConnectorInfo['type'], ready: boolean) => void
}) {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (type === 'public_web_page') {
    return (
      <Card title="What you need: just a web address">
        <Steps items={WEB_STEPS} />
      </Card>
    )
  }

  const guide = GUIDES[type]
  const provider = (entry?.oauth_provider ?? (type === 'youtube' ? 'youtube' : type === 'linkedin' ? 'linkedin' : 'meta')) as Provider
  const callback = entry?.redirect_uri ?? null

  const save = async () => {
    if (busy) return
    if (!clientId.trim() || !clientSecret.trim()) {
      setError('Enter both the ID and the secret.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await opportunitiesService.saveConnectorSettings(context, provider, { client_id: clientId.trim(), client_secret: clientSecret.trim() })
      setClientSecret('')   // the secret is never kept in the browser
      onReady(type, true)
    } catch (cause) {
      setError(apiErrorText(cause, 'Could not save the credentials.'))
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!callback) return
    try {
      await navigator.clipboard.writeText(callback)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('Could not copy automatically. Select the address and copy it.')
    }
  }

  if (ready) {
    return (
      <Card title={guide.title} chip={<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="size-3.5" /> Ready</span>}>
        <p className="text-xs text-muted-foreground">The app credentials are already in place. Fill in the details below. {guide.afterNote}</p>
        {canManage && <ManageCredentials context={context} type={type} provider={provider} guide={guide} callback={callback} onChanged={(ok) => onReady(type, ok)} />}
      </Card>
    )
  }

  if (!canManage) {
    return (
      <Card title={guide.title} chip={<span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">Setup needed</span>}>
        <p className="text-xs text-muted-foreground">An administrator must add this platform&apos;s app credentials once before accounts can be connected. Ask your administrator, then come back.</p>
      </Card>
    )
  }

  return (
    <Card title={guide.title} chip={<span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">Setup needed (one time)</span>}>
      <Steps items={guide.steps} />
      {callback && (
        <div className="space-y-1">
          <label htmlFor="guide-callback" className="text-xs font-medium text-foreground">Callback URL</label>
          <div className="flex gap-2">
            <Input id="guide-callback" readOnly value={callback} onFocus={(e) => e.currentTarget.select()} className="h-9 bg-background font-mono text-xs" />
            <Button type="button" variant="outline" size="sm" onClick={() => void copy()} className="h-9 shrink-0 gap-1.5 text-xs" aria-label="Copy callback URL">
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      )}
      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="guide-client-id" className="text-xs font-medium text-foreground">{guide.idLabel}</label>
          <Input id="guide-client-id" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder={guide.idPlaceholder} autoComplete="off" spellCheck={false} className="h-9 bg-background text-xs" />
        </div>
        <div className="space-y-1">
          <label htmlFor="guide-client-secret" className="text-xs font-medium text-foreground">{guide.secretLabel}</label>
          <Input id="guide-client-secret" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Paste the secret" autoComplete="new-password" spellCheck={false} className="h-9 bg-background text-xs" />
        </div>
      </div>
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><ShieldCheck className="size-3.5" aria-hidden /> Stored encrypted. The secret is never shown again.</p>
        <Button type="button" size="sm" disabled={busy} onClick={() => void save()} className="h-8 gap-1.5 text-xs font-semibold">
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          Save credentials
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">{guide.afterNote}</p>
    </Card>
  )
}

function Card({ title, chip, children }: { title: string; chip?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {chip}
      </div>
      {children}
    </div>
  )
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-1.5 text-xs text-foreground">
      {items.map((step, i) => (
        <li key={step} className="flex items-start gap-2">
          <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{String.fromCharCode(65 + i)}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  )
}

/**
 * Administrator tools for credentials that are already in place: change them, check them, or remove the ones saved here. An empty secret keeps the saved
 * one, and the mask is never sent as a secret. Loaded on demand so a plain Add Connector never waits for it.
 */
function ManageCredentials({ context, type, provider, guide, callback, onChanged }: {
  context: LaravelContext
  type: DataConnectorInfo['type']
  provider: Provider
  guide: Guide
  callback: string | null
  onChanged: (ready: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState<ProviderSettings | null>(null)
  const [form, setForm] = useState({ clientId: '', clientSecret: '' })
  const [busy, setBusy] = useState<null | 'load' | 'save' | 'test' | 'remove'>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [test, setTest] = useState<SettingsTestResult | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  // Loaded when the section is first opened (from the click, not an effect), so a plain Add Connector never waits for it.
  const toggle = () => {
    const opening = !open
    setOpen(opening)
    if (!opening || settings || busy) return
    setBusy('load'); setError(null)
    opportunitiesService.getConnectorSettings(context)
      .then((res) => {
        const found = res.data.providers.find((p) => p.provider === provider) ?? null
        setSettings(found)
        setForm(formFor(found))
      })
      .catch((cause) => setError(apiErrorText(cause, 'Could not load the saved settings.')))
      .finally(() => setBusy(null))
  }

  const save = async () => {
    if (!settings || busy) return
    const { payload, problems } = buildSavePayload(form, settings)
    if (problems.length > 0) { setError(problems.join(' ')); return }
    setBusy('save'); setError(null); setNotice(null); setTest(null)
    try {
      const res = await opportunitiesService.saveConnectorSettings(context, provider, payload)
      setSettings(res.data)
      setForm({ clientId: res.data.client_id ?? '', clientSecret: '' })   // the secret is never kept in the browser
      setNotice(res.warnings?.[0] ?? 'Saved.')
      onChanged(res.data.valid)
    } catch (cause) {
      setError(apiErrorText(cause, 'Could not save the credentials.'))
    } finally {
      setBusy(null)
    }
  }

  const runTest = async () => {
    if (busy) return
    setBusy('test'); setError(null); setNotice(null)
    try {
      setTest((await opportunitiesService.testConnectorSettings(context, provider)).data)
    } catch (cause) {
      setError(apiErrorText(cause, 'Could not test the credentials.'))
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    setConfirmRemove(false)
    setBusy('remove'); setError(null); setNotice(null); setTest(null)
    try {
      const res = await opportunitiesService.deleteConnectorSettings(context, provider)
      setSettings(res.data)
      setForm({ clientId: '', clientSecret: '' })
      setNotice('Saved credentials removed.')
      onChanged(res.data.valid)
    } catch (cause) {
      setError(apiErrorText(cause, 'Could not remove the saved credentials.'))
    } finally {
      setBusy(null)
    }
  }

  const described = test ? describeTest(test) : null
  return (
    <div className="border-t border-border/60 pt-2.5">
      <button type="button" aria-expanded={open} onClick={toggle} className="text-xs font-medium text-primary hover:underline">
        {open ? 'Hide credentials' : 'Edit, test or remove credentials'}
      </button>
      {open && (
        <div className="mt-2.5 space-y-2.5">
          {busy === 'load' && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Loading...</p>}
          {settings && (
            <>
              <p className="text-[11px] text-muted-foreground">
                {settings.source === 'environment' ? 'These credentials are set on the server. Saving here overrides them for your organisation.' : 'Saved in G2G for your organisation.'}
              </p>
              {callback && <p className="break-all font-mono text-[11px] text-muted-foreground">Callback URL: {callback}</p>}
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor={`manage-id-${type}`} className="text-xs font-medium text-foreground">{guide.idLabel}</label>
                  <Input id={`manage-id-${type}`} value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))} placeholder={guide.idPlaceholder} autoComplete="off" spellCheck={false} className="h-9 bg-background text-xs" />
                </div>
                <div className="space-y-1">
                  <label htmlFor={`manage-secret-${type}`} className="text-xs font-medium text-foreground">{guide.secretLabel}</label>
                  <Input id={`manage-secret-${type}`} type="password" value={form.clientSecret} onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))} placeholder={settings.secret_saved ? (settings.secret_mask ?? '••••••••••••') : 'Paste the secret'} autoComplete="new-password" spellCheck={false} className="h-9 bg-background text-xs" />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">{settings.secret_saved ? 'A secret is saved. Leave the secret empty to keep it, or type a new one to replace it.' : 'Stored encrypted. It cannot be read back after saving.'}</p>
            </>
          )}
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}
          {notice && <p role="status" className="text-xs text-emerald-700 dark:text-emerald-400">{notice}</p>}
          {described && test && (
            <div className="space-y-1 rounded-lg border border-border/70 bg-background px-3 py-2 text-xs" aria-live="polite">
              <p><strong className="text-foreground">Configuration:</strong> <span className="text-muted-foreground">{described.configuration.text}</span></p>
              <p><strong className="text-foreground">Provider:</strong> <span className="text-muted-foreground">{described.provider.text}</span></p>
              <p className="text-muted-foreground">{test.next_step}</p>
            </div>
          )}
          {settings && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                {settings.can_remove && (
                  <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={() => setConfirmRemove(true)} className="h-8 text-xs text-destructive hover:text-destructive">Remove saved</Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => void runTest()} className="h-8 gap-1.5 text-xs">
                  {busy === 'test' && <Loader2 className="size-3.5 animate-spin" />}Test Configuration
                </Button>
                <Button type="button" size="sm" disabled={busy !== null} onClick={() => void save()} className="h-8 gap-1.5 text-xs font-semibold">
                  {busy === 'save' && <Loader2 className="size-3.5 animate-spin" />}Save changes
                </Button>
              </div>
            </div>
          )}
          <ConfirmDialog
            open={confirmRemove}
            onOpenChange={setConfirmRemove}
            title="Remove saved credentials?"
            description="This deletes the credentials saved in G2G for this platform. Credentials set on the server, if any, are not touched. Accounts connected through them may need to be reconnected."
            confirmLabel="Remove credentials"
            busy={busy === 'remove'}
            onConfirm={() => void remove()}
          />
        </div>
      )}
    </div>
  )
}
