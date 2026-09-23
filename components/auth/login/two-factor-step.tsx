'use client'

import { useEffect, useRef } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

const LENGTH = 6

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * THE SECOND STEP
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This REPLACES the credential form rather than appearing beneath it — an
 * email box, a password box and a code box stacked together look like three
 * things to fill in at once, and somebody whose account has no two-step
 * verification would wonder what the empty one is for. That reasoning is
 * inherited from the screen this replaces and isn't being revisited here —
 * only the input is.
 *
 * ── SIX BOXES INSTEAD OF ONE ────────────────────────────────────────────────
 *
 * A six-digit code in a single wide input gives no feedback on progress and
 * no landmark for a mistyped digit. Segmented boxes make position visible,
 * make backspace mean something precise, and let a paste land digit by digit.
 *
 * `autoComplete="one-time-code"` stays on the FIRST box only — repeating it
 * on all six makes iOS offer the whole code to each box in turn.
 */

function SegmentedCode({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    refs.current[0]?.focus()
  }, [])

  const write = (next: string) => {
    const digits = next.replace(/\D/g, '').slice(0, LENGTH)
    onChange(digits)
    return digits
  }

  const handleInput = (index: number, raw: string) => {
    // A physical keyboard delivers one character; an autofill or a fast
    // paste into a single box delivers all six. Both are handled by writing
    // from this box onward and letting the slice fall where it does.
    const digits = raw.replace(/\D/g, '')
    if (!digits) return

    const next = (value.slice(0, index) + digits).slice(0, LENGTH)
    const written = write(next)
    refs.current[Math.min(written.length, LENGTH - 1)]?.focus()
  }

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault()
      if (value[index]) {
        // Clear this box and stay — deleting a visible digit shouldn't also
        // move focus somewhere else.
        write(value.slice(0, index) + value.slice(index + 1))
        return
      }
      // Empty box: step back and clear that one, the universal meaning of
      // backspace on an empty field.
      const prev = Math.max(index - 1, 0)
      write(value.slice(0, prev))
      refs.current[prev]?.focus()
      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      refs.current[Math.max(index - 1, 0)]?.focus()
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      refs.current[Math.min(index + 1, LENGTH - 1)]?.focus()
    }
  }

  return (
    <div
      className="grid grid-cols-6 gap-2"
      role="group"
      aria-label={`${LENGTH}-digit verification code`}
      onPaste={(event) => {
        // Codes are copied out of authenticator apps as "123 456" as often
        // as "123456" — refusing the spaced form would be this screen's
        // fault, not theirs.
        event.preventDefault()
        const written = write(event.clipboardData.getData('text'))
        refs.current[Math.min(written.length, LENGTH - 1)]?.focus()
      }}
    >
      {Array.from({ length: LENGTH }).map((_, index) => (
        <Input
          key={index}
          ref={(node) => {
            refs.current[index] = node
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={LENGTH}
          value={value[index] ?? ''}
          onChange={(event) => handleInput(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onFocus={(event) => event.target.select()}
          disabled={disabled}
          aria-label={`Digit ${index + 1}`}
          className={cn(
            'h-12 w-full rounded-lg px-0 text-center text-lg font-semibold tabular-nums transition-colors',
            value[index] && 'border-primary/50',
          )}
        />
      ))}
    </div>
  )
}

export function TwoFactorStep({
  challenge,
  code,
  onCodeChange,
  recoveryCode,
  onRecoveryCodeChange,
  useRecovery,
  onToggleRecovery,
  isLoading,
  onSubmit,
  onRestart,
}: {
  challenge: string
  code: string
  onCodeChange: (value: string) => void
  recoveryCode: string
  onRecoveryCodeChange: (value: string) => void
  useRecovery: boolean
  onToggleRecovery: () => void
  isLoading: boolean
  onSubmit: (event: React.FormEvent) => void
  onRestart: () => void
}) {
  const ready = useRecovery ? recoveryCode.trim().length >= 4 : code.length === LENGTH

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-3.5">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Two-step verification</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{challenge}</p>
        </div>
      </div>

      {useRecovery ? (
        <div>
          <Label htmlFor="recovery-code" className="mb-1.5 block text-sm font-medium">
            Recovery code
          </Label>
          <Input
            id="recovery-code"
            // NOT `one-time-code`: that prompts the browser to offer the
            // SMS/authenticator code it may have captured, the wrong
            // credential for this field.
            autoComplete="off"
            autoFocus
            value={recoveryCode}
            onChange={(event) => onRecoveryCodeChange(event.target.value)}
            placeholder="xxxx-xxxx"
            disabled={isLoading}
            className="h-11 rounded-lg font-mono text-[0.9375rem]"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            One of the codes you saved when you turned this on. Each one works once.
          </p>
        </div>
      ) : (
        <div>
          <Label className="mb-1.5 block text-sm font-medium">6-digit code</Label>
          <SegmentedCode value={code} onChange={onCodeChange} disabled={isLoading} />
          <p className="mt-1.5 text-xs text-muted-foreground">
            From your authenticator app. It changes every 30 seconds.
          </p>
        </div>
      )}

      <Button
        type="submit"
        disabled={isLoading || !ready}
        aria-busy={isLoading}
        className="relative h-11 w-full rounded-lg text-sm font-semibold"
      >
        <span className={isLoading ? 'opacity-0' : undefined}>Verify</span>
        {isLoading && (
          <span className="absolute inset-0 grid place-items-center">
            <Spinner size="sm" className="text-primary-foreground" />
          </span>
        )}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/*
          The way back in for somebody holding a printed code and no phone.
          Offered where it's needed, and never the obvious first choice — a
          recovery code is the weaker of the two paths.
        */}
        <button
          type="button"
          onClick={onToggleRecovery}
          disabled={isLoading}
          className="rounded text-xs font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {useRecovery ? 'Use my authenticator app' : "I don't have my phone"}
        </button>

        <button
          type="button"
          onClick={onRestart}
          disabled={isLoading}
          className="rounded text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Start again
        </button>
      </div>
    </form>
  )
}
