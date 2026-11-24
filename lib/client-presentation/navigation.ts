/**
 * Navigation for the client presentation: pure functions, no React, so the rules are testable.
 *
 * A "scene key" is 's1'..'s16' (the master deck; s17, the 59-second film, is shown after s5 and s16, "See it work", after s6) or 'short-2' / 'short-3' (the two merged scenes of the five-slide cut).
 * Each scene has a number of "beats": presses of Next that reveal the scene in steps before moving on.
 * A "detour" sends the presenter from the slide-4 chooser to one scenario slide and back; nothing is scored.
 */
export type Mode = 'full' | 'short'

export const FULL_ORDER = ['s1', 's2', 's3', 's4', 's5', 's17', 's6', 's16', 's7', 's8', 's9', 's10', 's11', 's12', 's13', 's14', 's15'] as const
export const SHORT_ORDER = ['s1', 'short-2', 'short-3', 's14', 's15'] as const

/** Scenario slides the slide-4 chooser can open, in the order of the five chips. */
export const CHOOSER_TARGETS = ['s14', 's8', 's10', 's11', 's12'] as const

export interface NavState {
  mode: Mode
  pos: number
  beat: number
  /** Where a detour returns to (scene key and beat), or null. */
  back: { key: string; beat: number } | null
  /** How the scene was entered: drives whether the intro animation plays or the final state is shown at once. */
  entry: 'forward' | 'back' | 'jump'
}

export type BeatsOf = (key: string) => number

export const orderOf = (mode: Mode): readonly string[] => (mode === 'short' ? SHORT_ORDER : FULL_ORDER)
export const keyAt = (s: NavState): string => orderOf(s.mode)[s.pos]

export function initial(mode: Mode = 'full', key?: string): NavState {
  const order = orderOf(mode)
  const pos = key ? Math.max(0, order.indexOf(key)) : 0
  return { mode, pos, beat: 0, back: null, entry: 'jump' }
}

export function next(s: NavState, beatsOf: BeatsOf): NavState {
  const key = keyAt(s)
  if (s.beat < beatsOf(key)) return { ...s, beat: s.beat + 1, entry: 'forward' }
  if (s.back) return { ...s, pos: orderOf(s.mode).indexOf(s.back.key), beat: s.back.beat, back: null, entry: 'back' }
  if (s.pos >= orderOf(s.mode).length - 1) return s
  return { ...s, pos: s.pos + 1, beat: 0, entry: 'forward' }
}

export function prev(s: NavState, beatsOf: BeatsOf): NavState {
  if (s.beat > 0) return { ...s, beat: s.beat - 1, entry: 'back' }
  if (s.back) return { ...s, pos: orderOf(s.mode).indexOf(s.back.key), beat: s.back.beat, back: null, entry: 'back' }
  if (s.pos === 0) return s
  const pos = s.pos - 1
  return { ...s, pos, beat: beatsOf(orderOf(s.mode)[pos]), entry: 'back' }
}

export function goto(s: NavState, key: string, beatsOf: BeatsOf, atEnd = false): NavState {
  const pos = orderOf(s.mode).indexOf(key)
  if (pos < 0) return s
  return { ...s, pos, beat: atEnd ? beatsOf(key) : 0, back: null, entry: 'jump' }
}

/** Open one scenario slide from the chooser; "next" at its end (or the Return button) comes back to where the presenter was. */
export function detour(s: NavState, key: string): NavState {
  const pos = orderOf(s.mode).indexOf(key)
  if (pos < 0) return s
  return { ...s, pos, beat: 0, back: { key: keyAt(s), beat: s.beat }, entry: 'jump' }
}

export function returnFromDetour(s: NavState): NavState {
  if (!s.back) return s
  return { ...s, pos: orderOf(s.mode).indexOf(s.back.key), beat: s.back.beat, back: null, entry: 'back' }
}

export function setMode(s: NavState, mode: Mode): NavState {
  if (mode === s.mode) return s
  const key = keyAt(s)
  const order = orderOf(mode)
  // Keep the same scene when it exists in the other mode; otherwise start at the first scene of that mode.
  const pos = order.indexOf(key)
  return { mode, pos: pos < 0 ? 0 : pos, beat: 0, back: null, entry: 'jump' }
}

/** 0..1 across the current order, counting beats, for the thin progress line. */
export function progress(s: NavState, beatsOf: BeatsOf): number {
  const order = orderOf(s.mode)
  let total = 0
  let done = 0
  order.forEach((k, i) => {
    const b = beatsOf(k) + 1
    total += b
    if (i < s.pos) done += b
    else if (i === s.pos) done += s.beat + 1
  })
  return total ? done / total : 0
}
