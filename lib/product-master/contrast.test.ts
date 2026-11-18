import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { color, dark, light, MIN, ratio, token } from '../theme-contrast'
import { chipClass, SWITCH_ACTIVE, TEXT_ON_SURFACE } from './tones'

/**
 * The product lines inside the Products screen (chips, the scope switch, notices, links) must read at 4.5:1 or better, in the light theme and the dark one.
 *
 * Why this exists: the first version drew the readiness, sold and ICP chips with the shared StatusBadge (`text-success` on `bg-success/10` is 2.03:1,
 * `text-warning` 1.89:1) and the active side of the scope switch as `text-primary` on `bg-primary/10` (4.31:1). The jsdom tests compute no colour; a real
 * browser's axe run found it. The method is the Organisation 360 parts' (lib/org-accounts/contrast.test.ts): ratios come from the REAL theme (app/globals.css)
 * and from the class strings in tones.ts. Tests run from the repository root (`npm test`).
 */

describe('contrast of the product lines inside the Products screen', () => {
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

  it('gives every tone the readiness and ICP rules use a chip that is one of the checked looks', () => {
    for (const tone of ['success', 'primary', 'pending', 'inactive', 'default'] as const) {
      const classes = chipClass(tone)
      assert.ok(TEXT_ON_SURFACE.some((pair) => classes.endsWith(pair.classes)), `${tone}: ${classes} is checked above`)
    }
    assert.ok(TEXT_ON_SURFACE.some((pair) => pair.classes === SWITCH_ACTIVE))
  })
})

describe('the product-line components keep to those looks (a scan, because the bug was a class string)', () => {
  const names = [
    'product-lines-view.tsx', 'product-line-record-page.tsx', 'product-links-panels.tsx', 'product-line-columns.tsx', 'product-signals-icp-tab.tsx',
    'product-offer-about.tsx', 'product-usage-tab.tsx', 'product-master-parts.tsx', 'product-scope-switch.tsx',
  ]
  const files = names.map((name) => path.resolve('components/domain/crm', name))

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
