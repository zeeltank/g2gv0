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
  'security.require_two_factor',
] as const

/**
 * The three answers, in increasing strictness, each with what it actually means.
 *
 * Written out here rather than rendered from `choices.require_two_factor` because
 * the server sends the VALUES and this screen owes the reader the CONSEQUENCE.
 * "administrators" is not self-explanatory: what matters is that it covers the
 * accounts that can change other people's access, which is the sentence below.
 *
 * The server's list is still the authority on what may be SAVED — anything not in
 * `TenantSettings::REQUIRE_TWO_FACTOR` is refused there.
 */
const REQUIRE_CHOICES = [
  {
    value: 'off',
    label: 'Not required',
    description: 'Anybody may turn it on for themselves. Nobody has to.',
  },
  {
    value: 'administrators',
    label: 'Required for administrators',
    description:
      'The accounts that can change other people’s access, roles and pay. Where a stolen password does the most damage.',
  },
  {
    value: 'everyone',
    label: 'Required for everyone',
    description: 'Every active account in this organisation, including new joiners.',
  },
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

  /* ── the two-step verification policy ─────────────────────────────────────── */

  const coverage = stored.two_factor_coverage

  // The DRAFT, so the counts and the warning follow the radio the moment it moves
  // rather than only after a save. `requiring` reads the SAVED value, because the
  // badge describes what is in force, not what is being considered.
  const current = draft['security.require_two_factor'] || 'off'
  const requiring = (stored.settings['security.require_two_factor'] || 'off') !== 'off'

  /**
   * How many people the DRAFT would newly oblige who have not enrolled.
   *
   * Zero when the draft is `off`, and zero when everybody covered already has it
   * on — in both cases there is nothing to warn about, and a warning that appears
   * regardless of the number is one nobody reads.
   */
  const pendingEnrolments = (() => {
    if (current === 'everyone') {
      return coverage.people !== null && coverage.people_enrolled !== null
        ? Math.max(0, coverage.people - coverage.people_enrolled)
        : 0
    }

    if (current === 'administrators') {
      return coverage.administrators !== null && coverage.administrators_enrolled !== null
        ? Math.max(0, coverage.administrators - coverage.administrators_enrolled)
        : 0
    }

    return 0
  })()

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
        {/*
          CORRECTED. This read "Sessions do not expire on their own yet", which was
          true when it was written and is not now: a token is created with a 30-day
          expiry, slid forward on use, and the 9,714 immortal ones were given an
          expiry by migration. A stale reassurance on a security screen is worse
          than no sentence at all.
        */}
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          Sessions end on their own after 30 days without use, and stay alive as long as they are
          used — so there is no session length to set here. Anybody can end their own under
          Sign-in &amp; security, and suspending an account signs it out everywhere immediately.
        </p>
      </SectionBlock>

      {/*
        ══════════════════════════════════════════════════════════════════════
        THE STRONGEST CONTROL ON THIS SCREEN, AND THE ONE THAT CAN HURT
        ══════════════════════════════════════════════════════════════════════

        Placed directly under the password rules because it is the same subject -
        what it takes to prove you are you - and because it is the only setting
        here that changes what people have to DO tomorrow morning.

        Which is why the count is shown rather than left to be discovered. "Require
        it for everyone" reads like a checkbox and behaves like a migration.
      */}
      <SectionBlock
        title="Require two-step verification"
        description="Whether people in this organisation must have a second factor as well as a password."
        badge={requiring ? 'Enforced' : undefined}
        badgeTitle="Anybody covered by this is refused everywhere in the product until they have set it up. They can still sign in, and are sent straight to Sign-in & security."
      >
        <div className="space-y-1">
          {REQUIRE_CHOICES.map((choice) => {
            const covered =
              choice.value === 'everyone'
                ? coverage.people
                : choice.value === 'administrators'
                  ? coverage.administrators
                  : null
            const enrolled =
              choice.value === 'everyone'
                ? coverage.people_enrolled
                : choice.value === 'administrators'
                  ? coverage.administrators_enrolled
                  : null

            return (
              <label
                key={choice.value}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-3 py-3 transition-colors hover:bg-muted/50"
              >
                <input
                  type="radio"
                  name="require-two-factor"
                  value={choice.value}
                  checked={current === choice.value}
                  onChange={() => set('security.require_two_factor', choice.value)}
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{choice.label}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {choice.description}
                  </span>

                  {/*
                    The number, and only where there is one. `covered` is null for
                    "off" because there is nothing to count, and both are null when
                    the count could not be taken — in which case this says nothing
                    rather than showing "null of null".
                  */}
                  {covered !== null && enrolled !== null && (
                    <span
                      className={
                        enrolled < covered
                          ? 'mt-1 block text-xs font-medium text-warning'
                          : 'mt-1 block text-xs text-muted-foreground'
                      }
                    >
                      {enrolled} of {covered} {covered === 1 ? 'person has' : 'have'} it on
                      {enrolled < covered && ` — ${covered - enrolled} would have to set it up`}
                    </span>
                  )}
                </span>
              </label>
            )
          })}
        </div>

        {/*
          Shown only when the draft would newly oblige people who have not enrolled.
          Not a scare: it is the operational consequence, and the person clicking Save
          is not the person who will field the calls.
        */}
        {pendingEnrolments > 0 && (
          <Alert className="mt-4">
            <AlertCircle className="size-4" aria-hidden="true" />
            <AlertDescription>
              {pendingEnrolments} {pendingEnrolments === 1 ? 'person' : 'people'} will be asked to
              set this up before they can carry on working. They can still sign in, and are taken
              straight to Sign-in &amp; security to do it — but tell them first.
            </AlertDescription>
          </Alert>
        )}
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
