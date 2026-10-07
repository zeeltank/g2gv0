'use client'

import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/**
 * The active pipeline step's label, revealed word by word beneath the
 * GeneratingOrb — "extracting", "OCR extracting", "AI reasoning" etc.
 * fading/sliding in one word at a time rather than appearing as one static
 * line, so the orb's continuous motion is echoed by the text under it. Also
 * used inline in the checklist below the orb, for the one row that's
 * currently active — see `document-processing-progress.tsx`.
 *
 * Mechanism: split on spaces, each word gets TWO animations layered on the
 * same element (globals.css) via a per-word CSS custom property pair, not a
 * single Tailwind arbitrary-value class — two different animations with two
 * different per-word delays can't both be expressed through one shorthand
 * class, so each word's own `--word-reveal-delay`/`--word-float-delay` are
 * set inline and the Tailwind class just references them:
 *  1. `g2g-word-reveal` - the one-shot entrance, staggered by `i * 90ms`.
 *  2. `g2g-word-float` - picks up right where the reveal finishes (delay =
 *     the same `i * 90ms` plus the reveal's own 350ms) and keeps gently
 *     bobbing forever, so the label stays visibly "alive" for the whole
 *     time a step is active, not just for the quarter-second it took to
 *     reveal.
 *
 * Re-keyed on the label itself (via `key={label}` on the wrapper), so a
 * genuinely new backend-reported step replays the reveal (and restarts the
 * float wave) instead of the words just snapping to new text in place.
 */
export interface DocumentProcessingStepsProps {
  label: string
  className?: string
}

export function DocumentProcessingSteps({ label, className }: DocumentProcessingStepsProps) {
  const words = label.split(' ')

  return (
    <p key={label} className={cn('flex flex-wrap justify-center gap-x-1.5 text-sm font-medium text-foreground', className)}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="inline-block motion-safe:[animation:g2g-word-reveal_0.35s_ease-out_var(--word-reveal-delay)_backwards,g2g-word-float_2.4s_ease-in-out_var(--word-float-delay)_infinite]"
          style={{ '--word-reveal-delay': `${i * 90}ms`, '--word-float-delay': `${i * 90 + 350}ms` } as unknown as CSSProperties}
        >
          {word}
        </span>
      ))}
    </p>
  )
}
