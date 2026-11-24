import raw from './generated/clips.json'

/**
 * The five product explainer clips. Text only: the capability claims behind each line stay in docs/client-presentation (the checker
 * reads them there). A clip is a short motion graphic with fictional school data, not a screen recording.
 */
export interface ClipLine {
  role: string
  text: string
}

export interface Clip {
  id: string
  product: string
  descriptor: string
  /** The slide that shows this product (story number). */
  slide: number
  lines: ClipLine[]
}

export interface ClipSet {
  disclosure: string
  length: number
  clips: Clip[]
}

export type Ratio = 'v' | 'h'
export type UiName = 'shown' | 'hidden'

/** The stage sizes: 9:16 for phones, 16:9 for a screen or a slide. */
export const STAGE: Record<Ratio, { w: number; h: number }> = { v: { w: 1080, h: 1920 }, h: { w: 1920, h: 1080 } }

export const CLIP_SET = raw as ClipSet
export const CLIP_IDS: string[] = CLIP_SET.clips.map((c) => c.id)

export const clipById = (id: string): Clip | null => CLIP_SET.clips.find((c) => c.id === id) ?? null
export const clipText = (c: Clip, role: string): string => c.lines.find((l) => l.role === role)?.text ?? ''
export const clipTexts = (c: Clip, role: string): string[] => c.lines.filter((l) => l.role === role).map((l) => l.text)
