'use client'

import { useState } from 'react'
import { Check, Copy, KeyRound, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { useLaravelContext } from '@/hooks/use-agentic'
import { accountService, type TwoFactorEnrolment } from '@/services/account'
import { useAppPreferences } from '@/components/providers/preferences-provider'
import { ConfirmDialog, Field, SectionBlock } from './section-primitives'

/**
 * TURNING TWO-STEP VERIFICATION ON AND OFF.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THREE STATES, AND THE MIDDLE ONE IS THE WHOLE POINT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   off         a button, and one sentence saying what it protects against
 *   enrolling   a secret is stored and does NOT yet protect the account
 *   on          with a count of the recovery codes still unspent
 *
 * `enrolling` exists because the server refuses to enable on a stored secret
 * alone. Without that state, closing this tab halfway would leave the account
 * demanding codes from an app that never received the secret — locking somebody
 * out of their own account by navigating away. Nothing on this screen can do that.
 *
 * ── THERE IS NO QR CODE, AND IT SAYS SO ─────────────────────────────────────
 *
 * No QR encoder exists in either repository, and writing one means Reed-Solomon
 * error correction with no published vectors to check it against. The two paths
 * offered instead need no encoder and cover both devices: on a phone the
 * `otpauth://` link opens the authenticator and enrols in one tap; on a desktop
 * the key is shown in groups of four to be typed in.
 *
 * ── THE RECOVERY CODES ARE SHOWN ONCE, AND THAT IS NOT A LIMITATION ─────────
 *
 * Only hashes are stored, so this screen is the only place they ever exist in
 * readable form. That property is what makes them safe to keep in the database at
 * all — and it is why this screen has to insist somebody saves them, because
 * there is genuinely no second chance to look.
 */
export function TwoFactorBlock() {
  const resolveContext = useLaravelContext()
  const { account, refresh } = useAppPreferences()

  /*
   * Defaulted rather than gated on a load: this comes from the `/account/me`
   * payload the provider already holds, so it is present the moment the section
   * opens. Treating the absent case as "off" is the safe direction — it offers to
   * turn protection on rather than claiming protection that may not be there.
   */
  const status = account?.two_factor ?? {
    enabled: false,
    recovery_codes_left: 0,
    required: false,
  }

  /*
   * OBLIGED BY THE ORGANISATION, AND NOT YET SET UP.
   *
   * This is the state where the rest of the product is returning 403 to every
   * call. The person is not locked out - they signed in, and `/account/me` and the
   * two enrolment endpoints are on `RequireTwoFactorEnrolment`'s allow-list
   * precisely so this screen still works - but everything else is refused until
   * they finish here.
   *
   * So this screen has to be the one that EXPLAINS it. Somebody who sees the
   * product stop working and no reason given will conclude it is broken, and the
   * fix is two clicks away on a page they have no reason to open.
   */
  const mustEnrol = status.required && !status.enabled

  const [enrolment, setEnrolment] = useState<TwoFactorEnrolment | null>(null)
  const [code, setCode] = useState('')
  const [codes, setCodes] = useState<string[] | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<'off' | 'reissue' | null>(null)
  const [password, setPassword] = useState('')

  async function run(work: () => Promise<void>) {
    setBusy(true)
    setError(null)

    try {
      await work()
    } catch (caught) {
      /*
       * The server's own sentence, where there is one. Every failure here has a
       * specific cause a person can act on — a wrong code, a wrong password, too
       * many attempts — and replacing that with "something went wrong" would
       * throw away the only useful part.
       */
      setError(caught instanceof Error ? caught.message : 'That did not work. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const start = () =>
    run(async () => {
      const response = await accountService.twoFactorStart(resolveContext())
      setEnrolment(response.data)
      setCode('')
    })

  const confirm = () =>
    run(async () => {
      const response = await accountService.twoFactorConfirm(resolveContext(), code)
      setCodes(response.data.recovery_codes)
      setEnrolment(null)
      setCopied(false)
      // So the badge and the remaining-codes count are right immediately rather
      // than at the next full page load.
      await refresh()
    })

  const reissue = () =>
    run(async () => {
      const response = await accountService.twoFactorRecoveryCodes(resolveContext(), password)
      setCodes(response.data.recovery_codes)
      setCopied(false)
      setPassword('')
      setConfirming(null)
      await refresh()
    })

  const disable = () =>
    run(async () => {
      await accountService.twoFactorDisable(resolveContext(), password)
      setPassword('')
      setConfirming(null)
      setCodes(null)
      await refresh()
    })

  const closeConfirm = () => {
    setConfirming(null)
    // Never left in state for the next dialog to reuse.
    setPassword('')
  }

  return (
    <SectionBlock
      title="Two-step verification"
      description="A code from your phone as well as your password. The single most effective thing you can turn on here."
      badge={status.enabled ? 'On' : 'Off'}
      badgeTitle={
        status.enabled
          ? `${status.recovery_codes_left} recovery code${status.recovery_codes_left === 1 ? '' : 's'} left`
          : 'Without it, a stolen password is enough to sign in as you.'
      }
    >
      {/* ── obliged, and not yet set up ────────────────────────────────────── */}
      {mustEnrol && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ShieldCheck className="size-4 text-destructive" aria-hidden="true" />
            Your organisation requires this
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {/*
              Says what is happening AND that it is recoverable in one action. The
              alternative - a bare "required by policy" - leaves somebody wondering
              whether their account is broken.
            */}
            Until you set it up, the rest of the product will refuse to load for you. Nothing is
            wrong with your account: finish the three steps below and everything works again.
          </p>
        </div>
      )}

      {/* ── the codes, shown once ──────────────────────────────────────────── */}
      {codes && (
        <div className="mb-4 rounded-lg border border-warning/40 bg-warning/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <KeyRound className="size-4" aria-hidden="true" />
            Save these recovery codes now
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {/*
              Not a suggestion, and not a scare. Only hashes are stored, so this is
              the one and only time these are readable — which is exactly why they
              are safe to keep and why there is no way to show them again.
            */}
            They will not be shown again. Each one works once, and they are how you get back in if
            you lose your phone.
          </p>

          <ul className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-xs tabular-nums sm:grid-cols-5">
            {codes.map((value) => (
              <li key={value} className="rounded bg-card px-2 py-1 text-center">
                {value}
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard
                  .writeText(codes.join('\n'))
                  .then(() => setCopied(true))
                  // Blocked by an insecure origin or a permissions policy. The
                  // codes are on screen and selectable, so this is not a dead end
                  // and does not deserve an error banner.
                  .catch(() => setCopied(false))
              }}
            >
              {copied ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <Copy className="size-4" aria-hidden="true" />
              )}
              {copied ? 'Copied' : 'Copy all'}
            </Button>

            <Button type="button" variant="ghost" size="sm" onClick={() => setCodes(null)}>
              I have saved them
            </Button>
          </div>
        </div>
      )}

      {/* ── off ────────────────────────────────────────────────────────────── */}
      {!status.enabled && !enrolment && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Without it, anybody who learns your password can sign in as you, and nothing else
            stands in their way.
          </p>

          <Button type="button" onClick={start} disabled={busy}>
            <ShieldCheck className="size-4" aria-hidden="true" />
            {busy ? 'Starting…' : 'Set it up'}
          </Button>
        </div>
      )}

      {/* ── enrolling ──────────────────────────────────────────────────────── */}
      {enrolment && (
        <div className="space-y-4">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Open your authenticator app — Google Authenticator, Authy, Microsoft Authenticator,
              or a password manager that handles codes.
            </li>
            <li>
              {/*
                Two paths, because there is no QR: the link is one tap on the phone
                being enrolled, the key is for a desktop. Every authenticator app
                supports both.
              */}
              On a phone,{' '}
              <a href={enrolment.uri} className="font-medium text-primary hover:underline">
                tap here to add it
              </a>
              . On a computer, add an account by hand and type this key in:
            </li>
          </ol>

          <div className="rounded-lg border border-border bg-surface-muted p-3">
            <p className="font-mono text-sm tracking-wide text-foreground">
              {enrolment.secret_grouped}
            </p>
          </div>

          <Field
            label={`Then enter the ${enrolment.digits}-digit code it shows`}
            hint={`The code changes every ${enrolment.period} seconds. If it is refused, wait for the next one.`}
            className="sm:max-w-xs"
          >
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              maxLength={enrolment.digits}
              // Digits only: a pasted code often arrives with a space in it, and
              // refusing that as "wrong" would be this screen's fault, not theirs.
              onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ''))}
              placeholder={'0'.repeat(enrolment.digits)}
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={confirm}
              disabled={busy || code.length !== enrolment.digits}
            >
              {busy ? 'Checking…' : 'Turn it on'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEnrolment(null)
                setError(null)
              }}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>

          {/*
            Said plainly, because the alternative is somebody abandoning this
            halfway and spending the next week wondering whether their account is
            now half-protected.
          */}
          <p className="text-xs text-muted-foreground">
            Nothing changes until you enter a code. If you leave now, your account carries on as
            it is.
          </p>
        </div>
      )}

      {/* ── on ─────────────────────────────────────────────────────────────── */}
      {status.enabled && !enrolment && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <Smartphone className="size-4 text-success" aria-hidden="true" />
            You will be asked for a code from your authenticator app when you sign in.
          </p>

          {/*
            A warning rather than a number once they are nearly gone. Somebody with
            one code left is one lost phone away from needing an administrator to
            vouch for them, and a grey caption does not carry that.
          */}
          {status.recovery_codes_left <= 2 ? (
            <StatusBadge variant="warning" size="sm">
              {status.recovery_codes_left === 0
                ? 'No recovery codes left'
                : `Only ${status.recovery_codes_left} recovery code${status.recovery_codes_left === 1 ? '' : 's'} left`}
            </StatusBadge>
          ) : (
            <p className="text-xs text-muted-foreground">
              {status.recovery_codes_left} recovery codes left.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirming('reissue')}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              New recovery codes
            </Button>

            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming('off')}>
              Turn it off
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {error}
        </p>
      )}

      {/*
        ── ONE DIALOG, TWO ACTIONS, AND THE PASSWORD ASKED FOR INSIDE IT ───────

        Both of these WEAKEN the account — one removes the second factor, the other
        invalidates the codes the real owner is holding — so both ask for the
        password, which is what the server requires too. Asking for it here rather
        than on the page behind means it is typed in the same moment the
        consequence is being read.

        The field rides in `description` because `ConfirmDialog` lives in the
        shared primitives and is used by sixteen other screens; giving it a
        `children` slot for this one case is a change to everybody's dialog.
      */}
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) closeConfirm()
        }}
        title={
          confirming === 'off'
            ? 'Turn off two-step verification?'
            : 'Replace your recovery codes?'
        }
        description={
          <span className="block space-y-3">
            <span className="block">
              {confirming === 'off'
                ? 'Your password alone will be enough to sign in as you, and your recovery codes stop working.'
                : 'The codes you have now stop working immediately. Your authenticator app is unaffected and keeps generating codes as before.'}
            </span>

            <Field label="Your password">
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
          </span>
        }
        confirmLabel={confirming === 'off' ? 'Turn it off' : 'Replace them'}
        busy={busy}
        onConfirm={confirming === 'off' ? disable : reissue}
      />
    </SectionBlock>
  )
}
