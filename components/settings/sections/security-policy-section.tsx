'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { useLaravelContext } from '@/hooks/use-agentic'
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { organizationSettingsService, type OrgSettingsResponse } from '@/services/organization/settings'
import { Field, SaveButton, SectionBlock, SectionError, SectionSkeleton, ToggleRow } from './section-primitives'

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

type DirtyReporter = {
  /** Lets the shell refuse to change section while a draft is unsaved. */
  onDirtyChange?: (id: 'profile' | 'delivery' | 'organization' | 'policy', label: string, dirty: boolean) => void
}

export function SecurityPolicySection({ onDirtyChange }: DirtyReporter = {}) {
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

  // A draft in useState is lost on refresh; warn before that happens.
  useUnsavedGuard(dirty)

  // And tell the shell, which can refuse to change section while this is true.
  useEffect(() => {
    onDirtyChange?.('policy', 'Security policy', dirty)

    // And on unmount: a section swapped out for the loading skeleton while
    // dirty would otherwise leave the flag set, prompting about a draft that
    // is no longer on screen.
    return () => onDirtyChange?.('policy', 'Security policy', false)
  }, [dirty, onDirtyChange])

  if (loading) {
    return (
      <SectionSkeleton rows={3} />
    )
  }

  if (!draft || !stored) {
    return (
      <SectionError
        title="This policy could not be loaded"
        description={error ?? 'It is available to administrators.'}
        onRetry={() => void load()}
      />
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
        /*
         * A BADGE, NOT A GREEN BANNER.
         *
         * "These rules are live" was rendered as `variant="success"`, which made
         * the section look like a form that had just been submitted — every time
         * it was opened, before anybody had touched it. It is a steady-state
         * fact, so it belongs on the title.
         */
        badge={stored.enforced.password_policy ? 'Live' : undefined}
        badgeTitle="Applies to changing your own password, accepting an invite, and resetting a forgotten one."
      >
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

        {/*
          * The one true sentence the deleted "Sessions" card had to offer.
          * A line, under the rules it relates to — not a card of its own.
          */}
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          Sessions do not expire on their own yet, so there is no session length to set here.
          Anybody can end their own under Sign-in &amp; security, and suspending an account signs
          it out everywhere immediately.
        </p>
      </SectionBlock>

      <SectionBlock
        title="Invitation links"
        description="How long a set-password link stays usable after it is created."
        badge={stored.enforced.invite_hours ? undefined : 'Not applied yet'}
        badgeTitle="Saved now. Links currently expire after a fixed 24 hours for every organisation; this applies once that becomes per-organisation."
      >
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
        badge={stored.enforced.otp_login ? undefined : 'Not applied yet'}
        badgeTitle="Saved now. No sign-in path reads this yet, so turning it off does not currently block one-time-code sign-in."
      >
        <div className="space-y-1">
          <ToggleRow
            label="Allow sign-in by one-time code"
            description="Requires an SMS provider under Email & SMS. Turn it off if your organisation only uses passwords."
            checked={draft['security.otp_login_enabled'] === '1'}
            onChange={(value) => set('security.otp_login_enabled', value ? '1' : '0')}
          />
        </div>
      </SectionBlock>

      {/*
        * THE "SESSIONS" BLOCK IS GONE.
        *
        * It was a whole card — heading, description and a full-width banner —
        * whose entire message was that there is nothing to configure. A section
        * that exists to announce its own absence is chrome, not content.
        *
        * What it actually had to say is now one line under the password rules,
        * where somebody reading about security policy will already be looking.
        */}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
        {/*
          * `dirty && !belowFloor` used to be passed straight to SaveButton, which
          * renders the word "Saved" whenever it is not dirty — so holding an
          * invalid minimum showed a grey button reading SAVED while nothing had
          * been saved and nothing could be. The reason is stated instead.
          */}
        {belowFloor && (
          <span className="text-xs text-destructive">
            Fix the minimum length before saving.
          </span>
        )}
        <SaveButton
          dirty={dirty}
          saving={saving}
          saved={saved}
          onClick={() => {
            if (belowFloor) return
            void save()
          }}
          label="Save policy"
        />
      </div>
    </div>
  )
}
