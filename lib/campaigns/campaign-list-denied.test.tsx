import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent, says } from '../agent/assertions'
import { campaign, listAnswer } from './fixtures'
import { screenKit } from './screen-kit'

/**
 * The CRM campaign list when the server REFUSES it (FIX-e2e A4). The day-in-the-life run saw "No campaigns yet. Click Add Campaign to create one." and an
 * Add Campaign button after a 403: a person with no right on the screen was told there were no campaigns and invited to make one.
 */

async function open(answer: 'denied' | 'broken' | 'ok') {
  const screen = await screenKit({
    respond: (call) => {
      if (call.path.endsWith('/crm/campaigns')) {
        if (answer === 'denied') return { status: 0, message: 'You do not have the right to view campaigns.', __status: 403 }
        if (answer === 'broken') return { status: 0, message: 'Something broke on the server.', __status: 500 }
        return listAnswer([campaign()], 1)
      }
      if (call.path.endsWith('/crm/picklist-values')) return { status: 1, message: 'ok', data: { campaigns: {} } }
      return undefined
    },
  })
  const { CampaignListView } = await import('../../components/domain/crm/campaign-list-view')
  await screen.mount(screen.k.h(CampaignListView), 50)
  const buttons = () => screen.k.all('button').map((b) => b.textContent?.trim())
  return { ...screen, buttons }
}

describe('the CRM campaign list after a refusal (A4)', () => {
  afterEach(async () => { await disposeAll() })

  it('a 403 shows "You do not have access to this screen" and nothing else to act on', async () => {
    const s = await open('denied')
    const panel = s.k.one('[data-campaigns-denied]')
    assert.ok(panel, 'the denied state is drawn')
    says(panel.textContent, 'You do not have access to this screen.')
    assert.equal(s.k.bodyText().includes('No campaigns yet'), false, 'it does not claim there are no campaigns')
    assert.equal(s.k.bodyText().includes('Add Campaign'), false, 'it does not invite the person to add one')
    assert.equal(s.buttons().some((b) => b === 'Import' || (b ?? '').includes('Add Campaign')), false, 'no Import or Add button')
    absent(s.k.one('table'), 'no table')
    s.restore()
  })

  it('the denied state has no accessibility violation a fake browser can find', async () => {
    const s = await open('denied')
    assert.deepEqual(await axeViolations(s.k.w.document.body), [])
    s.restore()
  })

  it('a server error is not "no campaigns yet" either: it says the campaigns could not be loaded', async () => {
    const s = await open('broken')
    absent(s.k.one('[data-campaigns-denied]'), 'a 500 is not a refusal')
    says(s.k.bodyText(), 'The campaigns could not be loaded.')
    assert.equal(s.k.bodyText().includes('No campaigns yet'), false)
    says(s.k.bodyText(), 'Something broke on the server.')
    s.restore()
  })

  it('a person with the right still sees the list and the Add Campaign button', async () => {
    const s = await open('ok')
    absent(s.k.one('[data-campaigns-denied]'), 'no denied state')
    says(s.k.bodyText(), 'Diwali outreach')
    assert.ok(s.buttons().some((b) => (b ?? '').includes('Add Campaign')))
    s.restore()
  })
})
