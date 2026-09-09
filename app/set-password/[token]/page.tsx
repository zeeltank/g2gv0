'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, CircleAlert, Loader2, Lock } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { passwordService } from '@/services/auth/password'
import { ApiError } from '@/services/core'

/**
 * SET YOUR PASSWORD — the page the invite link opens.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS PAGE HAS NEVER EXISTED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Because nothing ever sent a link to it. `EmployeeFactory::issueInvite()` wrote
 * a `password_reset_tokens` row and returned `['sent' => true]` with no mail
 * call in it, so the token was minted, never delivered, and read by nothing.
 *
 * Meanwhile the new employee's password was `bin2hex(random_bytes(12))`, hashed
 * and discarded. So every employee ever created through Employee Directory has
 * been unable to sign in — and was told an invite had been emailed to them.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT CHECKS THE LINK BEFORE SHOWING A FORM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Somebody arriving with a dead link should be told immediately, not after
 * typing a password twice. So the token is validated on mount and the form only
 * appears if it is good — and the page says whose account it is, which is worth
 * seeing before you set a credential on it.
 *
 * ── NO SESSION, NO SHELL ────────────────────────────────────────────────────
 *
 * Deliberately outside `ProtectedLayout` and the app shell: the entire audience
 * is people who are not signed in. It is also outside the menu system for the
 * same reason.
 */
export default function SetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const router = useRouter()
  const { token } = use(params)

  const [checking, setChecking] = useState(true)
  const [validFor, setValidFor] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)

  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const verify = useCallback(async () => {
    try {
      const response = await passwordService.check(token)
      setValidFor(response.data?.email ?? null)
      setLinkError(null)
    } catch (reason) {
      setValidFor(null)
      setLinkError(
        reason instanceof ApiError
          ? reason.message
          : 'This link could not be checked. It may have expired.',
      )
    } finally {
      setChecking(false)
    }
  }, [token])

  useEffect(() => {
    queueMicrotask(() => {
      void verify()
    })
  }, [verify])

  /*
   * The same rule the server enforces, shown as you type rather than after you
   * submit. It is NOT the security boundary — PasswordController::rule() is —
   * but a person should not have to guess what "not strong enough" meant.
   */
  const rules = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Contains a letter', met: /[a-zA-Z]/.test(password) },
    { label: 'Contains a number', met: /[0-9]/.test(password) },
  ]

  const matches = password.length > 0 && password === confirmation
  const ready = rules.every((rule) => rule.met) && matches

  async function submit(event: React.FormEvent) {
    event.preventDefault()

    if (!ready || busy) return

    setBusy(true)
    setError(null)

    try {
      await passwordService.setPassword(token, password, confirmation)
      setDone(true)
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.fullMessage ?? reason.message
          : 'Your password could not be set. The link may have expired.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Lock className="size-6" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {done ? 'You are all set' : 'Set your password'}
          </h1>
          {!done && validFor && (
            <p className="text-sm text-muted-foreground">
              for <span className="font-medium text-foreground">{validFor}</span>
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
          {checking ? (
            <div className="flex flex-col gap-3">
              <div className="h-4 w-40 animate-pulse rounded bg-muted/50" />
              <div className="h-10 animate-pulse rounded-lg bg-muted/40" />
              <div className="h-10 animate-pulse rounded-lg bg-muted/40" />
            </div>
          ) : done ? (
            <div className="flex flex-col gap-5">
              <Alert variant="success">
                <Check className="size-4" aria-hidden="true" />
                <AlertTitle>Your password is set</AlertTitle>
                <AlertDescription>
                  You can sign in with it now. Any other devices that were signed in to this
                  account have been signed out.
                </AlertDescription>
              </Alert>

              <Button onClick={() => router.push('/login')}>
                Go to sign in
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ) : linkError ? (
            /*
             * A dead link is a dead end here on purpose: this page cannot offer
             * to send a new one, because it does not know who is asking. The
             * login screen can, and it is one click away.
             */
            <div className="flex flex-col gap-5">
              <Alert variant="destructive">
                <CircleAlert className="size-4" aria-hidden="true" />
                <AlertTitle>This link cannot be used</AlertTitle>
                <AlertDescription>{linkError}</AlertDescription>
              </Alert>

              <Button variant="outline" onClick={() => router.push('/login')}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-5">
              {error && (
                <Alert variant="destructive">
                  <CircleAlert className="size-4" aria-hidden="true" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoFocus
                />
              </div>

              <ul className="flex flex-col gap-1">
                {rules.map((rule) => (
                  <li
                    key={rule.label}
                    className={
                      rule.met
                        ? 'flex items-center gap-2 text-xs text-success'
                        : 'flex items-center gap-2 text-xs text-muted-foreground'
                    }
                  >
                    <Check
                      className={rule.met ? 'size-3.5' : 'size-3.5 opacity-30'}
                      aria-hidden="true"
                    />
                    {rule.label}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmation">Type it again</Label>
                <Input
                  id="confirmation"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
                {confirmation.length > 0 && !matches && (
                  <p className="text-xs text-destructive">The two do not match.</p>
                )}
              </div>

              <Button type="submit" disabled={!ready || busy}>
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Set password and sign in
              </Button>

              <p className="text-xs leading-relaxed text-muted-foreground">
                This link works once. Setting a password also signs out any other device that
                was using this account.
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
