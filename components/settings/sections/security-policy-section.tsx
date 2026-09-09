'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Info, ShieldCheck } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { useLaravelContext } from '@/hooks/use-agentic'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { organizationSettingsService, type OrgSettingsResponse } from '@/services/organization/settings'
import { SaveButton } from '@/components/settings/settings-shell'
import { Field, SectionBlock, ToggleRow } from './section-primitives'

/**
 * SECURITY POLICY — including the switch that would have made the backdoor moot.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS SECTION EXISTS BECAUSE OF
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tracing the credential paths turned up a live OTP backdoor: a hardcoded mobile
 * number that always received `123456`, belonging to a real active account. It is
 * gone. But an organisation that does not use SMS sign-in at all had no way to
 * say so, and could not have switched off the path the backdoor lived in.
 *
 * ── THE PASSWORD MINIMUM IS THE ONE THAT ACTUALLY BITES ─────────────────────
 *
 * It is read by `PasswordController::rule()`, the single rule every password
 * path in the product shares — self-service change, invite acceptance, reset.
 * Raising it here takes effect at once, everywhere. It cannot be lowered below
 * eight, because the same rule protects links that reach accounts across the
 * whole platform, and the server enforces that floor as well as this screen.
 *
 * ── THE OTHER TWO ARE STORED, NOT YET READ ──────────────────────────────────
 *
 * `enforced` comes from the server per setting, and each one says so plainly.
 * A security screen is the very last place to imply a control is active when it
 * is not.
 */

type Settings = OrgSettingsResponse['data']

const KEYS = [
  'security.password_min_length',
  'security.password_require_symbol',
  'security.invite_hours',
  'security.otp_login_enabled',
] as const

export function SecurityPolicySection() {
  const resolveContext = useLaravelContext()

  const [stored, setStored] = useState<Settings | null>(null)
  const [draft, setDraft] = useState<Settings['settings'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const context = resolveContext()

    if (!isLaravelContextReady(context)) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await organizationSettingsService.get(context)
      setStored(response.data)
      setDraft(response.data.settings)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'This policy could not be loaded. It is available to administrators.',
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
    if (!draft || !stored) return false

    return KEYS.some((key) => draft[key] !== stored.settings[key])
  }, [draft, stored])

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl bg-muted/40" />
        ))}
      </div>
    )
  }

  if (!draft || !stored) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" aria-hidden="true" />
        <AlertDescription>{error ?? 'This policy could not be loaded.'}</AlertDescription>
      </Alert>
    )
  }

  function set(key: (typeof KEYS)[number], value: string) {
    setSaved(false)
    setDraft((current) => (current ? { ...current, [key]: value } : current))
  }

  async function save() {
    if (!draft) return

    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const changes: Record<string, string> = {}

      for (const key of KEYS) {
        if (draft[key] !== stored?.settings[key]) changes[key] = draft[key]
      }

      const response = await organizationSettingsService.save(resolveContext(), changes)
      setStored(response.data)
      setDraft(response.data.settings)
      setSaved(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This policy could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const minLength = Number(draft['security.password_min_length']) || 8
  const belowFloor = minLength < 8

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {saved && (
        <Alert variant="success">
          <Check className="size-4" aria-hidden="true" />
          <AlertDescription>
            Saved. New passwords across this organisation must meet these rules from now on —
            existing ones are not affected.
          </AlertDescription>
        </Alert>
      )}

      <SectionBlock
        title="Passwords"
        description="Applies wherever anybody in this organisation sets a password."
      >
        {stored.enforced.password_policy && (
          <Alert variant="success" className="mb-4">
            <ShieldCheck className="size-4" aria-hidden="true" />
            <AlertDescription>
              These rules are live. They apply to changing your own password, accepting an invite
              and resetting a forgotten one.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:max-w-md">
          <Field
            label="Minimum length"
            required
            hint="Eight is the product-wide floor and cannot be lowered. Letters and numbers are always required."
          >
            <Input
              inputMode="numeric"
              value={draft['security.password_min_length']}
              onChange={(e) =>
                set('security.password_min_length', e.target.value.replace(/\D/g, '').slice(0, 2))
              }
              aria-invalid={belowFloor}
            />
            {belowFloor && (
              <p className="mt-1 text-xs text-destructive">
                It cannot go below 8 — the same rule protects invitation and reset links.
              </p>
            )}
          </Field>
        </div>

        <div className="mt-3 space-y-1 border-t border-border pt-3">
          <ToggleRow
            label="Also require a symbol"
            description="Something that is not a letter or a number, such as ! or #."
            checked={draft['security.password_require_symbol'] === '1'}
            onChange={(value) => set('security.password_require_symbol', value ? '1' : '0')}
          />
        </div>
      </SectionBlock>

      <SectionBlock
        title="Invitation links"
        description="How long a set-password link stays usable after it is created."
      >
        <NotLiveYet when={!stored.enforced.invite_hours}>
          Stored, but invitation links currently expire after a fixed 24 hours for every
          organisation. This will apply once that becomes per-organisation.
        </NotLiveYet>

        <Field label="Hours before a link expires" hint="Between 1 hour and one week." className="sm:max-w-xs">
          <Input
            inputMode="numeric"
            value={draft['security.invite_hours']}
            onChange={(e) =>
              set('security.invite_hours', e.target.value.replace(/\D/g, '').slice(0, 3))
            }
          />
        </Field>
      </SectionBlock>

      <SectionBlock
        title="Signing in with a one-time code"
        description="Whether people in this organisation may sign in with an SMS code instead of a password."
      >
        <NotLiveYet when={!stored.enforced.otp_login}>
          Stored, but no sign-in path reads this yet. Turning it off does not currently block
          one-time-code sign-in.
        </NotLiveYet>

        <div className="space-y-1">
          <ToggleRow
            label="Allow sign-in by one-time code"
            description="Requires an SMS provider under Email & SMS. Turn it off if your organisation only uses passwords."
            checked={draft['security.otp_login_enabled'] === '1'}
            onChange={(value) => set('security.otp_login_enabled', value ? '1' : '0')}
          />
        </div>
      </SectionBlock>

      <SectionBlock title="Sessions" description="How long somebody stays signed in.">
        <Alert>
          <Info className="size-4" aria-hidden="true" />
          <AlertDescription>
            Sessions in this product do not currently expire on their own, so there is nothing to
            set here yet. Anybody can end their own sessions under <strong>Sign-in &amp;
            security</strong>, and suspending an account now signs it out everywhere immediately.
          </AlertDescription>
        </Alert>
      </SectionBlock>

      <div className="flex justify-end border-t border-border pt-5">
        <SaveButton
          dirty={dirty && !belowFloor}
          saving={saving}
          onClick={save}
          label="Save policy"
        />
      </div>
    </div>
  )
}

/** Rendered from the server's own `enforced` flags — see the section docblock. */
function NotLiveYet({ when, children }: { when: boolean; children: React.ReactNode }) {
  if (!when) return null

  return (
    <Alert className="mb-4">
      <Info className="size-4" aria-hidden="true" />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}
