import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { color, dark, light, MIN, ratio, token } from '../theme-contrast'
import { PICKER_COMPONENTS } from './files'
import { BOX, BOX_EMPTY, FAILURE, FOOTER, GROUP_HEADING, MESSAGE, POPOVER, RETRY, ROW, ROW_ACTIVE, ROW_QUIET, STATE_WORD, TEXT_ON_SURFACE } from './tones'

/**
 * The shared product picker (its box, list, rows, group headings, messages, state words and failure notice) must read at 4.5:1 or better in the light theme and in the
 * dark one. A real browser's axe run measured a status colour as TEXT on a tint of itself at 2.03:1 on other screens; jsdom computes no colour, so the whole-screen
 * tests cannot see it. The ratios come from the REAL theme (app/globals.css) and from the class strings in lib/product-picker/tones.ts (see lib/theme-contrast.ts), the
 * method of lib/portfolio-list/contrast.test.ts. Tests run from the repository root.
 */
describe('contrast of the shared product picker', () => {
  for (const { name, classes } of TEXT_ON_SURFACE) {
    for (const [theme, vars] of [['light', light], ['dark', dark]] as const) {
      it(`${name} reads at ${MIN}:1 or better in the ${theme} theme`, () => {
        const value = ratio(color(`var(${token(classes, 'text')})`, vars), color(`var(${token(classes, 'bg')})`, vars))
        assert.ok(value >= MIN, `${name} (${classes}) is ${value.toFixed(2)}:1 in the ${theme} theme`)
      })
    }
  }

  it('checks eleven looks (so a look dropped from the list is noticed)', () => {
    assert.equal(TEXT_ON_SURFACE.length, 11, 'the list of checked text and surface pairs')
  })

  /**
   * The ratios above are computed from the LIST of pairs; this ties the list to the class strings the picker really draws with. Each row says: this constant carries these
   * two tokens (the words and the surface they sit on, the surface being the constant's own or the one it is drawn on), and the list checks exactly that pair.
   */
  const LOOKS: ReadonlyArray<{ name: string; classes: string; text: string; surface: string; surfaceFrom?: string }> = [
    { name: 'BOX', classes: BOX, text: 'text-foreground', surface: 'bg-background' },
    { name: 'BOX_EMPTY', classes: BOX_EMPTY, text: 'text-muted-foreground', surface: 'bg-background', surfaceFrom: BOX },
    { name: 'POPOVER', classes: POPOVER, text: 'text-foreground', surface: 'bg-popover' },
    { name: 'ROW', classes: ROW, text: 'text-foreground', surface: 'bg-popover', surfaceFrom: POPOVER },
    { name: 'ROW_ACTIVE', classes: `${ROW} ${ROW_ACTIVE}`, text: 'text-foreground', surface: 'bg-muted' },
    { name: 'GROUP_HEADING', classes: GROUP_HEADING, text: 'text-muted-foreground', surface: 'bg-popover', surfaceFrom: POPOVER },
    { name: 'ROW_QUIET', classes: ROW_QUIET, text: 'text-muted-foreground', surface: 'bg-popover', surfaceFrom: POPOVER },
    { name: 'MESSAGE', classes: MESSAGE, text: 'text-muted-foreground', surface: 'bg-popover', surfaceFrom: POPOVER },
    { name: 'FOOTER', classes: FOOTER, text: 'text-muted-foreground', surface: 'bg-popover', surfaceFrom: POPOVER },
    { name: 'FAILURE', classes: FAILURE, text: 'text-foreground', surface: 'bg-card' },
    { name: 'RETRY', classes: RETRY, text: 'text-foreground', surface: 'bg-background' },
    { name: 'STATE_WORD', classes: STATE_WORD, text: 'text-foreground', surface: 'bg-muted' },
  ]
  for (const look of LOOKS) {
    it(`${look.name} is drawn with ${look.text} on ${look.surface}, a pair the list checks`, () => {
      assert.ok(look.classes.split(/\s+/).includes(look.text), `${look.name} (${look.classes}) no longer carries ${look.text}`)
      assert.ok((look.surfaceFrom ?? look.classes).split(/\s+/).includes(look.surface), `${look.name} is no longer drawn on ${look.surface}`)
      const checked = TEXT_ON_SURFACE.some((pair) => pair.classes.split(/\s+/).includes(look.text) && pair.classes.split(/\s+/).includes(look.surface))
      assert.ok(checked, `${look.text} on ${look.surface} is not in the list of checked looks`)
    })
  }
})

describe('the picker components keep to those looks (a scan, because the bug was a class string)', () => {
  const files = [...PICKER_COMPONENTS, 'lib/product-picker/tones.ts'].map((file) => path.resolve(file))

  it('finds the files it scans', () => {
    assert.equal(files.length, 5, 'four components and the tones file')
    for (const file of files) assert.ok(existsSync(file), `${file} exists`)
  })

  it('uses no status colour as TEXT, and no tint of one as a surface; an aria-hidden icon may be coloured', () => {
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
    assert.deepEqual(offences, [], 'a shared badge is used on the picker')
  })

  it('sees an offence when there is one (the scan run on made-up lines)', () => {
    const sees = (line: string) => /\btext-(success|warning|destructive|primary)\b(?!-)/.test(line) || /\b(?:bg|border)-(?:success|warning|destructive|primary|muted-foreground)\/\d+/.test(line)
    assert.equal(sees('<span className="text-destructive">x</span>'), true)
    assert.equal(sees('className="bg-warning/10 text-foreground"'), true)
    assert.equal(sees('className="border-border/60 text-muted-foreground"'), false, 'a hairline border and quiet text are the picker\'s own looks')
    assert.equal(sees('<Check className="size-4 text-primary-foreground" />'), false, 'a token that only starts with a status name is another token')
  })
})
