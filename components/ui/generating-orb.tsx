'use client'

import { cn } from '@/lib/utils'

/**
 * A glowing, continuously-moving orb — the shared "something is working"
 * primitive for document upload/processing. Lives beside folder-icon-3d.tsx
 * and file-icon.tsx (a general visual primitive, not documents-specific),
 * even though its first two callers are both in the documents domain.
 *
 * CSS-only, matching this codebase's one existing convention for motion (see
 * the "BIG STREAMING" block in globals.css) — no animation library. Three
 * layers, defined as keyframes in globals.css: `g2g-orb-pulse` (the core
 * breathing), `g2g-orb-drift-rotate` (a second gradient layer in the alt
 * color, counter-rotating underneath so the two continuously cross-fade),
 * and `g2g-orb-rim-spin` (a thin rotating highlight ring).
 *
 * `percent`/`text` are NEVER the only signal that something is happening —
 * that's the orb's whole reason to exist (see document-processing-progress's
 * own docblock on why a static, occasionally-stalled number alone reads as
 * broken). The orb moves continuously regardless of whether the number
 * itself has changed since the last poll.
 */
export interface GeneratingOrbProps {
  /** 0-100. Visual weight only — scales the core's glow intensity so the orb reads as gradually "charging up", never used to fake completion (that's `active`/`text`'s job). */
  percent: number
  /** Centered inside the orb, e.g. "73%". */
  text?: string
  /** Diameter in px. */
  size?: number
  /** Multiplies animation duration; 1 = default speed. */
  speed?: number
  /** false once done/failed — freezes all three motion layers in place. */
  active?: boolean
  className?: string
}

export function GeneratingOrb({ percent, text, size = 96, speed = 1, active = true, className }: GeneratingOrbProps) {
  const pulseDuration = 2.6 / speed
  const driftDuration = 7 / speed
  const rimDuration = 3.4 / speed
  const glow = 0.25 + (Math.max(0, Math.min(100, percent)) / 100) * 0.35

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={text ? `${text} complete` : 'Working'}
    >
      {/* Layer 2: counter-rotating alt-color gradient, underneath the core. */}
      <div
        className="absolute inset-0 rounded-full opacity-70 blur-md"
        style={{
          background:
            'radial-gradient(circle at 65% 35%, color-mix(in oklab, var(--chart-indigo) 70%, transparent) 0%, transparent 60%)',
          animation: active ? `g2g-orb-drift-rotate ${driftDuration}s linear infinite` : undefined,
        }}
        aria-hidden="true"
      />

      {/* Layer 1: the core-to-halo radial gradient, breathing. */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 40% 40%, color-mix(in oklab, white 55%, var(--primary)) 0%, var(--primary) 45%, color-mix(in oklab, var(--primary) 40%, transparent) 75%, transparent 100%)',
          boxShadow: `0 0 24px color-mix(in oklab, var(--primary) ${Math.round(glow * 100)}%, transparent)`,
          animation: active ? `g2g-orb-pulse ${pulseDuration}s ease-in-out infinite` : undefined,
        }}
        aria-hidden="true"
      />

      {/* Layer 3: thin rotating highlight rim. */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'conic-gradient(from 0deg, transparent 0%, color-mix(in oklab, white 80%, transparent) 8%, transparent 20%, transparent 100%)',
          animation: active ? `g2g-orb-rim-spin ${rimDuration}s linear infinite` : undefined,
        }}
        aria-hidden="true"
      />

      {text && (
        <span
          className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums text-white drop-shadow-sm"
          style={{ fontSize: Math.max(11, size * 0.18) }}
        >
          {text}
        </span>
      )}
    </div>
  )
}
