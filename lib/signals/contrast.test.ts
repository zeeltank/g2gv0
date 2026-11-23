import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
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
  // Until 13 Nov 2026 (P1-C) this scan also read the Signal Review screen's own files (`signal-review-*.tsx` in the CRM folder). That screen is removed. What it held
  // lives in the parts below, which Company Opportunities shares or added for it, in the Signals folder: the chips, the fit part, the lead action, the decision
  // dialog, the history list, the card's actions, the list with its counts and filters, the Runs panel with its button, and the export button with its notice. Each
  // name is listed, so a rename cannot drop one; and the retired screen's files are looked for (below), so a second screen cannot come back unscanned.
  const signalsDir = path.resolve('components/domain/signals')
  // P1-A2 added the Runs panel (run health and cost, moved here from the Review), its button, and the export button with its notice.
  const SHARED = ['signal-parts', 'signal-fit', 'signal-lead', 'signal-decision-dialog', 'signal-history-list', 'signal-card-actions', 'signal-list', 'signal-runs-panel', 'run-health-button', 'signal-export-button']
  const sharedFiles = SHARED.map((name) => path.join(signalsDir, `${name}.tsx`))
  const files = sharedFiles

  it('finds the components it scans', () => {
    assert.equal(sharedFiles.length, 10, 'ten components are scanned')
    for (const file of sharedFiles) assert.ok(existsSync(file), `${file} exists`)
  })

  it('finds no component of the retired Signal Review screen, so none is left to scan or to import', () => {
    // The seven files that were in the CRM folder: the screen's four (named signal-review-*) and the three that only the screen used or re-exported.
    const retired = readdirSync(path.resolve('components/domain/crm')).filter((name) => /^signal-review-.*\.tsx$/.test(name) || ['signal-generate-dialog.tsx', 'signal-runs-panel.tsx', 'signal-export-button.tsx'].includes(name))
    assert.deepEqual(retired, [], 'the Signal Review screen is one screen now, Company Opportunities; a file of the old one must not come back')
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
