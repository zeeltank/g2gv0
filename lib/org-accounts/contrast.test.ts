import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { CHIP_TONE, DATE_TONE, FIELD_ERROR_TEXT, LIFECYCLE_TONE, NOTICE_TONE, TEXT_ON_SURFACE } from './tones'

/**
 * D4: the chips and notices of the Organisation 360 parts must read at 4.5:1 or better, in the light theme and the dark one. The first version used the status
 * colour for the text on a tint of itself (`text-primary` on `bg-primary/10` is 4.31:1, `text-success` 2.1:1, the shared StatusBadge `pending` 1.89:1).
 *
 * The ratios here are computed from the REAL theme (app/globals.css: the `:root` block and the `.dark` block) and from the class strings in tones.ts, so
 * changing a class or a theme colour changes the result. Tests run from the repository root (`npm test`).
 */

const css = readFileSync(path.resolve('app/globals.css'), 'utf8')

function block(selector: RegExp): Record<string, string> {
  const match = selector.exec(css)
  assert.ok(match, `the theme block ${selector} exists in app/globals.css`)
  const vars: Record<string, string> = {}
  for (const declaration of match[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[declaration[1]] = declaration[2].trim()
  return vars
}

const light = block(/^:root\s*\{([\s\S]*?)^\}/m)
const dark = { ...light, ...block(/^\.dark\s*\{([\s\S]*?)^\}/m) }

type Rgb = [number, number, number]

function hslToRgb(h: number, s: number, l: number): Rgb {
  const sat = s / 100
  const lig = l / 100
  const c = (1 - Math.abs(2 * lig - 1)) * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lig - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

function color(value: string, vars: Record<string, string>, depth = 0): Rgb {
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

const channel = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const luminance = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
const ratio = (a: Rgb, b: Rgb) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }

/** The theme token a `text-*` or `bg-*` class names. Only solid tokens are allowed: a `/10` tint would need blending and is exactly what failed before. */
function token(classes: string, prefix: 'text' | 'bg'): string {
  const found = classes.split(/\s+/).filter((c) => c.startsWith(`${prefix}-`) && !c.includes('/') && !c.startsWith(`${prefix}-[`) && !c.startsWith(`${prefix}-xs`) && !c.startsWith(`${prefix}-sm`))
  assert.equal(found.length, 1, `exactly one solid ${prefix}- colour in "${classes}"`)
  return `--${found[0].slice(prefix.length + 1)}`
}

const MIN = 4.5

describe('contrast of the chips and notices (D4)', () => {
  for (const { name, classes } of TEXT_ON_SURFACE) {
    for (const [theme, vars] of [['light', light], ['dark', dark]] as const) {
      it(`${name} reads at ${MIN}:1 or better in the ${theme} theme`, () => {
        const text = color(`var(${token(classes, 'text')})`, vars)
        const surface = color(`var(${token(classes, 'bg')})`, vars)
        const value = ratio(text, surface)
        assert.ok(value >= MIN, `${name} (${classes}) is ${value.toFixed(2)}:1 in the ${theme} theme`)
      })
    }
  }

  it('covers every lifecycle, every chip tone, both notice tones and the three date looks', () => {
    assert.deepEqual(Object.keys(LIFECYCLE_TONE).sort(), ['archived', 'customer', 'discovered', 'engaged', 'target'])
    assert.ok(Object.keys(LIFECYCLE_TONE).every((lifecycle) => (LIFECYCLE_TONE as Record<string, string>)[lifecycle] in CHIP_TONE))
    assert.equal(TEXT_ON_SURFACE.length, Object.keys(CHIP_TONE).length + Object.keys(NOTICE_TONE).length + Object.keys(DATE_TONE).length)
  })

  it('shows the same method fails what the first version did: the status colour on its own tint, and the shared error red', () => {
    const background = color(light['--background'], light)
    const card = color(light['--card'], light)
    // text-success on the page: far below 4.5 (the first version's success notice was 2.1:1 on its tint).
    assert.ok(ratio(color(light['--success'], light), card) < MIN, 'text-success on the surface')
    // The shared Field's error text is text-destructive: 3.97:1 on the page, which is why the edit form has its own red.
    assert.ok(ratio(color(light['--destructive'], light), background) < MIN, 'text-destructive on the page')
  })

  it('the edit form\'s field error is a dark red that passes in both themes', () => {
    // Tailwind's palette values for the two classes FIELD_ERROR_TEXT names. If the class changes, this fails until the colour is checked.
    const palette: Record<string, string> = { 'red-700': '#b91c1c', 'red-300': '#fca5a5' }
    const [lightClass, darkClass] = FIELD_ERROR_TEXT.split(/\s+/)
    assert.ok(lightClass.startsWith('text-') && darkClass.startsWith('dark:text-'), FIELD_ERROR_TEXT)
    const lightColor = palette[lightClass.slice('text-'.length)]
    const darkColor = palette[darkClass.slice('dark:text-'.length)]
    assert.ok(lightColor && darkColor, `${FIELD_ERROR_TEXT} names colours this test knows`)
    assert.ok(ratio(color(lightColor, light), color(light['--card'], light)) >= MIN, 'light')
    assert.ok(ratio(color(darkColor, dark), color(dark['--card'], dark)) >= MIN, 'dark')
  })
})
