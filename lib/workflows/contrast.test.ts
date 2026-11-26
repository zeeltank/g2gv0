import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { color, dark, light, MIN, ratio, token } from '../theme-contrast'
import { CHIP_BASE, NOTE_TONE, RUN_STATUS_TONE, TEXT_ON_SURFACE, WORKFLOW_STATUS_TONE, chipClass } from './tones'

/**
 * The chips, notices and secondary text of the Automations and Runs tabs must read at 4.5:1 or better, in the light theme and the dark one. Ratios come from
 * the REAL theme (app/globals.css) and the class strings in lib/workflows/tones.ts (see lib/theme-contrast.ts), and the components are scanned for the
 * patterns that failed in other screens: the status colour as TEXT, a tint of a status colour as a surface, a hex colour, a font of their own.
 */
describe('contrast of the Automations and Runs tabs', () => {
  for (const { name, classes } of TEXT_ON_SURFACE) {
    for (const [theme, vars] of [['light', light], ['dark', dark]] as const) {
      it(`${name} reads at ${MIN}:1 or better in the ${theme} theme`, () => {
        const value = ratio(color(`var(${token(classes, 'text')})`, vars), color(`var(${token(classes, 'bg')})`, vars))
        assert.ok(value >= MIN, `${name} (${classes}) is ${value.toFixed(2)}:1 in the ${theme} theme`)
      })
    }
  }

  it('gives every workflow status and every run status a tone that is one of the checked looks', () => {
    for (const tone of [...Object.values(WORKFLOW_STATUS_TONE), ...Object.values(RUN_STATUS_TONE)]) {
      const classes = chipClass(tone)
      assert.ok(TEXT_ON_SURFACE.some((pair) => pair.classes === classes), `${tone}: ${classes} is checked above`)
    }
    for (const classes of Object.values(NOTE_TONE)) assert.ok(TEXT_ON_SURFACE.some((pair) => pair.classes === classes), `${classes} is checked above`)
  })

  it('keeps the chip shape the Organisation 360 chips have', () => {
    assert.match(CHIP_BASE, /rounded-full border px-2 py-0.5 text-xs/)
  })
})

describe('the Automations components keep to those looks (a scan, because the bug was a class string)', () => {
  const dir = path.resolve('app/platform-services/workflow/_components/automations')
  const files = readdirSync(dir).filter((f) => f.endsWith('.tsx')).map((f) => path.join(dir, f))
  const offences = (test: (line: string) => boolean) => files.flatMap((file) => readFileSync(file, 'utf8').split(/\r?\n/).flatMap((line, i) => (test(line) && !line.includes('aria-hidden') ? [`${path.basename(file)}:${i + 1}: ${line.trim().slice(0, 140)}`] : [])))

  it('finds the components it scans', () => {
    assert.ok(files.length >= 12, `${files.length} components`)
  })

  it('uses no status colour as TEXT (an icon, which is aria-hidden, may be coloured; the asterisk of a required field is aria-hidden too)', () => {
    assert.deepEqual(offences((l) => /\btext-(success|warning|destructive|primary)\b(?!-)/.test(l)), [])
  })

  it('uses no palette colour as text, and no tint of a status colour as a surface', () => {
    assert.deepEqual(offences((l) => /\btext-(red|green|amber|yellow|blue|orange|emerald)-\d/.test(l)), [])
    assert.deepEqual(offences((l) => /\bbg-(success|warning|destructive|primary|amber-\d+|red-\d+|green-\d+)\/\d+/.test(l)), [])
  })

  it('brings no hex colour and no font of its own', () => {
    assert.deepEqual(offences((l) => /#[0-9a-fA-F]{3,8}\b/.test(l)), [])
    assert.deepEqual(offences((l) => /\bfont-(serif|display)\b|font-family|fontFamily/.test(l)), [])
  })

  it('animates nothing that does not answer an action, and honours reduced motion where it spins', () => {
    for (const line of offences((l) => /\banimate-spin\b/.test(l))) assert.match(line, /motion-reduce:animate-none/, line)
    assert.deepEqual(offences((l) => /\btransition-all\b|\banimate-(bounce|pulse|ping)\b/.test(l)), [])
  })
})
