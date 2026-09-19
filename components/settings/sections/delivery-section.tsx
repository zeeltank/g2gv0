'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Loader2, Send, ShieldAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useLaravelContext } from '@/hooks/use-agentic'
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { apiClient } from '@/services/core'
import { Field, SaveButton, SectionBlock, SectionError, SectionSkeleton } from './section-primitives'

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

type DirtyReporter = {
  /** Lets the shell refuse to change section while a draft is unsaved. */
  onDirtyChange?: (id: 'profile' | 'delivery' | 'organization' | 'policy', label: string, dirty: boolean) => void
}

export function DeliverySection({ onDirtyChange }: DirtyReporter = {}) {
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

  /*
   * VALIDATION, BECAUSE THE ASTERISKS WERE DECORATIVE.
   *
   * Three fields here are marked `required` and none of them was checked. Saving
   * with all three blank sent empty strings to the server, which stored them —
   * so an organisation could go from "no mailbox" to "a mailbox that is three
   * empty strings", and the only visible difference was that the badge stopped
   * saying "Not set up".
   *
   * Each message says what to do rather than what is wrong: "Type the address
   * people should see", not "This field is required".
   *
   * A note on the email rule: it deliberately only checks for one `@` with
   * something either side and no spaces. A stricter regex rejects addresses that
   * are perfectly valid, and the authority on whether an address works is the
   * mail server, not this function. The only thing worth catching here is an
   * obvious typo before a round trip.
   */
  const problems = useMemo(() => {
    const found: Record<string, string> = {}

    if (!form.from_address.trim()) {
      found.from_address = 'Type the address people should see messages coming from.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.from_address.trim())) {
      found.from_address = 'That does not look like an email address — check for a typo.'
    }

    if (!form.server.trim()) {
      found.server = 'Your email provider gives you this — for Gmail it is smtp.gmail.com.'
    } else if (/\s/.test(form.server.trim())) {
      found.server = 'A server name has no spaces in it.'
    }

    const port = Number(form.port)

    if (!form.port) found.port = 'Usually 465 or 587.'
    else if (!Number.isInteger(port) || port < 1 || port > 65535) {
      found.port = 'A port is a number between 1 and 65535.'
    }

    // Only on the first setup. Afterwards blank means "keep the stored one",
    // which is the whole reason the field starts empty every time.
    if (!stored?.email.has_password && !form.password) {
      found.password = 'Needed the first time. For Gmail this is an app password.'
    }

    return found
  }, [form, stored])

  /*
   * Only shown after an attempt. Red text under every field the moment the
   * section opens — before anybody has typed anything — is how a form tells
   * somebody they have already failed.
   */
  const [attempted, setAttempted] = useState(false)
  const shown = attempted ? problems : {}
  const valid = Object.keys(problems).length === 0

  // A draft in useState is lost on refresh; warn before that happens.
  useUnsavedGuard(dirty)

  // And tell the shell, which can refuse to change section while this is true.
  useEffect(() => {
    onDirtyChange?.('delivery', 'Email & SMS', dirty)

    // And on unmount: a section swapped out for the loading skeleton while
    // dirty would otherwise leave the flag set, prompting about a draft that
    // is no longer on screen.
    return () => onDirtyChange?.('delivery', 'Email & SMS', false)
  }, [dirty, onDirtyChange])

  function set(field: keyof typeof form, value: string) {
    setSaved(false)
    setTestResult(null)
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function save() {
    setAttempted(true)

    // Refuses here rather than disabling the button: a disabled Save with no
    // explanation is the thing people report as "the button does nothing".
    if (!valid) return

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
      <SectionSkeleton rows={3} />
    )
  }

  if (error && !stored) {
    return (
      <SectionError
        title="These settings could not be loaded"
        description={error}
        onRetry={() => void load()}
      />
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

      <SectionBlock
        title="Email"
        description={
          stored?.email.configured
            ? 'The mailbox this organisation sends invitations and notifications from.'
            : 'Not set up yet, so invitations hand you a link to pass on by hand. Fill this in and they will simply arrive.'
        }
        /*
         * A BADGE, NOT A BANNER.
         *
         * Per this file's own note, eleven of twelve organisations have no
         * mailbox — so the "no mailbox yet" Alert fired on almost every first
         * visit, above the very fields that fix it. The state belongs on the
         * title and the instruction belongs in the description.
         */
        badge={stored?.email.configured ? undefined : 'Not set up'}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Send from"
            required
            className="sm:col-span-2"
            hint="People will see this address as the sender, and replies go to it."
            error={shown.from_address}
          >
            <Input
              type="email"
              value={form.from_address}
              onChange={(e) => set('from_address', e.target.value)}
              placeholder="hr@yourcompany.com"
            />
          </Field>

          <Field label="Server" required hint="For example smtp.gmail.com" error={shown.server}>
            <Input
              value={form.server}
              onChange={(e) => set('server', e.target.value)}
              placeholder="smtp.gmail.com"
            />
          </Field>

          <Field label="Port" required hint="465 for SSL, 587 for TLS." error={shown.port}>
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
            error={shown.password}
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

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            The password is never shown again after you save it.
          </p>
          {saved && (
            <span className="flex items-center gap-1.5 text-xs text-success">
              <Check className="size-3.5" aria-hidden="true" />
              Saved — send yourself a test below
            </span>
          )}
        </div>
      </SectionBlock>

      {/*
        * THE TEST BUTTON LIVES WITH THE SETTINGS IT TESTS.
        *
        * It had a bordered card of its own, a title, a description, and its
        * disabled reason explained in a paragraph BELOW it — a section's worth of
        * chrome around one button. It now sits under the mailbox fields, where
        * the thing it is testing is, and the reason it is unavailable is on the
        * button itself rather than underneath.
        */}
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
          title={
            dirty
              ? 'Save your changes first — a test uses the settings that are stored, not the ones on screen.'
              : !stored?.email.configured
                ? 'Set up a mailbox above first.'
                : undefined
          }
        >
          {testing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
          {testing ? 'Sending…' : 'Send myself a test'}
        </Button>
      </SectionBlock>

      <SectionBlock
        title="SMS"
        description="Used for one-time sign-in codes."
        badge={stored?.sms.configured ? (stored.sms.active ? 'Active' : 'Switched off') : 'Not set up'}
        badgeTitle={
          stored?.sms.configured
            ? 'Configured by your platform operator.'
            : 'Sign-in by one-time code is unavailable until a provider is configured.'
        }
      >
        {/*
          * The raw endpoint URL used to be printed here as body copy, and the
          * unconfigured state was a dashed box whose paragraph ended "not built
          * yet — ask your platform operator". Both are now one sentence, and the
          * state is a badge on the title.
          */}
        <p className="text-sm text-muted-foreground">
          {stored?.sms.configured
            ? 'Your platform operator manages this. Sign-in by one-time code is available to this organisation.'
            : 'No provider is set up, so sign-in by one-time code is not available. Ask your platform operator to configure one — it cannot be edited here.'}
        </p>
      </SectionBlock>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
        {attempted && !valid && (
          <span className="text-xs text-destructive">
            Check the fields marked above.
          </span>
        )}
        <SaveButton
          dirty={dirty}
          saving={saving}
          saved={saved}
          onClick={save}
          label="Save email settings"
        />
      </div>
    </div>
  )
}
