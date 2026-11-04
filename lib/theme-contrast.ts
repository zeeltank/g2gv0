import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * The real theme's contrast, for tests: the ratio of two colours computed from app/globals.css (the `:root` block and the `.dark` block), the way the
 * Organisation 360 parts, the Organisation agent screens and Signal Review prove their chips, notices and links read at 4.5:1 or better. jsdom computes no
 * colour, so this and a real browser's axe run are the only checks of contrast. Tests run from the repository root (`npm test`).
 */

export const css = readFileSync(path.resolve('app/globals.css'), 'utf8')

export function block(selector: RegExp): Record<string, string> {
  const match = selector.exec(css)
  assert.ok(match, `the theme block ${selector} exists in app/globals.css`)
  const vars: Record<string, string> = {}
  for (const declaration of match[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[declaration[1]] = declaration[2].trim()
  return vars
}

export const light = block(/^:root\s*\{([\s\S]*?)^\}/m)
export const dark = { ...light, ...block(/^\.dark\s*\{([\s\S]*?)^\}/m) }

export type Rgb = [number, number, number]

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const sat = s / 100
  const lig = l / 100
  const c = (1 - Math.abs(2 * lig - 1)) * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lig - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

export function color(value: string, vars: Record<string, string>, depth = 0): Rgb {
  assert.ok(depth < 8, `a loop while resolving ${value}`)
  const reference = /^var\((--[\w-]+)\)$/.exec(value)
  if (reference) {
    assert.ok(reference[1] in vars, `${reference[1]} is defined`)
    return color(vars[reference[1]], vars, depth + 1)
  }
  const hsl = /^hsl\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%\s*\)$/.exec(value)
  if (hsl) return hslToRgb(Number(hsl[1]), Number(hsl[2]), Number(hsl[3]))
  const hex = /^#([0-9a-f]{6})$/i.exec(value)
  if (hex) return [parseInt(hex[1].slice(0, 2), 16), parseInt(hex[1].slice(2, 4), 16), parseInt(hex[1].slice(4, 6), 16)]
  assert.fail(`cannot read the colour ${value}`)
}

export const channel = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
export const luminance = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
export const ratio = (a: Rgb, b: Rgb) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }

/** The theme token a `text-*` or `bg-*` class names. Only SOLID tokens: a `/10` tint would need blending and is exactly what failed. */
export function token(classes: string, prefix: 'text' | 'bg'): string {
  const found = classes.split(/\s+/).filter((c) => c.startsWith(`${prefix}-`) && !c.includes('/') && !c.startsWith(`${prefix}-[`) && !c.startsWith(`${prefix}-xs`) && !c.startsWith(`${prefix}-sm`))
  assert.equal(found.length, 1, `exactly one solid ${prefix}- colour in "${classes}"`)
  return `--${found[0].slice(prefix.length + 1)}`
}

export const MIN = 4.5
