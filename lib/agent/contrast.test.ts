import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { AGENT_MARK_TONE, BANNER_TONE, FIELD_ERROR_TEXT, STATE_TONE, TEXT_ON_SURFACE } from './tones'

/**
 * The Organisation agent's pills, banners, links and secondary text must read at 4.5:1 or better, in the light theme and the dark one.
 *
 * Why this exists: the first version used the status colour as text on a tint of itself (`text-primary` on `bg-primary/10`, `text-success`, `text-destructive`).
 * The 123 jsdom tests could not see it, because jsdom computes no colour; a real browser's axe run found it on the Agent mark. The method is the Organisation 360
 * parts' (lib/org-accounts/contrast.test.ts, duplicated here on purpose so the two tracks' files stay apart): ratios come from the REAL theme (app/globals.css:
 * the `:root` block and the `.dark` block) and from the class strings in tones.ts. Tests run from the repository root (`npm test`).
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

/** The theme token a `text-*` or `bg-*` class names. Only SOLID tokens: a `/10` tint would need blending and is exactly what failed. */
function token(classes: string, prefix: 'text' | 'bg'): string {
  const found = classes.split(/\s+/).filter((c) => c.startsWith(`${prefix}-`) && !c.includes('/') && !c.startsWith(`${prefix}-[`) && !c.startsWith(`${prefix}-xs`) && !c.startsWith(`${prefix}-sm`))
  assert.equal(found.length, 1, `exactly one solid ${prefix}- colour in "${classes}"`)
  return `--${found[0].slice(prefix.length + 1)}`
}

const MIN = 4.5

describe('contrast of the Organisation agent screens', () => {
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

  it('lists every pill state, the agent mark and both banners', () => {
    assert.deepEqual(Object.keys(STATE_TONE).sort(), ['error', 'inactive', 'pending', 'processing', 'success'])
    assert.deepEqual(Object.keys(BANNER_TONE).sort(), ['error', 'success'])
    assert.ok(AGENT_MARK_TONE.length > 0)
    for (const tone of [...Object.values(STATE_TONE), AGENT_MARK_TONE, ...Object.values(BANNER_TONE)]) {
      assert.ok(TEXT_ON_SURFACE.some((pair) => pair.classes === tone), `${tone} is checked above`)
    }
  })

  it('the short error line on a card is a dark red that passes in both themes', () => {
    const palette: Record<string, string> = { 'red-700': '#b91c1c', 'red-300': '#fca5a5' }
    const [lightClass, darkClass] = FIELD_ERROR_TEXT.split(/\s+/)
    const lightColor = palette[lightClass.slice('text-'.length)]
    const darkColor = palette[darkClass.slice('dark:text-'.length)]
    assert.ok(lightColor && darkColor, `${FIELD_ERROR_TEXT} names colours this test knows`)
    assert.ok(ratio(color(lightColor, light), color(light['--card'], light)) >= MIN, 'light')
    assert.ok(ratio(color(darkColor, dark), color(dark['--card'], dark)) >= MIN, 'dark')
  })
})

describe('the four agent components keep to those looks (a scan, because the bug was a class string)', () => {
  const files = ['org-agent-parts.tsx', 'org-agent-panel.tsx', 'agent-runs-view.tsx', 'agent-run-detail.tsx'].map((name) => path.resolve('components/domain/crm', name))

  it('uses no status colour as TEXT (a link included: text-primary is 4.16:1 on a card in the dark theme), and no tint of one as a surface; an icon, which is aria-hidden, may be coloured', () => {
    const offences: string[] = []
    for (const file of files) {
      readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
        const textColour = /\btext-(success|warning|destructive|primary)\b(?!-)/.test(line)
        const tint = /\b(?:bg|border)-(?:success|warning|destructive|primary|muted-foreground)\/\d+/.test(line)
        if ((textColour && !line.includes('aria-hidden')) || tint) offences.push(`${path.basename(file)}:${index + 1}: ${line.trim().slice(0, 140)}`)
      })
    }
    assert.deepEqual(offences, [], 'the status colour is only a border or an icon; the words are text-foreground on a solid surface')
  })

  it('draws no table head or form on a tint of the muted surface (text-muted-foreground on it was never measured)', () => {
    const offences: string[] = []
    for (const file of files) {
      readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
        if (/\bbg-muted\/\d+/.test(line) && !/\bhover:bg-muted\/\d+/.test(line)) offences.push(`${path.basename(file)}:${index + 1}: ${line.trim().slice(0, 140)}`)
      })
    }
    assert.deepEqual(offences, [])
  })
})
