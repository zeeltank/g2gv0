'use client'

import { cn } from '@/lib/utils'

/**
 * The active pipeline step's label, revealed word by word beneath the
 * GeneratingOrb — "extracting", "OCR extracting", "AI reasoning" etc.
 * fading/sliding in one word at a time rather than appearing as one static
 * line, so the orb's continuous motion is echoed by the text under it.
 *
 * Mechanism: split on spaces, each word gets `g2g-word-reveal` (globals.css)
 * with a staggered `animationDelay` from its own index — the same per-item
 * stagger technique `document-batch-upload-progress.tsx` already uses for
 * row entrance (`g2g-row-enter`), just at word granularity. Re-keyed on the
 * label itself (via `key={label}` on the wrapper), so a genuinely new
 * backend-reported step replays the reveal instead of the words just
 * snapping to new text in place.
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
          className="inline-block motion-safe:[animation:g2g-word-reveal_0.35s_ease-out_backwards]"
          style={{ animationDelay: `${i * 90}ms` }}
        >
          {word}
        </span>
      ))}
    </p>
  )
}
