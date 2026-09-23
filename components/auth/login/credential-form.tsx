'use client'

import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { PasswordField } from '@/components/auth/login/password-field'

/*
 * Email, password, keep-me-signed-in, submit.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ───────────────────────────────────────────
 *
 * "Sign in with Google" used to sit below the submit button. Its handler set
 * the string "Google sign-in is not available yet" — its only possible
 * outcome was an error message. A control whose sole behaviour is to reject
 * you is worse than no control: it advertises a way in that doesn't exist,
 * and the people most likely to try it are the ones whose company runs
 * Google Workspace. The backend route exists (`/auth/google`) and is
 * unwired; when it's wired the button belongs ABOVE the form, not below —
 * people scanning for a provider sign-in look upward first.
 *
 * The "English ▾" language button is gone for the same reason: no `onClick`,
 * no i18n anywhere in this app, a promise the product doesn't keep.
 */

export function CredentialForm({
  email,
  onEmailChange,
  password,
  onPasswordChange,
  remember,
  onRememberChange,
  isLoading,
  hasError,
  onSubmit,
  onForgot,
}: {
  email: string
  onEmailChange: (value: string) => void
  password: string
  onPasswordChange: (value: string) => void
  remember: boolean
  onRememberChange: (value: boolean) => void
  isLoading: boolean
  hasError: boolean
  onSubmit: (event: React.FormEvent) => void
  onForgot: () => void
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          Email address
        </Label>

        <div className="group relative">
          <Mail
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground transition-colors duration-200 group-focus-within:text-primary"
          />
          <Input
            id="email"
            type="email"
            /*
             * `username`, not `email`. Password managers store a credential
             * as a PAIR and key the identifier half on
             * `autocomplete="username"`; `email` alone reads as a contact
             * field, which is why a saved credential would fill the password
             * and leave this blank.
             *
             * The label says "Email address" and means it — authController
             * matches on `email` and nothing queries `user_name`, so anybody
             * typing an employee number was told their credentials were
             * wrong.
             */
            autoComplete="username"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="you@company.com"
            disabled={isLoading}
            aria-invalid={hasError || undefined}
            className="h-11 rounded-lg pl-9 text-[0.9375rem]"
          />
        </div>
      </div>

      <PasswordField
        value={password}
        onChange={onPasswordChange}
        disabled={isLoading}
        error={hasError}
        action={
          <button
            type="button"
            onClick={onForgot}
            className="rounded text-xs font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Forgot password?
          </button>
        }
      />

      <div className="flex items-center gap-2.5">
        <Checkbox
          id="remember"
          size="sm"
          checked={remember}
          onCheckedChange={onRememberChange}
          disabled={isLoading}
        />
        {/*
          RENAMED from "Remember me", which was vague about what it
          remembered — and for years remembered nothing at all: the state was
          set by this checkbox and read by nothing. It now decides whether the
          session survives closing the browser. See setSessionCookie() in
          gtg-auth.tsx.
        */}
        <Label
          htmlFor="remember"
          className="cursor-pointer text-sm font-normal text-muted-foreground"
        >
          Keep me signed in
        </Label>
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        aria-busy={isLoading}
        className="relative h-11 w-full rounded-lg text-sm font-semibold transition-transform active:scale-[0.99] motion-reduce:active:scale-100"
      >
        {/*
          The label stays mounted and goes invisible rather than being
          swapped for "Signing in…". Swapping the text changes the button's
          intrinsic width mid-submit, so the control someone just pressed
          visibly resizes under the cursor.
        */}
        <span className={isLoading ? 'opacity-0' : undefined}>Sign in</span>
        {isLoading && (
          <span className="absolute inset-0 grid place-items-center">
            <Spinner size="sm" className="text-primary-foreground" />
          </span>
        )}
      </Button>
    </form>
  )
}
