import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { screenKit, type Call } from '../leads/screen-kit'

/**
 * Prospecting's account (S20) as a person meets it: a link from a signal (?account=41) opens the account; "Qualify as lead" asks WHICH person (one who asked not to be
 * contacted is shown, disabled, with the reason), says what it does, sends the person, and tells what it made with a link; the account lists the leads made from it.
 * The real view, only the network replaced.
 */

const ACCOUNT = {
  id: 41, company_id: 5, name: 'Greenfield School', domain: 'greenfield.example', website: null, industry: 'Education', employee_range: null, location: null, stage: 'target',
  owner_user_id: null, icp_fit_score: null, icp_fit_basis: null, icp_scored_at: null, source: 'research', notes: null, created_at: '2026-11-25T10:00:00Z',
}
const person = (id: number, full_name: string, status = 'active', title: string | null = null) => ({
  id, account_id: 41, full_name, title, email: null, phone: null, linkedin_url: null, role_in_deal: null, status,
})

async function open(detail: Record<string, unknown>, search = '?account=41') {
  const posts: Array<{ path: string; body: unknown }> = []
  // The fake browser's address, which the view reads on mount.
  const { w } = await import('../scaffolds/dom-test-kit')
  w.history.replaceState({}, '', `/gtm/prospecting${search}`)
  const screen = await screenKit({
    pathname: '/gtm/prospecting',
    search,
    respond: (call: Call) => {
      if (call.method === 'GET' && call.path.endsWith('/gtm/accounts/41')) return { status: 1, data: { account: ACCOUNT, contacts: [], signals: [], activities: [], analyses: [], leads: [], ...detail } }
      if (call.method === 'GET' && call.path.endsWith('/gtm/accounts/41/cross-module-links')) return { status: 1, data: { crm_organization: null, signals_company: null } }
      if (call.method === 'GET' && call.path.endsWith('/gtm/directory')) return { status: 1, data: { users: [], departments: [] } }
      if (call.method === 'GET' && call.path.endsWith('/gtm/accounts')) return { status: 1, data: { items: [], total: 0, page: 1, per_page: 25 } }
      if (call.method === 'GET' && call.path.endsWith('/table_data')) return [{ id: 2, first_name: 'Anil', last_name: 'Shah' }]
      if (call.method === 'POST' && call.path.endsWith('/gtm/accounts/41/qualify-as-lead')) {
        posts.push({ path: call.path, body: call.body })
        return { status: 1, data: { lead_id: '502', lead_no: 'LD-00502', created: true, stage: 'engaged' } }
      }
      return undefined
    },
  })
  const { ProspectingView } = await import('../../components/domain/gtm/prospecting-view')
  await screen.mount(screen.k.h(ProspectingView, null), 200)
  const { k } = screen
  const dialogs = () => k.all('[role="dialog"]')
  const accountDialog = () => dialogs().find((d) => d.textContent?.includes('Greenfield School'))
  const link = (label: string) => k.all('a').find((a) => a.textContent?.trim() === label) ?? null
  const radios = () => k.all('[role="dialog"] input[name="qualify-person"]') as HTMLInputElement[]
  const labelOf = (r: HTMLInputElement) => k.w.document.querySelector(`label[for="${r.id}"]`)?.textContent?.trim() ?? ''
  return { ...screen, posts, dialogs, accountDialog, link, radios, labelOf }
}

describe('Prospecting: the account a signal links to', () => {
  afterEach(async () => { await disposeAll() })

  it('opens the account named in ?account= and lists the leads made from it', async () => {
    const s = await open({
      contacts: [person(3, 'Rahul Verma', 'active', 'Principal')],
      leads: [{ id: '501', leadNo: 'LD-00501', name: 'Rahul Verma', status: 'New', contactId: 3 }],
    })
    assert.ok(s.accountDialog(), 'the account is open')
    assert.ok(s.k.bodyText().includes('Leads from this account (1)'))
    assert.equal(s.link('Rahul Verma')?.getAttribute('href'), '/module/crm/marketing/leads/501')
    assert.ok(s.k.bodyText().includes('LD-00501'))
  })

  it('opens nothing for an address that does not name an account', async () => {
    const s = await open({}, '?account=abc')
    assert.equal(s.accountDialog(), undefined)
  })
})

describe('Prospecting: Qualify as lead', () => {
  afterEach(async () => { await disposeAll() })

  it('explains that an account with nobody at it needs a person first, and offers no way to qualify', async () => {
    const s = await open({ contacts: [] })
    const button = s.k.withText('Qualify as lead') as HTMLButtonElement
    assert.equal(button.disabled, true)
    assert.equal(button.getAttribute('title'), 'Add a person to this account first.')
    assert.ok(s.k.bodyText().includes('Add a person to this account first.'))
  })

  it('asks which person, shows the one who asked not to be contacted disabled with the reason, and says what it does', async () => {
    const s = await open({ contacts: [person(4, 'Dee Enn', 'do_not_contact'), person(3, 'Rahul Verma', 'active', 'Principal')] })
    await s.k.click(s.k.withText('Qualify as lead')!)
    await s.k.tick(60)

    assert.ok(s.k.bodyText().includes('This creates a lead for this person and marks the account Engaged.'))
    assert.deepEqual(s.radios().map((r) => ({ label: s.labelOf(r), disabled: r.disabled })), [
      { label: 'Rahul Verma · Principal', disabled: false },
      { label: 'Dee Enn — asked not to be contacted', disabled: true },
    ])
  })

  it('needs a person before it sends anything', async () => {
    const s = await open({ contacts: [person(3, 'Rahul Verma')] })
    await s.k.click(s.k.withText('Qualify as lead')!)
    await s.k.tick(60)
    const submit = s.k.all('[role="dialog"] button').filter((b) => b.textContent?.trim() === 'Qualify as lead').pop()!
    await s.k.click(submit)
    await s.k.tick(30)

    assert.equal(s.k.one('[role="dialog"] [role="alert"]')?.textContent, 'Choose the person this lead is for.')
    assert.deepEqual(s.posts, [])
  })

  it('sends the chosen person, then says what it made with a link to the lead, and reloads the account', async () => {
    const s = await open({ contacts: [person(3, 'Rahul Verma')] })
    await s.k.click(s.k.withText('Qualify as lead')!)
    await s.k.tick(60)
    await s.k.click(s.radios()[0])
    await s.k.tick(20)
    const submit = s.k.all('[role="dialog"] button').filter((b) => b.textContent?.trim() === 'Qualify as lead').pop()!
    await s.k.click(submit)
    await s.k.tick(80)

    assert.equal(s.posts.length, 1, 'one request')
    assert.match(s.posts[0].path, /\/gtm\/accounts\/41\/qualify-as-lead$/)
    assert.deepEqual(s.posts[0].body, { contactId: 3 }, 'the person, and no owner: the server defaults to the caller')
    assert.ok(s.k.bodyText().includes('Lead created for Rahul Verma. The account is now Engaged.'))
    assert.equal(s.link('Open lead')?.getAttribute('href'), '/module/crm/marketing/leads/502')
    assert.equal(s.calls.filter((c) => c.method === 'GET' && c.path.endsWith('/gtm/accounts/41')).length >= 2, true, 'the account was read again, so its stage and leads are current')
  })
})
