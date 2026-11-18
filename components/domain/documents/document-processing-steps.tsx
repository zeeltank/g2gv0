'use client'

import { cn } from '@/lib/utils'

/**
 * The active pipeline step's label - "Reading text (OCR if it's a scan)",
 * "Checking for duplicates" etc. Two layered animations, not one:
 *
 *  1. ENTRANCE - a new label rolls down into a centered position from above
 *     and overshoots slightly larger before settling, like a flip-counter
 *     digit landing, so a real `processing_step` change from the backend
 *     (see document-processing-progress.tsx's own docblock) reads as an
 *     event, not a silent text swap. Re-keyed on the label itself
 *     (`key={label}`) so each genuinely new step replays the roll.
 *  2. RESTING STATE - once landed, the label's color is a continuously
 *     looping gradient sweep (g2g-step-color-loop, globals.css) through the
 *     same three hues the GeneratingOrb's own shader is built from
 *     (blue/purple/orange - see generating-orb.tsx's baseColor0-2), so the
 *     one label actually being worked on right now reads as unmistakably
 *     "live" against the plain muted/shimmer text around it, and visually
 *     ties back to the orb above it rather than being a flat system color.
 *
 * `size="lg"` is the big headline under the orb; `size="sm"` is the same
 * mechanic at checklist-row scale for whichever row is currently active -
 * either way it's bold and a step larger than the plain `text-muted-foreground`
 * siblings around it, which is the real "bigger than the others" contrast,
 * not just a property of its own entrance.
 */
export interface DocumentProcessingStepsProps {
  label: string
  size?: 'sm' | 'lg'
  className?: string
}

const SIZE_CLASS: Record<'sm' | 'lg', string> = {
  sm: 'text-sm font-bold',
  lg: 'text-lg font-bold sm:text-xl',
}

export function DocumentProcessingSteps({ label, size = 'sm', className }: DocumentProcessingStepsProps) {
  return (
    <span className={cn('inline-block text-center leading-tight', className)}>
      <span
        key={label}
        className={cn(
          'inline-block bg-clip-text text-transparent',
          '[background-image:linear-gradient(90deg,#3d5aff,#9d00ff,#ff5f1f,#9d00ff,#3d5aff)] [background-size:300%_100%]',
          'motion-safe:[animation:g2g-step-roll-in_0.5s_cubic-bezier(0.22,1,0.36,1)_backwards,g2g-step-color-loop_3s_linear_infinite]',
          SIZE_CLASS[size],
        )}
      >
        {label}
      </span>
    </span>
  )
}
