import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { color, dark, light, MIN, ratio, token } from '../theme-contrast'
import { FIELD_ERROR_TEXT, HEADER, HEADER_BUTTON, NOTICE_LOOK, OWN_BUBBLE, PURPLE, STATUS_STRIP_TONE, TEXT_ON_SURFACE } from './tones'

/**
 * The CRM chat must read at 4.5:1 or better, in the light theme and the dark one.
 *
 * Same method as the agent screens (lib/agent/contrast.test.ts) and for the same reason: jsdom computes no colour, so a status colour used as text on a tint
 * of itself passes every DOM test and fails in a real browser. Ratios come from the REAL theme (app/globals.css) and from the class strings in tones.ts; the two
 * fixed purple pairs (the header and the person's own bubble: white on Tailwind purple-600 / purple-700) come from the palette, because they are the same in
 * both themes. Tests run from the repository root (`npm test`).
 */

describe('contrast of the CRM chat', () => {
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

  it('lists both status looks and the notice, so none can be left out of the check above', () => {
    assert.deepEqual(Object.keys(STATUS_STRIP_TONE).sort(), ['caution', 'error'])
    for (const tone of [...Object.values(STATUS_STRIP_TONE), NOTICE_LOOK]) assert.ok(TEXT_ON_SURFACE.some((pair) => pair.classes === tone), `${tone} is checked`)
  })

  it('draws white on the two purples the chat has always had, at 4.5:1 or better', () => {
    const pairs: ReadonlyArray<[string, string, keyof typeof PURPLE]> = [
      [HEADER, 'the header', 'purple-600'], [OWN_BUBBLE, 'the person\'s own bubble', 'purple-600'], [HEADER_BUTTON, 'a header button on hover (and when pressed)', 'purple-700'],
    ]
    for (const [classes, name, surface] of pairs) {
      assert.ok(classes.includes('text-white'), `${name} has white text`)
      const value = ratio(color(PURPLE.white, light), color(PURPLE[surface], light))
      assert.ok(value >= MIN, `${name}: white on ${surface} is ${value.toFixed(2)}:1`)
    }
    assert.ok(HEADER.includes('bg-purple-600') && OWN_BUBBLE.includes('bg-purple-600') && HEADER_BUTTON.includes('hover:bg-purple-700'), 'the colours named here are the ones the classes use')
  })

  it('draws the too-long-question line in a dark red that passes on the page in both themes', () => {
    const palette: Record<string, string> = { 'red-700': '#b91c1c', 'red-300': '#fca5a5' }
    const [lightClass, darkClass] = FIELD_ERROR_TEXT.split(/\s+/)
    const lightColor = palette[lightClass.slice('text-'.length)]
    const darkColor = palette[darkClass.slice('dark:text-'.length)]
    assert.ok(lightColor && darkColor, `${FIELD_ERROR_TEXT} names colours this test knows`)
    assert.ok(ratio(color(lightColor, light), color(light['--background'], light)) >= MIN, 'light')
    assert.ok(ratio(color(darkColor, dark), color(dark['--background'], dark)) >= MIN, 'dark')
  })
})

describe('the chat\'s components keep to those looks (a scan, because the bug was a class string)', () => {
  const dir = path.resolve('components/domain/crm')
  const files = ['crm-chat-widget.tsx', 'ask-panel.tsx', 'ask-messages.tsx', 'ask-conversations.tsx'].map((name) => path.join(dir, name))
  const lines = (file: string) => readFileSync(file, 'utf8').split(/\r?\n/)

  it('scans every component of the chat, so a new one cannot be left out', () => {
    const drawn = readdirSync(dir).filter((name) => /^ask-.*\.tsx$/.test(name))
    assert.deepEqual(drawn.filter((name) => !files.some((file) => path.basename(file) === name)), [], 'an ask-*.tsx component that the scans below do not read')
    for (const file of files) assert.ok(readFileSync(file, 'utf8').length > 0, `${path.basename(file)} exists`)
  })

  it('uses no status colour as TEXT and no tint of one as a surface (an icon, which is aria-hidden, may be coloured)', () => {
    const offences: string[] = []
    for (const file of files) {
      lines(file).forEach((line, index) => {
        const textColour = /\btext-(success|warning|destructive|primary)\b(?!-)/.test(line)
        const tint = /\b(?:bg|border)-(?:success|warning|destructive|primary|muted-foreground)\/\d+/.test(line)
        if ((textColour && !line.includes('aria-hidden')) || tint) offences.push(`${path.basename(file)}:${index + 1}: ${line.trim().slice(0, 140)}`)
      })
    }
    assert.deepEqual(offences, [])
  })

  it('draws text only in colours that were measured: the theme\'s foreground, its muted foreground, white on the two purples, and the dark red of the error line', () => {
    const NOT_COLOURS = new Set(['xs', 'sm', 'base', 'lg', 'xl', 'left', 'right', 'center', 'justify', 'wrap', 'nowrap', 'balance', 'ellipsis', 'clip'])
    const MEASURED = new Set(['foreground', 'muted-foreground', 'white'])
    const offences: string[] = []
    for (const file of files) {
      lines(file).forEach((line, index) => {
        for (const match of line.matchAll(/(?<![\w-])text-([a-z]+(?:-[a-z0-9]+)*)(?![\w-]|\/)/g)) {
          const name = match[1]
          if (NOT_COLOURS.has(name) || MEASURED.has(name) || /^\[/.test(name)) continue
          offences.push(`${path.basename(file)}:${index + 1}: text-${name}`)
        }
      })
    }
    assert.deepEqual(offences, [], 'a text colour nobody measured')
  })

  it('uses no shared Badge or StatusBadge (their variants are a status colour as text on a tint of itself)', () => {
    const offences: string[] = []
    for (const file of files) {
      lines(file).forEach((line, index) => {
        if (/components\/ui\/(status-)?badge|<(Status)?Badge\b/.test(line)) offences.push(`${path.basename(file)}:${index + 1}: ${line.trim().slice(0, 140)}`)
      })
    }
    assert.deepEqual(offences, [])
  })

  it('draws nothing on a tint of the muted surface (text-muted-foreground on it was never measured)', () => {
    const offences: string[] = []
    for (const file of files) {
      lines(file).forEach((line, index) => {
        if (/\bbg-muted\/\d+/.test(line) && !/\bhover:bg-muted\/\d+/.test(line)) offences.push(`${path.basename(file)}:${index + 1}: ${line.trim().slice(0, 140)}`)
      })
    }
    assert.deepEqual(offences, [])
  })

  it('uses no shared Button (its hover state is white on a 4.32:1 blue); the chat draws its own buttons from the measured looks', () => {
    for (const file of files) assert.equal(/components\/ui\/button/.test(readFileSync(file, 'utf8')), false, path.basename(file))
  })
})
