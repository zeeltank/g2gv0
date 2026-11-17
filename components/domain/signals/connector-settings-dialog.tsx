'use client'

import { useState, type FormEvent } from 'react'
import { AlertCircle, Check, CheckCircle2, ChevronDown, Copy, Loader2, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { LaravelContext } from '@/lib/laravel-context'
import { apiErrorText } from '@/lib/api-messages'
import {
  buildSavePayload,
  cardStatus,
  describeTest,
  formFor,
  updatedLabel,
  type ProviderCard,
  type ProviderSettings,
  type SettingsTestResult,
  type Tone,
} from '@/lib/signals/connector-settings'
import { opportunitiesService } from '@/services/signals/opportunities'
import { ApiError } from '@/services/core'
import { ProviderIcon, StatusChip, TONE_TEXT } from './connector-settings-parts'

const FIELDS: Record<ProviderCard['provider'], { id: string; secret: string; idPlaceholder: string; steps: string[] }> = {
  youtube: {
    id: 'Google OAuth Client ID',
    secret: 'Google OAuth Client Secret',
    idPlaceholder: '1234567890-abc.apps.googleusercontent.com',
    steps: [
      'In Google Cloud, enable YouTube Data API v3 and create an OAuth client of type Web application.',
      'Add the callback URL above as an authorised redirect URI.',
      'Paste the client ID and secret here, save, then test.',
    ],
  },
  linkedin: {
    id: 'LinkedIn Client ID',
    secret: 'LinkedIn Client Secret',
    idPlaceholder: 'Client ID from the LinkedIn developer portal',
    steps: [
      'In the LinkedIn developer portal, open your app and add the callback URL above under Authorized redirect URLs.',
      'Request Community Management API access for the app. LinkedIn must approve it before data can be read.',
      'Paste the client ID and secret here, save, then test.',
    ],
  },
  meta: {
    id: 'Meta App ID',
    secret: 'Meta App Secret',
    idPlaceholder: 'Numeric App ID from the Meta dashboard',
    steps: [
      'In the Meta developer dashboard, add Facebook Login to your app and add the callback URL above as a valid OAuth redirect URI.',
      'Add the permissions listed below. Anyone without a role on the app also needs Advanced Access (Business Verification).',
      'Paste the App ID and secret here, save, then test.',
    ],
  },
}

/**
 * Configure one provider's application credentials. Saves through the admin-only backend: the secret is sent once, stored encrypted, and never comes
 * back. An empty secret keeps the saved one. Test Configuration reports this app's settings and the provider's answer separately.
 */
export function ConnectorSettingsDialog({
  context,
  card,
  open,
  onClose,
  onChanged,
  onConnect,
}: {
  context: LaravelContext
  card: ProviderCard | null
  open: boolean
  onClose: () => void
  /** Called with the fresh settings after a save or removal, so the cards update. */
  onChanged: (settings: ProviderSettings) => void
  /** Start the existing connect flow for this card's connector type (opens Add Connector for that platform). */
  onConnect: (type: ProviderCard['connectorType']) => void
}) {
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-lg gap-0 overflow-y-auto p-0 sm:rounded-2xl">
        {card && <SettingsForm key={card.key} context={context} card={card} onClose={onClose} onChanged={onChanged} onConnect={onConnect} />}
      </DialogContent>
    </Dialog>
  )
}

function SettingsForm({ context, card, onClose, onChanged, onConnect }: {
  context: LaravelContext
  card: ProviderCard
  onClose: () => void
  onChanged: (settings: ProviderSettings) => void
  onConnect: (type: ProviderCard['connectorType']) => void
}) {
  const settings = card.settings
  const copy = FIELDS[settings.provider]
  const [form, setForm] = useState(() => formFor(settings))
  const [busy, setBusy] = useState<null | 'save' | 'test' | 'remove'>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<string[]>([])
  const [test, setTest] = useState<SettingsTestResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const status = cardStatus(settings)
  const savedHere = settings.source === 'database'
  const instagram = card.key === 'instagram_business'

  const fail = (cause: unknown, fallback: string) => {
    setError(apiErrorText(cause, fallback))
    const fields: Record<string, string> = {}
    if (cause instanceof ApiError) {
      for (const [name, messages] of Object.entries(cause.errors ?? {})) fields[name] = Array.isArray(messages) ? String(messages[0]) : String(messages)
    }
    setFieldErrors(fields)
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const { payload, problems } = buildSavePayload(form, settings)
    if (problems.length > 0) {
      setError(problems.join(' '))
      setFieldErrors({})
      return
    }
    setBusy('save'); setError(null); setFieldErrors({}); setTest(null)
    try {
      const res = await opportunitiesService.saveConnectorSettings(context, settings.provider, payload)
      setNotes(res.warnings ?? [])
      setForm({ clientId: res.data.client_id ?? '', clientSecret: '' })   // the secret field is emptied: it is never kept in the browser
      onChanged(res.data)
    } catch (cause) {
      fail(cause, 'Could not save the configuration.')
    } finally {
      setBusy(null)
    }
  }

  const runTest = async () => {
    if (busy) return
    setBusy('test'); setError(null); setFieldErrors({})
    try {
      setTest((await opportunitiesService.testConnectorSettings(context, settings.provider)).data)
    } catch (cause) {
      fail(cause, 'Could not test the configuration.')
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    setConfirmRemove(false)
    setBusy('remove'); setError(null); setTest(null)
    try {
      const res = await opportunitiesService.deleteConnectorSettings(context, settings.provider)
      setNotes(res.warnings ?? [])
      setForm({ clientId: '', clientSecret: '' })
      onChanged(res.data)
    } catch (cause) {
      fail(cause, 'Could not remove the saved credentials.')
    } finally {
      setBusy(null)
    }
  }

  const copyCallback = async () => {
    if (!settings.redirect_uri) return
    try {
      await navigator.clipboard.writeText(settings.redirect_uri)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('Could not copy automatically. Select the address and copy it.')
    }
  }

  const described = test ? describeTest(test) : null
  const canConnect = settings.status === 'authorization_required' || settings.status === 'connected'
  const updated = updatedLabel(settings.updated_at)

  return (
    <>
      <DialogHeader className="mb-0 space-y-3 border-b border-border/60 px-6 pb-4 pt-6 text-left">
        <div className="flex items-center gap-3">
          <ProviderIcon card={card} />
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-base font-bold">Configure {card.title}</DialogTitle>
            <DialogDescription className="text-xs">
              {instagram ? 'Instagram uses the same Meta app as Facebook, so these are shared.' : settings.source === 'environment' ? 'Credentials are set on the server. Saving here overrides them for your organisation.' : 'Credentials are stored encrypted and never shown again.'}
            </DialogDescription>
          </div>
          <StatusChip tone={status.tone}>{status.label}</StatusChip>
        </div>
      </DialogHeader>

      <form onSubmit={save} className="space-y-5 px-6 py-5" noValidate>
        {settings.redirect_uri && (
          <div className="space-y-1.5">
            <label htmlFor="cs-callback" className="text-xs font-medium text-foreground">Callback URL</label>
            <div className="flex gap-2">
              <Input id="cs-callback" readOnly value={settings.redirect_uri} className="h-9 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button type="button" variant="outline" size="sm" onClick={() => void copyCallback()} className="h-9 shrink-0 gap-1.5 text-xs" aria-label="Copy callback URL">
                {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Register this exact address with the provider.</p>
          </div>
        )}

        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <label htmlFor="cs-client-id" className="text-xs font-medium text-foreground">{copy.id}</label>
            <Input
              id="cs-client-id"
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
              placeholder={copy.idPlaceholder}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={fieldErrors.client_id ? true : undefined}
              className="h-9 text-xs"
            />
            {fieldErrors.client_id && <p role="alert" className="text-[11px] text-destructive">{fieldErrors.client_id}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cs-client-secret" className="text-xs font-medium text-foreground">{copy.secret}</label>
            <Input
              id="cs-client-secret"
              type="password"
              value={form.clientSecret}
              onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))}
              placeholder={settings.secret_saved ? (settings.secret_mask ?? '••••••••••••') : 'Paste the client secret'}
              autoComplete="new-password"
              spellCheck={false}
              aria-invalid={fieldErrors.client_secret ? true : undefined}
              className="h-9 text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              {settings.secret_saved ? 'A secret is saved. Leave this empty to keep it, or type a new one to replace it.' : 'Stored encrypted. It cannot be read back after saving.'}
            </p>
            {fieldErrors.client_secret && <p role="alert" className="text-[11px] text-destructive">{fieldErrors.client_secret}</p>}
          </div>
          {updated && <p className="text-[11px] text-muted-foreground">{updated}</p>}
        </div>

        <details className="group rounded-xl border border-border/70 bg-muted/20 px-3.5 py-2.5 text-xs">
          <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-foreground">
            Setup guide
            <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-2.5 space-y-2 text-muted-foreground">
            <ol className="list-decimal space-y-1 pl-4">
              {copy.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
            {instagram && <p>Instagram needs a <strong className="text-foreground">Business or Creator</strong> account linked to a Facebook Page. Personal accounts cannot be read.</p>}
            {settings.requirements.length > 0 && <p><strong className="text-foreground">Needs:</strong> {settings.requirements.join('; ')}.</p>}
            {settings.approval && <p><strong className="text-foreground">Approval:</strong> {settings.approval}</p>}
          </div>
        </details>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}
        {notes.map((note) => (
          <div key={note} className="flex items-start gap-2 rounded-xl border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{note}</span>
          </div>
        ))}

        {described && test && (
          <div className="space-y-1.5 rounded-xl border border-border/70 bg-card px-3.5 py-3 text-xs" aria-live="polite">
            <ResultLine label="Configuration" text={described.configuration.text} tone={described.configuration.tone} />
            <ResultLine label="Provider" text={described.provider.text} tone={described.provider.tone} />
            <p className="pt-1 text-muted-foreground"><ShieldCheck className="mr-1 inline size-3.5 align-text-bottom" aria-hidden />{test.next_step}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
          <div>
            {settings.can_remove && (
              <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={() => setConfirmRemove(true)} className="h-9 gap-1.5 text-xs text-destructive hover:text-destructive">
                <Trash2 className="size-3.5" /> Remove
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => void runTest()} className="h-9 gap-1.5 text-xs">
              {busy === 'test' ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
              Test Configuration
            </Button>
            <Button type="submit" size="sm" disabled={busy !== null} className="h-9 gap-1.5 text-xs font-semibold">
              {busy === 'save' && <Loader2 className="size-3.5 animate-spin" />}
              Save Configuration
            </Button>
          </div>
        </div>
        {canConnect && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-primary/5 px-3.5 py-2.5 text-xs">
            <span className="text-muted-foreground">Credentials are in place. Authorize an account to start syncing.</span>
            <Button type="button" size="sm" onClick={() => { onClose(); onConnect(card.connectorType) }} className="h-8 shrink-0 text-xs font-semibold">Connect Account</Button>
          </div>
        )}
      </form>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove saved credentials?"
        description={`This deletes the ${card.title} credentials saved in G2G${settings.provider === 'meta' ? ' (Facebook and Instagram share them)' : ''}. Credentials set on the server, if any, are not touched. Accounts connected through these credentials may need to be reconnected.`}
        confirmLabel="Remove credentials"
        busy={busy === 'remove'}
        onConfirm={() => void remove()}
      />
    </>
  )
}

function ResultLine({ label, text, tone }: { label: string; text: string; tone: Tone }) {
  const Icon = tone === 'success' ? CheckCircle2 : AlertCircle
  return (
    <div className="flex items-start gap-2">
      <Icon className={`mt-0.5 size-3.5 shrink-0 ${TONE_TEXT[tone]}`} aria-hidden />
      <span><strong className="text-foreground">{label}:</strong> <span className="text-muted-foreground">{text}</span></span>
    </div>
  )
}
