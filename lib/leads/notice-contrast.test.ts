import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { color, dark, light, MIN, ratio, token } from '../theme-contrast'
import { NOTICE_TONE } from '../org-accounts/tones'

/**
 * FIX-e2e A6, lead page: the success banners ("Saved.", "No contact was created ...", "This lead was converted to ...") were `bg-success/5 text-success`,
 * 2.1:1 in a real browser's axe run. They now take NOTICE_TONE.success (words in the foreground colour on a solid card, only the border coloured). jsdom
 * computes no colour, so this is a scan of the class strings plus the real ratio of the tone from app/globals.css, in both themes.
 */

const source = readFileSync(path.resolve('components/domain/crm/lead-detail-page.tsx'), 'utf8').split(/\r?\n/)
const bannerLines = (marker: string) => source.map((text, index) => ({ text, line: index + 1 })).filter((row) => row.text.includes(marker))

describe('the lead page\'s success banners (A6)', () => {
  for (const marker of ['data-lead-notice', 'data-lead-converted']) {
    it(`${marker}: takes NOTICE_TONE.success and no status colour of its own`, () => {
      const rows = bannerLines(marker)
      assert.equal(rows.length, 1, `exactly one element carries ${marker}`)
      const { text, line } = rows[0]
      assert.ok(text.includes('NOTICE_TONE.success'), `line ${line} uses the shared tone`)
      assert.equal(/\b(?:bg|border|text)-(?:success|warning|destructive|primary)(?:\/\d+)?\b/.test(text), false, `line ${line} writes no status colour itself`)
    })
  }

  for (const [theme, vars] of [['light', light], ['dark', dark]] as const) {
    it(`NOTICE_TONE.success reads at ${MIN}:1 or better in the ${theme} theme`, () => {
      const value = ratio(color(`var(${token(NOTICE_TONE.success, 'text')})`, vars), color(`var(${token(NOTICE_TONE.success, 'bg')})`, vars))
      assert.ok(value >= MIN, `${value.toFixed(2)}:1`)
    })
  }

  it('no line of the page is the old low-contrast banner (success text on a tint of success)', () => {
    const offences = source.map((text, index) => ({ text, line: index + 1 })).filter((row) => /bg-success\/5\b/.test(row.text) && /text-success\b/.test(row.text))
    assert.deepEqual(offences.map((row) => row.line), [])
  })
})
