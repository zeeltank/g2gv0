import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { color, dark, light, MIN, ratio, token } from '../theme-contrast'
import { DATE_LOOK, STATUS_TONE, TEXT_ON_SURFACE } from './tones'

/**
 * Signal Review's chips, date pills, notices and secondary text must read at 4.5:1 or better, in the light theme and the dark one. A real browser's axe run
 * measured the date pills at 2.03:1 (the status colour as text on a tint of itself); jsdom computes no colour, so the existing tests could not see it. Ratios
 * come from the REAL theme (app/globals.css) and the class strings in tones.ts (see lib/theme-contrast.ts). Tests run from the repository root.
 */
describe('contrast of the Signal Review screens', () => {
  for (const { name, classes } of TEXT_ON_SURFACE) {
    for (const [theme, vars] of [['light', light], ['dark', dark]] as const) {
      it(`${name} reads at ${MIN}:1 or better in the ${theme} theme`, () => {
        const value = ratio(color(`var(${token(classes, 'text')})`, vars), color(`var(${token(classes, 'bg')})`, vars))
        assert.ok(value >= MIN, `${name} (${classes}) is ${value.toFixed(2)}:1 in the ${theme} theme`)
      })
    }
  }

  it('lists every status look and every date kind', () => {
    assert.deepEqual(Object.keys(STATUS_TONE).sort(), ['destructive', 'neutral', 'success', 'warning'])
    assert.deepEqual(Object.keys(DATE_LOOK).sort(), ['event', 'published', 'unknown'])
    for (const tone of [...Object.values(STATUS_TONE), ...Object.values(DATE_LOOK)]) assert.ok(TEXT_ON_SURFACE.some((pair) => pair.classes === tone), `${tone} is checked above`)
  })
})

describe('the Signal Review components keep to those looks (a scan, because the bug was a class string)', () => {
  const dir = path.resolve('components/domain/crm')
  const files = readdirSync(dir).filter((name) => name.startsWith('signal-review-') && name.endsWith('.tsx')).map((name) => path.join(dir, name))

  it('finds the components it scans', () => {
    assert.ok(files.length >= 5, `found ${files.length} files`)
  })

  it('uses no status colour as TEXT (an icon, which is aria-hidden, may be coloured)', () => {
    const offences: string[] = []
    for (const file of files) {
      readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
        if (/\btext-(success|warning|destructive|primary)\b(?!-)/.test(line) && !line.includes('aria-hidden')) offences.push(`${path.basename(file)}:${index + 1}: ${line.trim().slice(0, 140)}`)
      })
    }
    assert.deepEqual(offences, [], 'the status colour is a border or an icon; the words are text-foreground on a solid surface')
  })
})
