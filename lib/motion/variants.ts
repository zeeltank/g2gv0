/**
 * Shared Framer Motion constants for the Task Management calendar/task
 * screens — introduced for exactly this module (approved, scoped divergence
 * from g2g's usual CSS-transition-only convention; see docs/frontend's "five
 * commandments" for why that convention exists everywhere else).
 *
 * The numbers mirror docs/frontend/design-tokens.md's existing transition
 * vocabulary (duration fast/normal/slow, the one easing curve the whole app
 * already uses) so this introduction reads as the same motion language in a
 * new engine, not a second one.
 *
 * Every consumer imports these named constants rather than inlining its own
 * `transition={{ duration: 0.2 }}` — one place decides what "fast" means.
 */
import type { Transition, Variants } from 'framer-motion'

export const DURATION = { fast: 0.15, normal: 0.24, slow: 0.35 } as const

/** Same curve as `app/globals.css`'s `cubic-bezier(0.22, 1, 0.36, 1)`. */
export const EASE = [0.22, 1, 0.36, 1] as const

const transition = (duration: number): Transition => ({ duration, ease: EASE })

export const drawerSlideInRight: Variants = {
  initial: { x: '100%' },
  animate: { x: 0, transition: transition(DURATION.normal) },
  exit: { x: '100%', transition: transition(DURATION.normal) },
}

export const drawerSlideInLeft: Variants = {
  initial: { x: '-100%' },
  animate: { x: 0, transition: transition(DURATION.normal) },
  exit: { x: '-100%', transition: transition(DURATION.normal) },
}

export const crossFade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: transition(DURATION.fast) },
  exit: { opacity: 0, transition: transition(DURATION.fast) },
}

export const modalScaleIn: Variants = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1, transition: transition(DURATION.fast) },
  exit: { opacity: 0, scale: 0.97, transition: transition(DURATION.fast) },
}

export const toastSlideUp: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: transition(DURATION.fast) },
  exit: { opacity: 0, y: 8, transition: transition(DURATION.fast) },
}

/** A freshly-created list item/calendar chip announcing itself briefly. */
export const popIn: Variants = {
  initial: { opacity: 0, scale: 0.9, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0, transition: transition(DURATION.normal) },
  exit: { opacity: 0, scale: 0.9, transition: transition(DURATION.fast) },
}

export const listStagger = {
  container: { animate: { transition: { staggerChildren: 0.03 } } },
  item: {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0, transition: transition(DURATION.fast) },
  },
} satisfies { container: Variants; item: Variants }
