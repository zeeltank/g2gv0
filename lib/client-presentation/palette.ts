/**
 * Colours for the client presentation, taken from the ScholarClone product page (public/learning/product-learning/scholarclone.html):
 * blue #1088F6 / #0A6AD0, green #74CD23 / #4C9A14, navy #0B3C73, ink #0C2A4A, body #35495F.
 * Status badges use a glyph and a word as well as a colour, and every pair here is contrast-tested (palette.test.ts).
 */
export const PALETTE = {
  ink: '#06182B',
  ink2: '#0B2540',
  navy: '#0B3C73',
  blue: '#1088F6',
  blueD: '#0A6AD0',
  green: '#74CD23',
  greenD: '#4C9A14',
  paper: '#F4F0E6',
  paper2: '#E9E3D3',
  textInk: '#0C2A4A',
  textBody: '#35495F',
  onInk: '#EAF2FB',
  onInkSoft: '#B7C7DA',
} as const

export type Theme = 'ink' | 'paper'

/** Badge colours per background theme: fg on bg must reach 4.5:1. */
export const BADGE_COLORS = {
  ink: {
    LIVE: { fg: '#A6E866', bg: '#12301A' },
    PARTIAL: { fg: '#F3C066', bg: '#3A2A0B' },
    CONCEPTUAL: { fg: '#B9D3EE', bg: '#12304F' },
  },
  paper: {
    LIVE: { fg: '#245A07', bg: '#DDEFC9' },
    PARTIAL: { fg: '#7A4E00', bg: '#F6E3B5' },
    CONCEPTUAL: { fg: '#23496F', bg: '#DCE8F5' },
  },
} as const

const lin = (c: number) => {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** CSS custom properties for a theme, set on the scene element so the stylesheet never hard-codes a palette value twice. */
export function themeVars(theme: Theme): Record<string, string> {
  const b = BADGE_COLORS[theme]
  return {
    '--cp-live-fg': b.LIVE.fg, '--cp-live-bg': b.LIVE.bg,
    '--cp-partial-fg': b.PARTIAL.fg, '--cp-partial-bg': b.PARTIAL.bg,
    '--cp-concept-fg': b.CONCEPTUAL.fg, '--cp-concept-bg': b.CONCEPTUAL.bg,
  }
}

export const rootVars: Record<string, string> = {
  '--cp-ink': PALETTE.ink, '--cp-ink2': PALETTE.ink2, '--cp-navy': PALETTE.navy, '--cp-blue': PALETTE.blue, '--cp-blue-d': PALETTE.blueD,
  '--cp-green': PALETTE.green, '--cp-green-d': PALETTE.greenD, '--cp-paper': PALETTE.paper, '--cp-paper2': PALETTE.paper2,
  '--cp-text-ink': PALETTE.textInk, '--cp-text-body': PALETTE.textBody, '--cp-on-ink': PALETTE.onInk, '--cp-on-ink-soft': PALETTE.onInkSoft,
}
