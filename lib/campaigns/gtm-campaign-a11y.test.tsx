import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { color, dark, light, MIN, ratio } from '../theme-contrast'
import { gtmDetail } from './fixtures'
import { screenKit } from './screen-kit'

/**
 * FIX-e2e A6 on the GTM campaign page: the segment Select in "Add targets" had no accessible name (axe: button-name, critical), and the Remove button was
 * `text-destructive` on the page background, 4.32:1. jsdom computes no colour, so the Remove button is proved by a scan of the class string plus the real
 * ratio of the pair that replaces it, from app/globals.css, in both themes.
 */

const member = (over: Record<string, unknown> = {}) => ({
  id: 31, account_id: 12, account_name: 'Hillcrest Academy', account_stage: 'target', contact_id: null, contact_name: null, contact_status: null, created_at: '2026-11-02 09:00:00', ...over,
})

async function open() {
  const screen = await screenKit({
    pathname: '/gtm/campaigns',
    respond: (call) => (call.path.endsWith('/gtm/campaigns/5') ? { status: 1, data: gtmDetail({ members: [member(), member({ id: 32, account_name: 'Northfield School', contact_name: 'Asha Menon', contact_status: 'active' })] }) } : undefined),
  })
  const { CampaignDetailView } = await import('../../components/domain/gtm/campaigns-detail')
  await screen.mount(screen.k.h(CampaignDetailView, { id: 5, segments: [], ownerName: () => 'Asha Menon', onBack: () => undefined, onEdit: () => undefined, onChanged: () => undefined }), 60)
  return screen
}

const source = readFileSync(path.resolve('components/domain/gtm/campaigns-detail.tsx'), 'utf8').split(/\r?\n/)

describe('the GTM campaign page: names and contrast (A6)', () => {
  afterEach(async () => { await disposeAll() })

  it('the segment Select in "Add targets" has an accessible name', async () => {
    const s = await open()
    assert.ok(s.k.bodyText().includes('Add targets'), 'the Add targets section is drawn')
    const box = s.k.one('[role="combobox"]')
    assert.ok(box, 'the segment Select is drawn')
    assert.equal(box.getAttribute('aria-label'), 'Segment to add targets from')
    s.restore()
  })

  it('axe finds no unnamed button on the page (the targets table and the Add targets section included)', async () => {
    const s = await open()
    const violations = await axeViolations(s.k.w.document.body)
    assert.deepEqual(violations.filter((v) => v.startsWith('button-name')), [], 'no button-name violation')
    s.restore()
  })

  it('each Remove button names the target it removes', async () => {
    const s = await open()
    const names = s.k.all('button').filter((b) => b.textContent?.trim() === 'Remove').map((b) => b.getAttribute('aria-label'))
    assert.deepEqual(names, ['Remove Hillcrest Academy from this campaign', 'Remove Asha Menon from this campaign'])
    s.restore()
  })

  it('no button on the page writes the destructive colour as its TEXT (the Remove button and the Archive / Mark completed buttons)', () => {
    const offences = source.map((text, index) => ({ text, line: index + 1 })).filter((row) => /\btext-destructive\b/.test(row.text) && /<Button\b/.test(row.text))
    assert.deepEqual(offences.map((row) => `${row.line}: ${row.text.trim().slice(0, 100)}`), [])
  })

  for (const [theme, vars] of [['light', light], ['dark', dark]] as const) {
    it(`the replacement pair (foreground text on the page background, the border carries the colour) reads at ${MIN}:1 in the ${theme} theme`, () => {
      assert.ok(ratio(color('var(--foreground)', vars), color('var(--background)', vars)) >= MIN)
    })
  }

  it('the destructive buttons share one tone: a destructive BORDER and foreground text, used by Remove and by the confirm-state buttons', () => {
    const definition = source.filter((text) => /const DESTRUCTIVE_BUTTON\s*=/.test(text))
    assert.equal(definition.length, 1, 'one definition')
    assert.ok(/'border-destructive text-foreground'/.test(definition[0]), 'the tone is a destructive border with foreground text')
    assert.equal(source.filter((text) => /className=\{DESTRUCTIVE_BUTTON\}/.test(text) && text.includes('variant="outline"')).length, 1, 'the Remove button uses it')
    assert.equal(source.filter((text) => /\? DESTRUCTIVE_BUTTON : undefined/.test(text)).length, 1, 'the confirm-state buttons use it')
  })
})
