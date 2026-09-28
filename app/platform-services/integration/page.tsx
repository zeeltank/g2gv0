'use client'

/**
 * Integrations.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ONE CONSOLE OVER FOUR PREVIOUSLY-SCATTERED SURFACES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Before this screen, "is our email/webhook/AI/calendar connection working" had
 * four different answers in four different places: a read-only panel buried in
 * Task Management settings, an honest 501 from a Google OAuth stub, a real but
 * LMS-only CRUD screen, and nothing at all for anything else. This is the one
 * place that answers it — real status for what already exists, and real save +
 * test for the two providers this round adds.
 *
 * ── SMTP AND WEBHOOK ARE THE ONLY TWO YOU CAN CONFIGURE HERE ────────────────
 *
 * Deliberately. "Test connection" opens an actual SMTP handshake or sends an
 * actual signed HTTP POST — see `SmtpIntegrationTester` / `WebhookIntegrationTester`
 * on the server. K12's equivalent has two providers that save to an in-memory array
 * and always report success without opening a socket; nothing here works that way,
 * which is also why there is no Razorpay/WhatsApp-style provider — those need a
 * vendor account this environment does not have, and faking one would be exactly
 * the K12 defect this project has spent this whole engagement removing.
 */

import { useEffect, useState } from 'react'
import { AlertTriangle, Check, ExternalLink, Loader2, Trash2, X } from 'lucide-react'

import { SectionCard, StatusChip, type ConsoleStatus } from '@/components/shared/console-ui'
import { PlatformGrid } from '@/components/shell/platform-shell'
import { describePlatformError, PlatformApiError } from '@/lib/platform/client'
import {
  deleteIntegration,
  fetchIntegrations,
  saveIntegration,
  testIntegration,
  type IntegrationFieldDef,
  type IntegrationProvider,
  type IntegrationStatus,
} from '@/lib/platform/integrations'

import { PanelError, PanelLoading, RefreshButton } from '../_components/console-parts'
import { ServiceShell } from '../_components/ServiceShell'

const KIND_LABEL: Record<IntegrationProvider['kind'], string> = {
  readonly_env: 'Read-only',
  oauth_stub: 'Not built here',
  crud_existing: 'Managed elsewhere',
  credential: 'Configurable',
}

export default function IntegrationsPage() {
  const [providers, setProviders] = useState<IntegrationProvider[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    fetchIntegrations()
      .then((result) => {
        if (cancelled) return
        setProviders(result.providers)
        setError(null)
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(describePlatformError(cause, 'The integrations could not be loaded.'))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token])

  const reload = () => {
    setLoading(true)
    setToken((value) => value + 1)
  }

  return (
    <ServiceShell slug="integration">
      <div className="mt-6 space-y-4">
        {error && !providers && <PanelError message={error} onRetry={reload} />}
        {loading && !providers && !error && <PanelLoading label="Reading integrations…" />}

        {providers && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {providers.length} declared —{' '}
                {providers.filter((p) => p.status === 'configured').length} configured.
              </p>
              <RefreshButton onClick={reload} busy={loading} />
            </div>

            <PlatformGrid>
              {providers.map((provider) => (
                <ProviderCard key={provider.key} provider={provider} onChanged={reload} />
              ))}
            </PlatformGrid>
          </>
        )}
      </div>
    </ServiceShell>
  )
}

function statusTone(status: IntegrationStatus): ConsoleStatus {
  if (status === 'configured') return 'live'
  if (status === 'error') return 'in-progress'
  return 'coming-soon'
}

function ProviderCard({
  provider,
  onChanged,
}: {
  provider: IntegrationProvider
  onChanged: () => void
}) {
  return (
    <SectionCard
      title={provider.label}
      description={provider.description}
      span={provider.kind === 'credential' ? 2 : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <StatusChip status={statusTone(provider.status)} size="sm" />
        <span className="text-[10px] tracking-wide text-muted-foreground/70 uppercase">
          {KIND_LABEL[provider.kind]}
        </span>
      </div>

      {provider.kind === 'readonly_env' && (
        <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
          Read from{' '}
          <span className="font-mono">{provider.env ?? 'an environment variable'}</span> on the
          server. Set there, not here — this row only reports what is already true.
        </p>
      )}

      {provider.kind === 'oauth_stub' && (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-5 text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          Not configured on this installation. The endpoint behind it fails honestly
          (HTTP 501) rather than erroring.
        </p>
      )}

      {provider.kind === 'crud_existing' && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] leading-5 text-muted-foreground">
            {provider.connected_count ?? 0} connected of {provider.total_count ?? 0} configured for
            this organisation.
          </p>
          {provider.screen && (
            <a
              href={provider.screen}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              Manage in LMS Administration & Governance
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      )}

      {provider.kind === 'credential' && provider.fields && (
        <CredentialForm provider={provider} onChanged={onChanged} />
      )}
    </SectionCard>
  )
}

const inputClass =
  'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring'

function CredentialForm({
  provider,
  onChanged,
}: {
  provider: IntegrationProvider
  onChanged: () => void
}) {
  const fields = provider.fields ?? []

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, field.value == null ? '' : String(field.value)])),
  )
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }))

  const numericFieldsToPayload = (): Record<string, string | number> => {
    const out: Record<string, string | number> = {}
    for (const field of fields) {
      const raw = values[field.key] ?? ''
      out[field.key] = field.type === 'number' && raw !== '' ? Number(raw) : raw
    }
    return out
  }

  const save = async () => {
    setSaving(true)
    setFormError(null)
    setNotice(null)

    try {
      await saveIntegration(provider.key, numericFieldsToPayload())
      onChanged()
    } catch (cause: unknown) {
      setFormError(cause instanceof PlatformApiError ? cause.message : describePlatformError(cause))
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    setTesting(true)
    setFormError(null)
    setNotice(null)

    try {
      const result = await testIntegration(provider.key, numericFieldsToPayload())
      setNotice(result)
    } catch (cause: unknown) {
      setNotice({
        ok: false,
        message: cause instanceof PlatformApiError ? cause.message : describePlatformError(cause),
      })
    } finally {
      setTesting(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(`Remove the saved ${provider.label} configuration?`)) return

    try {
      await deleteIntegration(provider.key)
      onChanged()
    } catch (cause: unknown) {
      setFormError(describePlatformError(cause))
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {formError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-[11px] text-destructive">
          {formError}
        </p>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2">
        {fields.map((field) => (
          <FieldInput key={field.key} field={field} value={values[field.key] ?? ''} onChange={set} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving && <Loader2 className="size-3 animate-spin" />}
          Save
        </button>
        <button
          type="button"
          onClick={test}
          disabled={testing}
          title="Makes a real connection attempt — an SMTP handshake or a signed HTTP POST, not a canned result."
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          {testing && <Loader2 className="size-3 animate-spin" />}
          Test connection
        </button>
        {provider.status !== 'not_configured' && (
          <button
            type="button"
            onClick={remove}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
          >
            <Trash2 className="size-3 text-destructive" />
            Remove
          </button>
        )}
      </div>

      {notice && (
        <p
          className={`flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] leading-5 ${
            notice.ok
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
              : 'border-destructive/30 bg-destructive/5 text-destructive'
          }`}
        >
          {notice.ok ? (
            <Check className="mt-0.5 size-3.5 shrink-0" />
          ) : (
            <X className="mt-0.5 size-3.5 shrink-0" />
          )}
          <span className="break-words">{notice.message}</span>
        </p>
      )}

      {provider.last_tested_at && (
        <p className="text-[11px] text-muted-foreground">
          Last tested {new Date(provider.last_tested_at).toLocaleString()}
          {provider.last_test_message && ` — ${provider.last_test_message}`}
        </p>
      )}
    </div>
  )
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: IntegrationFieldDef
  value: string
  onChange: (key: string, value: string) => void
}) {
  const label = (
    <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
      {field.label}
      {field.required && <span className="ml-0.5 text-destructive">*</span>}
    </span>
  )

  if (field.type === 'select') {
    return (
      <label className="block">
        {label}
        <select value={value} onChange={(event) => onChange(field.key, event.target.value)} className={inputClass}>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    )
  }

  if (field.type === 'password') {
    return (
      <label className="block">
        {label}
        <input
          type="password"
          value={value}
          onChange={(event) => onChange(field.key, event.target.value)}
          placeholder={field.has_value ? '•••• saved — leave blank to keep it' : 'Not set'}
          className={inputClass}
        />
      </label>
    )
  }

  return (
    <label className="block">
      {label}
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(event) => onChange(field.key, event.target.value)}
        className={inputClass}
      />
    </label>
  )
}
