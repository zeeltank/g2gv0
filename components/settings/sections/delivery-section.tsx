'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Loader2, Mail, Send, ShieldAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useLaravelContext } from '@/hooks/use-agentic'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { apiClient } from '@/services/core'
import { SaveButton } from '@/components/settings/settings-shell'
import { Field, SectionBlock } from './section-primitives'

/**
 * EMAIL & SMS — what makes an invite arrive instead of being copied out by hand.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ONE ROW, TWELVE ORGANISATIONS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `smtp_details` has been per-tenant all along and holds exactly one row, which
 * belongs to tenant 1. That is the whole reason People & access hands out a
 * copyable link: `InviteService` emails when the tenant can send and returns a
 * link when it cannot, and for eleven of twelve tenants it cannot.
 *
 * ── TWO SEPARATE REASONS EMAIL MIGHT NOT ARRIVE ─────────────────────────────
 *
 * Whether the platform PERMITS this organisation to send, and whether the
 * organisation has told us HOW. They are shown apart because an administrator
 * can fix the second and not the first, and a single "email is not working"
 * banner sends them to retype a password that was never the problem.
 *
 * ── THE TEST BUTTON SENDS TO YOU ────────────────────────────────────────────
 *
 * There is no address field. It goes to the signed-in person's own address,
 * because an endpoint that mails anywhere on demand from the organisation's
 * mailbox is a relay, and because the only send that proves anything is one you
 * can go and look for.
 */

type Delivery = {
  email: {
    configured: boolean
    from_address: string | null
    server: string | null
    port: string | null
    /** Whether one is stored. Never the value — see the controller. */
    has_password: boolean
    updated_at: string | null
  }
  /** The platform-level switch, separate from this organisation's own settings. */
  allowed: boolean
  blocked_reason: string | null
  sms: { configured: boolean; endpoint: string | null; active: boolean }
}

export function DeliverySection() {
  const resolveContext = useLaravelContext()

  const [stored, setStored] = useState<Delivery | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({ from_address: '', server: '', port: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const load = useCallback(async () => {
    const context = resolveContext()

    if (!isLaravelContextReady(context)) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await apiClient.get<{ status: number; data: Delivery }>(
        '/organization/delivery',
        { type: 'api', token: context.token },
      )

      setStored(response.data)
      setForm({
        from_address: response.data.email.from_address ?? '',
        server: response.data.email.server ?? '',
        port: response.data.email.port ?? '465',
        // Always blank. Left empty on save, the stored one is kept.
        password: '',
      })
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'These settings could not be loaded. They are available to administrators and HR.',
      )
    } finally {
      setLoading(false)
    }
  }, [resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  const dirty = useMemo(() => {
    if (!stored) return false

    return (
      form.from_address !== (stored.email.from_address ?? '') ||
      form.server !== (stored.email.server ?? '') ||
      form.port !== (stored.email.port ?? '465') ||
      form.password.length > 0
    )
  }, [form, stored])

  function set(field: keyof typeof form, value: string) {
    setSaved(false)
    setTestResult(null)
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const context = resolveContext()

      const response = await apiClient.put<{ status: number; data: Delivery }>(
        '/organization/delivery',
        {
          type: 'api',
          token: context.token,
          from_address: form.from_address,
          server: form.server,
          port: Number(form.port),
          // Omitted entirely when blank, which the server reads as "keep it".
          ...(form.password ? { password: form.password } : {}),
        },
      )

      setStored(response.data)
      setForm((current) => ({ ...current, password: '' }))
      setSaved(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'These settings could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function sendTest() {
    setTesting(true)
    setTestResult(null)

    try {
      const context = resolveContext()
      const response = await apiClient.post<{ status: number; message: string }>(
        '/organization/delivery/test',
        { type: 'api', token: context.token },
      )

      setTestResult({ ok: true, message: response.message })
    } catch (caught) {
      setTestResult({
        ok: false,
        message: caught instanceof Error ? caught.message : 'The test could not be sent.',
      })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl bg-muted/40" />
        ))}
      </div>
    )
  }

  if (error && !stored) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" aria-hidden="true" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/*
        THE TWO REASONS, SEPARATELY.
        Only one of them is this administrator's to fix.
      */}
      {stored && !stored.allowed && (
        <Alert variant="destructive">
          <ShieldAlert className="size-4" aria-hidden="true" />
          <AlertDescription>
            <strong>Sending is switched off for this organisation.</strong> You can fill these
            settings in and they will be kept, but nothing will be sent until the platform
            operator enables it.
            {stored.blocked_reason && (
              <span className="mt-1 block text-xs opacity-80">{stored.blocked_reason}</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {stored && stored.allowed && !stored.email.configured && (
        <Alert>
          <Mail className="size-4" aria-hidden="true" />
          <AlertDescription>
            No mailbox is set up yet, so invitations hand you a link to pass on by hand instead of
            emailing. Fill this in and they will simply arrive.
          </AlertDescription>
        </Alert>
      )}

      {saved && (
        <Alert variant="success">
          <Check className="size-4" aria-hidden="true" />
          <AlertDescription>
            Saved. Send yourself a test below to check it actually works.
          </AlertDescription>
        </Alert>
      )}

      <SectionBlock
        title="Email"
        description="The mailbox this organisation sends invitations and notifications from."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Send from"
            required
            className="sm:col-span-2"
            hint="People will see this address as the sender, and replies go to it."
          >
            <Input
              type="email"
              value={form.from_address}
              onChange={(e) => set('from_address', e.target.value)}
              placeholder="hr@yourcompany.com"
            />
          </Field>

          <Field label="Server" required hint="For example smtp.gmail.com">
            <Input
              value={form.server}
              onChange={(e) => set('server', e.target.value)}
              placeholder="smtp.gmail.com"
            />
          </Field>

          <Field label="Port" required hint="465 for SSL, 587 for TLS.">
            <Input
              inputMode="numeric"
              value={form.port}
              onChange={(e) => set('port', e.target.value.replace(/\D/g, ''))}
              placeholder="465"
            />
          </Field>

          <Field
            label="Password"
            className="sm:col-span-2"
            required={!stored?.email.has_password}
            hint={
              stored?.email.has_password
                ? 'A password is saved. Leave this blank to keep it, or type a new one to replace it.'
                : 'For Gmail and most providers this is an app password, not the account password.'
            }
          >
            <Input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder={stored?.email.has_password ? '••••••••  (unchanged)' : ''}
            />
          </Field>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          The password is never shown again after you save it — not here, and not to anyone else
          with these settings open.
        </p>
      </SectionBlock>

      <SectionBlock
        title="Check it works"
        description="Sends one message to your own address. Nowhere else."
      >
        {testResult && (
          <Alert variant={testResult.ok ? 'success' : 'destructive'} className="mb-4">
            {testResult.ok ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <AlertCircle className="size-4" aria-hidden="true" />
            )}
            <AlertDescription>{testResult.message}</AlertDescription>
          </Alert>
        )}

        <Button
          variant="outline"
          onClick={sendTest}
          disabled={testing || dirty || !stored?.email.configured}
        >
          {testing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
          {testing ? 'Sending…' : 'Send myself a test'}
        </Button>

        {dirty && (
          <p className="mt-2 text-xs text-muted-foreground">
            Save your changes first — a test would go out using the settings that are stored, not
            the ones on screen.
          </p>
        )}
      </SectionBlock>

      <SectionBlock title="SMS" description="Used for one-time sign-in codes.">
        <div
          className={cn(
            'rounded-lg border px-4 py-3 text-sm',
            stored?.sms.configured
              ? 'border-border bg-background text-foreground'
              : 'border-dashed border-border text-muted-foreground',
          )}
        >
          {stored?.sms.configured ? (
            <>
              <p className="font-medium">
                Configured{stored.sms.active ? ' and active' : ' but switched off'}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {stored.sms.endpoint}
              </p>
            </>
          ) : (
            <p>
              No SMS provider is set up, so sign-in by one-time code is not available to this
              organisation. Editing SMS settings from here is not built yet — ask your platform
              operator.
            </p>
          )}
        </div>
      </SectionBlock>

      <div className="flex justify-end border-t border-border pt-5">
        <SaveButton dirty={dirty} saving={saving} onClick={save} label="Save email settings" />
      </div>
    </div>
  )
}
