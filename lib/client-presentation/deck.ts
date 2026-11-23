/**
 * Types and helpers for the client-facing presentation (ScholarClone first).
 *
 * The browser only ever sees the public deck written by scripts/client-presentation/export-deck.mjs from the checked story:
 * on-slide text, status badges, presenter notes, scenarios and image slots. Claims, their sources and the visual direction stay
 * in docs/client-presentation and are never shipped.
 */
import deckJson from './generated/scholarclone.deck.json'

export type Badge = 'LIVE' | 'PARTIAL' | 'CONCEPTUAL'
export type Mark = 'built' | 'partial' | 'concept'

export interface Line {
  role: string
  text: string
  kind: string
  mark?: Mark
  badge?: Badge
}

export interface Slot {
  id: string
  type: string
  brief: string
}

export interface Slide {
  n: number
  id: string
  section: string
  badge: Badge | null
  lines: Line[]
  say: string
  ask: string
  transition: string
  slots: Slot[]
}

export interface Scenario {
  id: string
  n: number
  title: string
  label: string
  slide: number
  situation: string
  challenge: string
  capability: string
  next_action: string
  value: string
}

export interface Asset {
  type: string
  src: string | null
  alt: string | null
  credit: string | null
  ai: boolean
  w: number | null
  h: number | null
  focus: string | null
}

export interface Deck {
  product: string
  title: string
  slides: Slide[]
  short: { n: number; title: string; uses: number[] }[]
  scenarios: Scenario[]
  assets: Record<string, Asset>
}

export const DECKS: Record<string, Deck> = { scholarclone: parseDeck(deckJson) }

export const DECK_KEYS = Object.keys(DECKS)

export function parseDeck(raw: unknown): Deck {
  const d = raw as Deck
  if (!d || !Array.isArray(d.slides) || d.slides.length < 12 || d.slides.length > 15) throw new Error('deck: needs 12 to 15 slides')
  const seen = new Set<number>()
  for (const s of d.slides) {
    if (seen.has(s.n)) throw new Error(`deck: duplicate slide ${s.n}`)
    seen.add(s.n)
    if (!Array.isArray(s.lines) || !s.lines.length) throw new Error(`deck: slide ${s.n} has no lines`)
  }
  if (!Array.isArray(d.short) || d.short.length !== 5) throw new Error('deck: short version needs 5 slides')
  if (!Array.isArray(d.scenarios) || d.scenarios.length !== 5) throw new Error('deck: needs 5 scenarios')
  return d
}

export const linesOf = (slide: Slide, role: string): Line[] => slide.lines.filter((l) => l.role === role)
export const lineOf = (slide: Slide, role: string): Line | undefined => slide.lines.find((l) => l.role === role)
export const textOf = (slide: Slide, role: string): string => lineOf(slide, role)?.text ?? ''
export const textsOf = (slide: Slide, role: string): string[] => linesOf(slide, role).map((l) => l.text)

export function slideByN(deck: Deck, n: number): Slide {
  const s = deck.slides.find((x) => x.n === n)
  if (!s) throw new Error(`deck: no slide ${n}`)
  return s
}

/** Used by scenes that show an image: the slot's real file, or null while the photo has not been authorised and placed. */
export const assetOf = (deck: Deck, slot: string): Asset | null => deck.assets[slot] ?? null

/** Status badge language shown on slides. A glyph and a word, so colour is never the only signal. */
export const BADGE_COPY: Record<Badge, { word: string; hint: string }> = {
  LIVE: { word: 'LIVE', hint: 'Works today' },
  PARTIAL: { word: 'PARTIAL', hint: 'Parts work today' },
  CONCEPTUAL: { word: 'CONCEPTUAL', hint: 'Design intent, not built' },
}
