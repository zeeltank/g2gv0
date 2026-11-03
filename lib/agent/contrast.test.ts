import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { color, dark, light, MIN, ratio, token } from '../theme-contrast'
import { AGENT_MARK_TONE, BANNER_TONE, FIELD_ERROR_TEXT, STATE_TONE, TEXT_ON_SURFACE } from './tones'

/**
 * The Organisation agent's pills, banners, links and secondary text must read at 4.5:1 or better, in the light theme and the dark one.
 *
 * Why this exists: the first version used the status colour as text on a tint of itself (`text-primary` on `bg-primary/10`, `text-success`, `text-destructive`).
 * The 123 jsdom tests could not see it, because jsdom computes no colour; a real browser's axe run found it on the Agent mark. The method is the Organisation 360
 * parts' (lib/org-accounts/contrast.test.ts, duplicated here on purpose so the two tracks' files stay apart): ratios come from the REAL theme (app/globals.css:
 * the `:root` block and the `.dark` block) and from the class strings in tones.ts. Tests run from the repository root (`npm test`).
 */


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

  it('uses no shared Badge or StatusBadge (their variants are a status colour as text on a tint of itself: Badge navy was 4.31:1 in the real browser)', () => {
    const offences: string[] = []
    for (const file of files) {
      readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
        if (/components\/ui\/(status-)?badge|<(Status)?Badge\b/.test(line)) offences.push(`${path.basename(file)}:${index + 1}: ${line.trim().slice(0, 140)}`)
      })
    }
    assert.deepEqual(offences, [])
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
