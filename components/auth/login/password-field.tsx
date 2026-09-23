'use client'

import { useId, useState } from 'react'
import { Eye, EyeOff, LockKeyhole, TriangleAlert } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * THE REVEAL BUTTON, WHICH USED TO BE AN ICON THAT DID NOTHING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The previous screen drew an eye at the right of the password field as
 * `<Eye className="… pointer-events-none …" />` — not a button, not
 * focusable, wired to no state. It looked exactly like the control it was
 * pretending to be, so people clicked it, nothing happened, and they retyped
 * a password they had no way to check.
 *
 * It is a real `<button type="button">` here — `type` matters, an
 * unqualified button inside a form submits it, so toggling visibility would
 * have tried to sign in. `aria-pressed` carries the toggle state.
 *
 * ── CAPS LOCK ───────────────────────────────────────────────────────────────
 *
 * The browser knows and will not say. It's a common cause of "my password
 * stopped working," it's invisible in a masked field by definition, and
 * `getModifierState` has been available for years with no reason not to use
 * it. Warning, not error — nothing has gone wrong yet.
 *
 * ── autoComplete ────────────────────────────────────────────────────────────
 *
 * `current-password` was simply absent before. Without it a password manager
 * can't reliably identify this as the sign-in password rather than a new
 * one — the difference between an offered credential and a prompt to save a
 * duplicate.
 */

export function PasswordField({
  value,
  onChange,
  disabled,
  error,
  label = 'Password',
  autoComplete = 'current-password',
  autoFocus,
  action,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  error?: boolean
  label?: string
  autoComplete?: 'current-password' | 'new-password'
  autoFocus?: boolean
  /** Rendered opposite the label — the "Forgot password?" slot. */
  action?: React.ReactNode
}) {
  const id = useId()
  const capsId = `${id}-caps`
  const [revealed, setRevealed] = useState(false)
  const [capsOn, setCapsOn] = useState(false)

  /*
   * Read on every key event rather than tracking a CapsLock keypress
   * specifically: somebody can switch it on, focus the field, and start
   * typing, and no keydown for the CapsLock key itself ever reaches this
   * input. `getModifierState` reports the live state off whatever key did.
   */
  const readCaps = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsOn(event.getModifierState?.('CapsLock') ?? false)
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {action}
      </div>

      <div className="group relative">
        <LockKeyhole
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground transition-colors duration-200 group-focus-within:text-primary"
        />

        <Input
          id={id}
          type={revealed ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={readCaps}
          onKeyUp={readCaps}
          onBlur={() => setCapsOn(false)}
          disabled={disabled}
          placeholder="••••••••"
          aria-invalid={error || undefined}
          aria-describedby={capsOn ? capsId : undefined}
          className={cn(
            'h-11 rounded-lg pl-9 pr-10 text-[0.9375rem]',
            error && 'motion-safe:[animation:g2g-shake_320ms_ease-in-out_1]',
          )}
        />

        <button
          type="button"
          onClick={() => setRevealed((current) => !current)}
          disabled={disabled}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          aria-pressed={revealed}
          tabIndex={-1}
          className="absolute right-1 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>

      {capsOn && (
        <p
          id={capsId}
          className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-warning motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1"
        >
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          Caps Lock is on
        </p>
      )}
    </div>
  )
}
