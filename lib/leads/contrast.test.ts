import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { color, dark, light, MIN, ratio, token } from '../theme-contrast'
import { LEAD_CHIP, TEXT_ON_SURFACE } from './tones'

/**
 * The chips and notes the Leads screen gained with slice 6 must read at 4.5:1 or better, in the light theme and the dark one.
 *
 * Why this exists: the first Organisation 360 and agent screens used a status colour as text on a tint of itself (`text-success` on `bg-success/15`) and read
 * as low as 1.89:1; 123 jsdom tests could not see it, because jsdom computes no colour, and a real browser's axe run found it. The method is the same here:
 * ratios come from the REAL theme (app/globals.css: the `:root` block and the `.dark` block) and from the class strings in lib/leads/tones.ts. Tests run from
 * the repository root (`npm test`).
 */

describe('contrast of the Leads screen\'s new chips and notes', () => {
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

  it('checks every chip the new parts draw (consent allowed and blocked, the signal marker, the neutral one)', () => {
    assert.deepEqual(Object.keys(LEAD_CHIP).sort(), ['allowed', 'blocked', 'neutral', 'signal'])
    for (const tone of Object.values(LEAD_CHIP)) assert.ok(TEXT_ON_SURFACE.some((pair) => pair.classes === tone), `${tone} is checked above`)
  })

  it('every chip is words on a solid surface with only the border in a status colour', () => {
    for (const [name, classes] of Object.entries(LEAD_CHIP)) {
      assert.ok(/\btext-(foreground|muted-foreground)\b/.test(classes), `${name}: the text is foreground`)
      assert.ok(/\bbg-(card|muted)\b/.test(classes), `${name}: the surface is a solid theme surface`)
      assert.equal(/\btext-(success|warning|destructive|primary)\b/.test(classes), false, `${name}: no status colour as text`)
    }
  })
})

describe('the new components keep to those looks (a scan, because the bug was a class string)', () => {
  const files = ['lead-parts.tsx', 'lead-evidence-tab.tsx'].map((name) => path.resolve('components/domain/crm', name))

  it('uses no status colour as TEXT (a link included: text-primary is 4.16:1 on a card in the dark theme), and no tint of one as a surface', () => {
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

  it('draws no surface on a tint of the muted colour', () => {
    const offences: string[] = []
    for (const file of files) {
      readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
        if (/\bbg-muted\/\d+/.test(line)) offences.push(`${path.basename(file)}:${index + 1}: ${line.trim().slice(0, 140)}`)
      })
    }
    assert.deepEqual(offences, [])
  })

  it('the two edited screens add no colour of their own: every line that uses a new part is free of status colours', () => {
    const offences: string[] = []
    for (const name of ['lead-list-view.tsx', 'lead-detail-page.tsx']) {
      const file = path.resolve('components/domain/crm', name)
      readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
        const usesNewPart = /\b(LeadFacet|EmailConsentChip|SignalMarker|LeadContextLine|LeadEvidenceTab)\b|data-lead-/.test(line)
        if (usesNewPart && /\b(text|bg|border)-(success|warning|destructive|primary|amber|emerald|orange|red|green)\b/.test(line)) offences.push(`${name}:${index + 1}: ${line.trim().slice(0, 140)}`)
      })
    }
    assert.deepEqual(offences, [])
  })
})
