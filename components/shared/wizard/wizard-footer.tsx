'use client'

import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * THE STEP FOOTER — Back on the left, the way forward on the right.
 *
 * ── THE BACK BUTTON IS THE POINT ────────────────────────────────────────────
 *
 * Neither module configuration nor the setup checklist had one. Module
 * configuration had a single button, "Save and continue", which always pushed to
 * `/organization/setup` whether or not that was where you came from - while its
 * own copy promised "You can skip any module in the next step" and no skip
 * control existed anywhere on the page.
 *
 * ── LABELS ARE VERBS, NEVER "NEXT" ──────────────────────────────────────────
 *
 * `nextLabel` is required and has no default, deliberately: "Save & continue"
 * and "Finish setup" tell somebody what the button will do, and "Next" tells
 * them only that there is more. A required prop is what stops the generic label
 * creeping back in.
 *
 * ── flex-col-reverse ON MOBILE ──────────────────────────────────────────────
 *
 * So the primary action sits at the top of the stack under the thumb, and Back
 * is below it rather than above - the pattern the one good footer already in the
 * product uses.
 */

type WizardFooterProps = {
  onBack?: () => void
  backLabel?: string
  onSkip?: () => void
  skipLabel?: string
  onNext?: () => void
  nextLabel: string
  /** Disables the primary action and swaps its icon for a spinner. */
  busy?: boolean
  /** Independent of `busy`: a step whose form is not yet valid. */
  nextDisabled?: boolean
  /** Shown above the buttons — why the primary action is unavailable, usually. */
  note?: string
}

export function WizardFooter({
  onBack,
  backLabel = 'Back',
  onSkip,
  skipLabel = 'Skip for now',
  onNext,
  nextLabel,
  busy = false,
  nextDisabled = false,
  note,
}: WizardFooterProps) {
  return (
    <div className="mt-6 border-t border-border pt-5">
      {note && <p className="mb-3 text-xs text-muted-foreground">{note}</p>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/*
          The span keeps the primary action pinned right on the first step, where
          there is nothing to go back to, instead of letting it slide left.
        */}
        {onBack ? (
          <Button variant="outline" onClick={onBack} disabled={busy}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            {backLabel}
          </Button>
        ) : (
          <span />
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          {onSkip && (
            <Button variant="ghost" onClick={onSkip} disabled={busy}>
              {skipLabel}
            </Button>
          )}

          {onNext && (
            <Button onClick={onNext} disabled={busy || nextDisabled}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {nextLabel}
              {!busy && <ArrowRight className="size-4" aria-hidden="true" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
