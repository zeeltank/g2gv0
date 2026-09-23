'use client'

import { useEffect, useRef } from 'react'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

/*
 * Reset-request, as a step in the same column rather than a modal over it.
 *
 * The screen this replaces used a hand-rolled fixed-position overlay that
 * dismissed on any click outside it — a mis-click anywhere on the page threw
 * away a half-typed email with no undo. A step in the same column costs
 * nothing extra now that the form already swaps between a credential step and
 * a 2FA step, and it removes that trap entirely.
 *
 * ── THE REPLY IS THE SAME EITHER WAY ────────────────────────────────────────
 *
 * Whether or not the address has an account, and whether the request
 * succeeded or failed, the message is identical. Anything else turns this
 * form into a way to find out who is registered. The link itself is never
 * returned here. See Api\Auth\PasswordController::forgot().
 */

export function ForgotPasswordPanel({
  email,
  onEmailChange,
  busy,
  notice,
  onSubmit,
  onBack,
}: {
  email: string
  onEmailChange: (value: string) => void
  busy: boolean
  notice: string
  onSubmit: (event: React.FormEvent) => void
  onBack: () => void
}) {
  const noticeRef = useRef<HTMLDivElement>(null)

  // The answer arrives without the page moving, so nothing would otherwise
  // tell a screen reader user that anything happened.
  useEffect(() => {
    if (notice) noticeRef.current?.focus()
  }, [notice])

  if (notice) {
    return (
      <div className="space-y-5">
        <div className="grid size-10 place-items-center rounded-full bg-success/10">
          <MailCheck className="size-5 text-success" aria-hidden="true" />
        </div>

        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Check your inbox
          </h2>
          <div
            ref={noticeRef}
            tabIndex={-1}
            className="mt-1.5 text-sm leading-relaxed text-muted-foreground focus:outline-none"
          >
            {notice}
          </div>
        </div>

        <Button variant="outline" onClick={onBack} className="h-11 w-full rounded-lg">
          Back to sign in
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Reset your password
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We&rsquo;ll send a link to set a new one.
        </p>
      </div>

      <div>
        <Label htmlFor="forgot-email" className="mb-1.5 block text-sm font-medium">
          Email address
        </Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="you@company.com"
          disabled={busy}
          autoFocus
          className="h-11 rounded-lg text-[0.9375rem]"
        />
      </div>

      <Button
        type="submit"
        disabled={!email.trim() || busy}
        aria-busy={busy}
        className="relative h-11 w-full rounded-lg text-sm font-semibold"
      >
        <span className={busy ? 'opacity-0' : undefined}>Send the link</span>
        {busy && (
          <span className="absolute inset-0 grid place-items-center">
            <Spinner size="sm" className="text-primary-foreground" />
          </span>
        )}
      </Button>

      <Alert>
        <AlertDescription className="text-xs leading-relaxed text-muted-foreground">
          If your organisation has no email set up, ask your administrator — they
          can generate a link for you from the Employee Directory.
        </AlertDescription>
      </Alert>

      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 rounded text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to sign in
      </button>
    </form>
  )
}
