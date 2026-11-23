import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { color, dark, light, MIN, ratio, token } from '../theme-contrast'
import { chipClass, TEXT_ON_SURFACE } from './tones'

/**
 * The Product Portfolio list (chips, notices, links, secondary text) must read at 4.5:1 or better, in the light theme and the dark one. A real browser's axe run measured the status
 * colour as TEXT on a tint of itself at 2.03:1 on other screens; jsdom computes no colour, so the whole-screen tests cannot see it. Ratios come from the REAL theme (app/globals.css)
 * and from the class strings in tones.ts (see lib/theme-contrast.ts). Tests run from the repository root.
 */
describe('contrast of the Product Portfolio list', () => {
  for (const { name, classes } of TEXT_ON_SURFACE) {
    for (const [theme, vars] of [['light', light], ['dark', dark]] as const) {
      it(`${name} reads at ${MIN}:1 or better in the ${theme} theme`, () => {
        const value = ratio(color(`var(${token(classes, 'text')})`, vars), color(`var(${token(classes, 'bg')})`, vars))
        assert.ok(value >= MIN, `${name} (${classes}) is ${value.toFixed(2)}:1 in the ${theme} theme`)
      })
    }
  }

  it('gives every tone the state, readiness and ICP rules use a chip that is one of the checked looks', () => {
    for (const tone of ['success', 'primary', 'pending', 'inactive', 'default'] as const) {
      const classes = chipClass(tone)
      assert.ok(TEXT_ON_SURFACE.some((pair) => classes.endsWith(pair.classes)), `${tone}: ${classes} is checked above`)
    }
  })
})

describe('the components of the Product Portfolio list keep to those looks (a scan, because the bug was a class string)', () => {
  const names = [
    'portfolio-list', 'portfolio-list-table', 'portfolio-list-toolbar', 'portfolio-list-chips', 'portfolio-more-menu', 'portfolio-matches', 'portfolio-redirect',
  ]
  const files = names.map((name) => path.resolve('components/domain/portfolio', `${name}.tsx`))

  it('finds the components it scans', () => {
    assert.equal(files.length, 7)
    for (const file of files) assert.ok(existsSync(file), `${file} exists`)
  })

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
