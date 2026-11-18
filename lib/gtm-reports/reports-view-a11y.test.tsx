import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent } from '../agent/assertions'
import { screenKit } from '../leads/screen-kit'

/**
 * The GTM Reports table as a person meets it (FIX-e2e A6): the box that scrolls the table sideways must be reachable by keyboard (axe:
 * scrollable-region-focusable, serious), so it is focusable, a named region. The real screen, the real service client, only the network replaced.
 */

const REPORT = {
  key: 'pipeline', title: 'Pipeline by stage', description: 'Open deals by stage.', pii: false, admin_only: false, filters: {}, enums: [],
  columns: { stage: { label: 'Stage', type: 'text' }, deals: { label: 'Deals', type: 'number' } },
}

async function open(rows: Array<Record<string, unknown>>) {
  const screen = await screenKit({
    pathname: '/gtm/reports',
    respond: (call) => {
      if (call.path.endsWith('/gtm/reports')) return { status: 1, data: { reports: [REPORT], can_export: false, max_rows: 5000 } }
      if (call.path.endsWith('/gtm/reports/pipeline')) {
        return { status: 1, data: { report: { ...REPORT, masked: false }, filters: {}, summary: { rows: rows.length }, truncated: false, total: rows.length, page: 1, per_page: 50, rows } }
      }
      return undefined
    },
  })
  const { ReportsView } = await import('../../components/domain/gtm/reports-view')
  await screen.mount(screen.k.h(ReportsView), 80)
  return screen
}

describe('the GTM Reports table scroll box (A6)', () => {
  afterEach(async () => { await disposeAll() })

  it('is a focusable, named region around the table', async () => {
    const s = await open([{ stage: 'Proposal', deals: 3 }, { stage: 'Won', deals: 1 }])
    assert.ok(s.k.one('table'), 'the table is drawn')
    const box = s.k.one('[role="region"][aria-label="Pipeline by stage results"]')
    assert.ok(box, 'a region named after the report is drawn')
    assert.equal(box.getAttribute('tabindex'), '0', 'it can take keyboard focus')
    assert.ok(box.querySelector('table'), 'and it is the box that holds the table')
    s.restore()
  })

  it('has no accessibility violation a fake browser can find', async () => {
    const s = await open([{ stage: 'Proposal', deals: 3 }])
    assert.deepEqual(await axeViolations(s.k.w.document.body), [])
    s.restore()
  })

  it('draws no scroll box when there are no rows', async () => {
    const s = await open([])
    absent(s.k.one('[role="region"][aria-label="Pipeline by stage results"]'), 'nothing to scroll')
    s.restore()
  })
})
