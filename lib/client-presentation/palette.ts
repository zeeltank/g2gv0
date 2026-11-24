/**
 * Colours for the client presentation, taken from the ScholarClone product page (public/learning/product-learning/scholarclone.html):
 * blue #1088F6 / #0A6AD0, green #74CD23 / #4C9A14, navy #0B3C73, ink #0C2A4A, body #35495F.
 * Text and background pairs are contrast-tested (palette.test.ts).
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

/** Kept as the single place a scene asks for its theme variables; the palette itself lives in `rootVars` and base.css. */
export function themeVars(_theme: Theme): Record<string, string> {
  return {}
}

export const rootVars: Record<string, string> = {
  '--cp-ink': PALETTE.ink, '--cp-ink2': PALETTE.ink2, '--cp-navy': PALETTE.navy, '--cp-blue': PALETTE.blue, '--cp-blue-d': PALETTE.blueD,
  '--cp-green': PALETTE.green, '--cp-green-d': PALETTE.greenD, '--cp-paper': PALETTE.paper, '--cp-paper2': PALETTE.paper2,
  '--cp-text-ink': PALETTE.textInk, '--cp-text-body': PALETTE.textBody, '--cp-on-ink': PALETTE.onInk, '--cp-on-ink-soft': PALETTE.onInkSoft,
}
