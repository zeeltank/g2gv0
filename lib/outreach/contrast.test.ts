import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { color, dark, light, MIN, ratio, token } from '../theme-contrast'
import { CHECK_TONE, NOTE_TONE, SUMMARY_TONE, TEXT_ON_SURFACE } from './tones'

/**
 * The Checks section's text must read at 4.5:1 or better, in the light theme and the dark one.
 *
 * Same method as lib/agent/contrast.test.ts and lib/campaigns/contrast.test.ts, with this track's files in place of theirs: ratios come from the REAL theme
 * (app/globals.css: the `:root` block and the `.dark` block) and from the class strings in lib/outreach/tones.ts, because jsdom computes no colour. Tests run
 * from the repository root.
 */

describe('contrast of the Checks section\'s text', () => {
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

  it('lists every tone the component draws with', () => {
    for (const tone of [...Object.values(CHECK_TONE), ...Object.values(SUMMARY_TONE), NOTE_TONE]) {
      assert.ok(TEXT_ON_SURFACE.some((pair) => pair.classes === tone), `${tone} is checked above`)
    }
  })
})

const root = (file: string) => path.resolve(file)
const lines = (file: string) => readFileSync(file, 'utf8').split(/\r?\n/)

/** Files this track wrote whole: every line is scanned. */
const mine = [root('components/domain/gtm/outreach-checks.tsx'), root('components/domain/gtm/outreach-claims.tsx'), root('lib/outreach/tones.ts')]

/** The file this track only added to: only the lines that use a new part are scanned (the rest were there before and are not this track's to judge). */
const edited = { file: root('components/domain/gtm/outreach-view.tsx'), marker: /\bOutreachChecks\b|GateRefusal|gateRefusalMessage|attemptNote|data-gate-blocked|\brefusals?\b|isCheckable|messageSignature|messageProductId/ }

function scan(file: string, marker: RegExp | null, offends: (line: string) => boolean): string[] {
  const found: string[] = []
  lines(file).forEach((line, index) => {
    if ((marker === null || marker.test(line)) && offends(line)) found.push(`${path.basename(file)}:${index + 1}: ${line.trim().slice(0, 140)}`)
  })
  return found
}

const everything = (offends: (line: string) => boolean) => [...mine.flatMap((file) => scan(file, null, offends)), ...scan(edited.file, edited.marker, offends)]

const STATUS_TEXT = (line: string) => /\btext-(success|warning|destructive|primary)\b(?!-)/.test(line) && !line.includes('aria-hidden')
const STATUS_TINT = (line: string) => /\b(?:bg|border)-(?:success|warning|destructive|primary|muted-foreground)\/\d+/.test(line)

describe('the new components keep to those looks (a scan, because the bug was a class string)', () => {
  it('the scan really reads what it is meant to (the marker finds lines in the edited file, and the new files are not empty)', () => {
    assert.ok(scan(edited.file, edited.marker, () => true).length >= 5, 'the marker finds the lines this track added to outreach-view.tsx')
    for (const file of mine) assert.ok(lines(file).length > 20, `${path.basename(file)} is read`)
  })

  it('uses no status colour as TEXT, and no tint of one as a surface; an icon, which is aria-hidden, may be coloured', () => {
    assert.deepEqual(everything((line) => STATUS_TEXT(line) || STATUS_TINT(line)), [], 'the status colour is only a border or an icon; the words are text-foreground on a solid surface')
  })

  it('uses no shared Badge or StatusBadge (their variants are a status colour as text on a tint of itself)', () => {
    assert.deepEqual(everything((line) => /components\/ui\/(status-)?badge|<(Status)?Badge\b/.test(line)), [])
  })

  it('draws no surface on a tint of the muted colour', () => {
    assert.deepEqual(everything((line) => /\bbg-muted\/\d+/.test(line) && !/\bhover:bg-muted\/\d+/.test(line)), [])
  })

  it('takes its tones from tones.ts and sets no colour of its own', () => {
    const checks = readFileSync(mine[0], 'utf8')
    for (const name of ['CHECK_TONE', 'SUMMARY_TONE', 'NOTE_TONE']) assert.ok(checks.includes(name), `${name} is used by the component, so this test checks what is drawn`)
    for (const file of mine.slice(0, 2)) {
      const source = readFileSync(file, 'utf8')
      assert.equal(/\b(bg|text|border)-(success|warning|destructive|amber|red|green|emerald|orange)\b/.test(source), false, `${path.basename(file)} names no status colour`)
      assert.equal(/style=\{\{/.test(source), false, `${path.basename(file)} sets no inline style`)
    }
  })

  it('the scans can fail: they flag the offences they are written for', () => {
    assert.equal(STATUS_TEXT('<p className="text-destructive">x</p>'), true)
    assert.equal(STATUS_TEXT('<p className="text-primary">x</p>'), true)
    assert.equal(STATUS_TEXT('<XCircle aria-hidden="true" className="text-destructive" />'), false, 'an icon may be coloured')
    assert.equal(STATUS_TEXT('<p className="border-destructive text-foreground">x</p>'), false, 'a border may be')
    assert.equal(STATUS_TINT('<div className="bg-destructive/10">'), true)
    assert.equal(STATUS_TINT('<div className="border-success bg-card">'), false)
    assert.equal(/<(Status)?Badge\b/.test('<Badge variant="outline">'), true)
  })
})
