import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { color, dark, light, MIN, ratio, token } from '../theme-contrast'
import { CHIP_TONE, FIELD_ERROR_TEXT, NOTICE_TONE } from '../org-accounts/tones'
import { chipClass } from '../product-master/tones'
import { PORTFOLIO_COMPONENTS, PORTFOLIO_FILES } from './files'

/**
 * The words on the Sub-product form and pages must read at 4.5:1 or better, in the light theme and the dark one. The method is the product lines' and the
 * Organisation 360 parts' (lib/product-master/contrast.test.ts, lib/signals/contrast.test.ts): the WORD carries the meaning, the text is `text-foreground` on
 * a SOLID theme surface, and only the border takes a status colour. Ratios come from the REAL theme (app/globals.css) and from the class strings the screens
 * use, and a scan of the new files looks for the patterns that failed in a real browser (a status colour as text, a tint of one as a surface, the shared
 * badge). jsdom computes no colour, so this and a real browser's axe run are the only checks of contrast.
 */
const THEMES = [['light', light], ['dark', dark]] as const

describe('contrast of the Sub-product form and pages', () => {
  const chips = (['success', 'primary', 'pending', 'inactive', 'default'] as const).map((tone) => ({ name: `chip ${tone}`, classes: chipClass(tone) }))
  const pairs = [
    ...chips,
    ...Object.entries(NOTICE_TONE).map(([name, classes]) => ({ name: `notice ${name}`, classes })),
    ...Object.entries(CHIP_TONE).map(([name, classes]) => ({ name: `ICP chip ${name}`, classes })),
    { name: 'a link inside a card', classes: 'bg-card text-foreground' },
    { name: 'secondary text on a card', classes: 'bg-card text-muted-foreground' },
    { name: 'secondary text on the page', classes: 'bg-background text-muted-foreground' },
    { name: 'a part chip on the muted surface', classes: 'bg-muted text-foreground' },
    { name: 'a quiet chip on the muted surface', classes: 'bg-muted text-muted-foreground' },
  ]

  for (const { name, classes } of pairs) {
    for (const [theme, vars] of THEMES) {
      it(`${name} reads at ${MIN}:1 or better in the ${theme} theme`, () => {
        const solid = classes.split(/\s+/).filter((c) => c.startsWith('text-') || c.startsWith('bg-')).join(' ')
        const value = ratio(color(`var(${token(solid, 'text')})`, vars), color(`var(${token(solid, 'bg')})`, vars))
        assert.ok(value >= MIN, `${name} (${classes}) is ${value.toFixed(2)}:1 in the ${theme} theme`)
      })
    }
  }

  it('shows a field error in a dark red that passes on the card and the page in both themes', () => {
    const palette: Record<string, string> = { 'red-700': '#b91c1c', 'red-300': '#fca5a5' }
    const [lightClass, darkClass] = FIELD_ERROR_TEXT.split(/\s+/)
    const lightColor = palette[lightClass.slice('text-'.length)]
    const darkColor = palette[darkClass.slice('dark:text-'.length)]
    assert.ok(lightColor && darkColor, `${FIELD_ERROR_TEXT} names colours this test knows`)
    for (const surface of ['--card', '--background']) {
      assert.ok(ratio(color(lightColor, light), color(light[surface], light)) >= MIN, `light on ${surface}`)
      assert.ok(ratio(color(darkColor, dark), color(dark[surface], dark)) >= MIN, `dark on ${surface}`)
    }
  })
})

describe('the Sub-product form and page components keep to those looks (a scan, because the bug was a class string)', () => {
  const files = PORTFOLIO_COMPONENTS.map((f) => path.resolve(f))

  it('finds every component it scans', () => {
    assert.equal(PORTFOLIO_COMPONENTS.length, 12, 'twelve components are scanned')
    for (const file of PORTFOLIO_FILES) assert.ok(existsSync(path.resolve(file)), `${file} exists`)
  })

  it('uses no status colour as TEXT and no tint of one as a surface; an icon, which is aria-hidden, may be coloured', () => {
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

  it('uses no shared Badge or StatusBadge (their variants are a status colour as text on a tint of itself)', () => {
    const offences: string[] = []
    for (const file of files) {
      readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
        if (/components\/ui\/(status-)?badge|<(Status)?Badge\b/.test(line)) offences.push(`${path.basename(file)}:${index + 1}: ${line.trim().slice(0, 140)}`)
      })
    }
    assert.deepEqual(offences, [])
  })
})
