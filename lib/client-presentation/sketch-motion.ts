/**
 * The "sketchbook" look of an illustrated tour, as pure functions. Nothing here reads a clock, `Math.random`, `Date.now` or the DOM: every
 * wobble, jitter and torn edge is a function of a seed and a frame number, so a frame of the slide is the same picture however the timeline
 * reached it (Next, Back, a tab click, a deep link, the video renderer).
 */

/** Seeded random numbers in [0, 1) (mulberry32). The same seed always gives the same sequence. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stop-motion runs on twos: a picture is redrawn this many times a second, and holds between. */
export const STOP_FPS = 12

export interface Jitter {
  x: number
  y: number
  r: number
}

/** The hand-drawn "boil" of frame `k` for the thing with this `seed`: a few pixels and about a degree, never the same two frames running. */
export function jitter(seed: number, k: number, amp = 1): Jitter {
  const rnd = mulberry32(seed * 7919 + k * 104729 + 17)
  return { x: round((rnd() - 0.5) * 7 * amp), y: round((rnd() - 0.5) * 7 * amp), r: round((rnd() - 0.5) * 2.6 * amp) }
}

/** The jitter of every frame in [0, seconds) at STOP_FPS, ready to be laid on a timeline as one `set` per frame. */
export function jitterTrack(seed: number, seconds: number, amp = 1): (Jitter & { at: number })[] {
  const n = Math.max(0, Math.floor(seconds * STOP_FPS))
  return Array.from({ length: n }, (_, k) => ({ at: round(k / STOP_FPS), ...jitter(seed, k, amp) }))
}

const round = (v: number) => Math.round(v * 100) / 100

export interface TornOptions {
  /** Which edges are ragged. The other edges stay straight. */
  top?: boolean
  bottom?: boolean
  left?: boolean
  right?: boolean
  /** Points along an edge. */
  steps?: number
  /** How deep a bite can go, in percent of the box. */
  bite?: number
}

/**
 * A torn-paper outline as a CSS `clip-path: polygon(...)` in percentages: ragged along the chosen edges, straight along the others. The raggedness
 * comes from the seed, so the same scrap is torn the same way every time. This is paper chrome around text and pictures, not a picture.
 */
export function tornPolygon(seed: number, { top = true, bottom = true, left = false, right = false, steps = 14, bite = 2.4 }: TornOptions = {}): string {
  const rnd = mulberry32(seed * 31 + 5)
  const edge = (on: boolean, i: number) => (on ? round(rnd() * bite) : 0)
  const pts: [number, number][] = []
  for (let i = 0; i <= steps; i++) pts.push([round((100 * i) / steps), edge(top, i)])                       // top edge, left to right
  for (let i = 1; i < steps; i++) pts.push([round(100 - edge(right, i)), round((100 * i) / steps)])        // right edge, top to bottom
  for (let i = steps; i >= 0; i--) pts.push([round((100 * i) / steps), round(100 - edge(bottom, i))])      // bottom edge, right to left
  for (let i = steps - 1; i > 0; i--) pts.push([edge(left, i), round((100 * i) / steps)])                  // left edge, bottom to top
  return `polygon(${pts.map(([x, y]) => `${x}% ${y}%`).join(', ')})`
}
