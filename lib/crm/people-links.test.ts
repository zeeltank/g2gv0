import { strict as assert } from 'node:assert'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { getRedirectStatusCodeFromError, getRedirectTypeFromError, getURLFromRedirectError } from 'next/dist/client/components/redirect'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import CrmContactsRedirect from '../../app/module/crm/marketing/contacts/page'
import CrmSupportContactsRedirect from '../../app/module/crm/support/contacts/page'
import CrmContactDetailRedirect from '../../app/module/crm/marketing/contacts/[id]/page'
import CrmSupportContactDetailRedirect from '../../app/module/crm/support/contacts/[id]/page'
import { PersonAddressRoute } from '../../components/domain/crm/person-address-redirect'
import { CRM_CONTENT } from '../../hooks/content-map-crm'
import { entityPath } from '../facts/model'
import { personHref, personPath } from '../org-accounts/links'
import { peopleListTarget, personTarget, type RawSearchParams } from '../people-redirect'

/**
 * S18 (25 Nov 2026), track T3: Contacts were merged into Organizations. These tests prove the addresses (the two old Contacts addresses redirect, from either area), the one way
 * to link to a person (`personHref`), and that nothing in the front end spells an old Contacts address outside the redirect machinery and the sidebar fold. The sidebar fold itself is
 * in lib/crm/people-sidebar.test.ts, the screens in lib/crm/people-screen.test.tsx.
 */

type ListPage = (props: { searchParams: Promise<RawSearchParams> }) => Promise<void>

/** What a list page does for a visit: where it sends the person, with which status and kind of redirect. */
async function visit(page: ListPage, params: RawSearchParams) {
  try {
    await page({ searchParams: Promise.resolve(params) })
  } catch (error) {
    if (isRedirectError(error)) return { url: getURLFromRedirectError(error)!, status: getRedirectStatusCodeFromError(error), type: getRedirectTypeFromError(error) }
    throw error
  }
  return assert.fail('the page did not redirect')
}

describe('a link to a person', () => {
  it('opens a person with a company on that company\'s People tab, and one with none in All people', () => {
    assert.equal(personPath('/module/crm/marketing/organizations', { id: 31, organizationId: 135 }), '/module/crm/marketing/organizations/135?tab=people&person=31')
    assert.equal(personPath('/module/crm/marketing/organizations', { id: 31, organizationId: null }), '/module/crm/marketing/organizations?scope=people&person=31')
    assert.equal(personPath('/module/crm/marketing/organizations', { id: '31' }), '/module/crm/marketing/organizations?scope=people&person=31')
  })

  it('draws no link for an id that is not a record id, and treats a company id that is not one as no company', () => {
    for (const id of [0, '0', '', 'abc', '1.5', '-1', '12abc', null, undefined, '9999999999999999']) assert.equal(personPath('/x', { id: id as never }), null, String(id))
    assert.equal(personPath('/x', { id: 5, organizationId: '0' }), '/x?scope=people&person=5')
    assert.equal(personPath('/x', { id: 5, organizationId: 'abc' }), '/x?scope=people&person=5')
  })

  it('personHref without a menu is the plain address of the area', () => {
    assert.equal(personHref({ id: 31 }), '/module/crm/marketing/organizations?scope=people&person=31')
    assert.equal(personHref({ id: 31, organizationId: 9 }, 'support'), '/module/crm/support/organizations/9?tab=people&person=31')
  })

  it('personHref with the person\'s menu resolves the Organizations row of the area first, then the other area, and is null with neither', () => {
    const menu = (...rows: string[]) => (accessLink: string) => (rows.includes(accessLink) ? accessLink : '/dashboard')
    const both = menu('/module/crm/marketing/organizations', '/module/crm/support/organizations')
    assert.equal(personHref({ id: 3 }, 'marketing', both), '/module/crm/marketing/organizations?scope=people&person=3')
    assert.equal(personHref({ id: 3 }, 'support', both), '/module/crm/support/organizations?scope=people&person=3')
    assert.equal(personHref({ id: 3 }, 'marketing', menu('/module/crm/support/organizations')), '/module/crm/support/organizations?scope=people&person=3', 'the other area when the first is not in the menu')
    assert.equal(personHref({ id: 3 }, 'support', menu('/module/crm/marketing/organizations')), '/module/crm/marketing/organizations?scope=people&person=3')
    assert.equal(personHref({ id: 3 }, 'marketing', menu()), null, 'no Organizations row, no link: not a link to the dashboard')
    assert.equal(personHref({ id: 0 }, 'marketing', both), null)
  })

  it('goes through the person\'s menu when a fact\'s person is linked, and a company or a lead still opens on its own row', () => {
    const resolve = (accessLink: string) => `/m${accessLink}`
    assert.equal(entityPath('contact', 31, resolve), '/m/module/crm/marketing/organizations?scope=people&person=31')
    assert.equal(entityPath('organization', 135, resolve), '/m/module/crm/marketing/organizations/135')
    assert.equal(entityPath('lead', 7, resolve), '/m/module/crm/marketing/leads/7')
    assert.equal(entityPath('contact', 0, resolve), null)
    assert.equal(entityPath('contact', 1.5, resolve), null)
    assert.equal(entityPath('contact', 31, (accessLink) => (accessLink.includes('organizations') ? '/dashboard' : accessLink)), null, 'no Organizations row in the menu: no link')
  })
})

describe('the old Contacts addresses redirect (S18)', () => {
  it('sends the list of each area to All people of the same area, as a temporary (307) redirect that replaces the history entry', async () => {
    assert.deepEqual(await visit(CrmContactsRedirect as ListPage, {}), { url: '/module/crm/marketing/organizations?scope=people', status: 307, type: 'replace' })
    assert.deepEqual(await visit(CrmSupportContactsRedirect as ListPage, {}), { url: '/module/crm/support/organizations?scope=people', status: 307, type: 'replace' })
  })

  it('keeps the Suggestions scope of an old link, and carries nothing else of the query: the path is fixed', async () => {
    assert.equal((await visit(CrmContactsRedirect as ListPage, { scope: 'suggestions' })).url, '/module/crm/marketing/organizations?scope=suggestions')
    assert.equal((await visit(CrmSupportContactsRedirect as ListPage, { scope: 'suggestions' })).url, '/module/crm/support/organizations?scope=suggestions')
    for (const params of [{ scope: 'nonsense' }, { scope: ['suggestions', 'x'] }, { next: 'https://evil.example', q: 'x' }, { scope: 'contacts' }]) {
      assert.equal((await visit(CrmContactsRedirect as ListPage, params as RawSearchParams)).url, '/module/crm/marketing/organizations?scope=people', JSON.stringify(params))
    }
  })

  it('writes one person\'s address from what the person\'s own record says, in the area the visitor came from', () => {
    assert.equal(personTarget({ id: 31, organizationId: 135 }, 'marketing'), '/module/crm/marketing/organizations/135?tab=people&person=31', 'with a company')
    assert.equal(personTarget({ id: 31, organizationId: null }, 'marketing'), '/module/crm/marketing/organizations?scope=people&person=31', 'without a company')
    assert.equal(personTarget({ id: 31, organizationId: 135 }, 'support'), '/module/crm/support/organizations/135?tab=people&person=31', 'the Support area')
    assert.equal(personTarget({ id: 0 }, 'marketing'), null)
    assert.equal(peopleListTarget('support'), '/module/crm/support/organizations?scope=people')
  })

  it('has a page for the person of each area, which keeps the area', () => {
    const marketing = CrmContactDetailRedirect() as unknown as { type: unknown; props: { area: string } }
    const support = CrmSupportContactDetailRedirect() as unknown as { type: unknown; props: { area: string } }
    assert.equal(marketing.type, PersonAddressRoute)
    assert.equal(marketing.props.area, 'marketing')
    assert.equal(support.type, PersonAddressRoute)
    assert.equal(support.props.area, 'support')
  })

  it('maps no screen for either address any more: both are redirect pages', () => {
    const links = CRM_CONTENT.map((route) => route.accessLink ?? '')
    assert.deepEqual(links.filter((link) => /\/(marketing|support)\/contacts/.test(link)), [])
    assert.ok(links.includes('/module/crm/marketing/organizations'))
    assert.ok(links.includes('/module/crm/support/organizations'), 'the Support list is the same Organizations screen')
  })
})

// ---------------------------------------------------------------------------------------------------------------------------- nothing links to the old address

/**
 * Nothing in the front end may spell an old Contacts address. They live on ONLY as the redirect pages under app/ (their folders ARE the addresses), the sidebar fold that
 * names the two menu rows it does not draw, and what proves them. A person is linked with `personHref`.
 */
const ROOT = path.resolve(__dirname, '..', '..')
const FOLDERS = ['app', 'components', 'hooks', 'lib', 'services']
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.mdx'])
const ADDRESS = /\/module\/crm\/(?:marketing|support)\/contacts(?![\w-])/

interface Allowance { file: string; line?: RegExp; why: string }
const ALLOWED: Allowance[] = [
  { file: 'lib/people-redirect.ts', why: 'the redirect helper: its comment lists the old addresses and where they land' },
  { file: 'lib/crm/people-links.test.ts', why: 'this file: the detector and its examples' },
  { file: 'lib/crm/people-sidebar.test.ts', why: 'tests the sidebar fold, so it names the two menu rows on purpose' },
  { file: 'lib/crm/people-screen.test.tsx', why: 'tests the screens and the redirect component, so it names an old address on purpose' },
  { file: 'lib/signals-nav.ts', line: /'\/module\/crm\/(?:marketing|support)\/contacts'/, why: 'the sidebar fold names the two menu rows it does not draw (the rows stay in the database with status 1) and the addresses that still resolve' },
  { file: 'lib/people-tab/kit.ts', why: 'T2: a fixture of the real menu, which still holds the Contacts row (it keeps status 1) with its rights' },
  { file: 'lib/people-tab/people-rights.test.ts', why: 'T2: proves the rights are read from the Contacts rows of the raw menu, so it spells their addresses' },
  { file: 'lib/facts/contact-detail.test.tsx', why: 'T2: tests the old ContactDetailPage at its old address; it goes with the page when T2 deletes it' },
  { file: 'components/domain/crm/people/people-rights.ts', why: 'the identity of the two menu rows whose rights (view, add, edit, delete) it reads from the raw menu answer' },
  { file: 'lib/ask/context.ts', why: 'the Ask chat still reads a person from the old address while a visit to it is being redirected, and a person open on a company page by `?person=`' },
  { file: 'lib/ask/context.test.ts', why: 'proves both readings above' },
  { file: 'lib/ask/chat-widget.test.tsx', line: /support\/contacts\/45/, why: 'a sample of a record page the widget reads a context from' },
  // A fixture of the real menu, which still holds the rows (they keep status 1).
  { file: 'lib/facts/screen-kit.ts', why: 'a fixture of the real menu, which still holds the Contacts row (it keeps status 1)' },
  { file: 'lib/facts/model.test.ts', line: /sourceView\('\/module\/crm\/marketing\/contacts\/31'\)|href: '\/module\/crm\/marketing\/contacts\/31'/, why: 'an evidence source address is any internal path; the sample is a saved link' },
  { file: 'lib/facts/fact-parts.test.tsx', why: 'an evidence source address and a record link are props here; the sample is a saved link' },
  { file: 'lib/facts/fact-suggestions.test.tsx', line: /marketing\/contacts\/31/, why: 'an evidence source address is any internal path; the sample is a saved link' },
]

function violations(relative: string, text: string): string[] {
  const rule = ALLOWED.find((a) => a.file === relative)
  const found: string[] = []
  text.split(/\r?\n/).forEach((line, index) => {
    if (!ADDRESS.test(line)) return
    if (rule && (!rule.line || rule.line.test(line))) return
    found.push(`${relative}:${index + 1}: ${line.trim()}`)
  })
  return found
}

function sourceFiles(root: string, folders: string[]): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.next') walk(`${dir}/${entry.name}`)
      } else if (EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        out.push(`${dir}/${entry.name}`)
      }
    }
  }
  for (const folder of folders) {
    try { walk(folder) } catch { /* a folder that is not there has nothing to scan; the coverage test below fails if one of ours went missing */ }
  }
  return out.sort()
}

describe('nothing in the front end links to an old Contacts address', () => {
  it('names neither old address anywhere outside the allowances (the redirect pages do not even need one)', () => {
    const found = sourceFiles(ROOT, FOLDERS).flatMap((file) => violations(file, readFileSync(path.join(ROOT, file), 'utf8')))
    assert.deepEqual(found, [], `These lines name an old Contacts address. A person is linked with personHref (lib/org-accounts/links.ts):\n  ${found.join('\n  ')}`)
  })

  it('reads the files that used to make the link, and enough of the application', () => {
    const files = sourceFiles(ROOT, FOLDERS)
    for (const expected of [
      'hooks/content-map-crm.ts', 'lib/signals-nav.ts', 'lib/gtg-navigation.ts', 'lib/facts/model.ts', 'lib/ask/context.ts', 'components/domain/crm/ticket-detail-page.tsx',
      'components/domain/crm/invoice-detail-page.tsx', 'components/domain/crm/quote-detail-page.tsx', 'components/domain/crm/sales-order-detail-page.tsx',
      'components/domain/crm/people-table.tsx', 'components/domain/crm/org-account-360-parts.tsx', 'app/module/crm/marketing/contacts/page.tsx', 'app/module/crm/support/contacts/[id]/page.tsx',
    ]) assert.ok(files.includes(expected), `${expected} is not scanned`)
    assert.ok(files.length > 800, `only ${files.length} files were scanned`)
  })

  it('sees an address in the ways it can be spelled, and ignores what only looks like one', () => {
    for (const line of [
      "const a = '/module/crm/marketing/contacts'", "router.push(`/module/crm/marketing/contacts/${id}`)", "resolveAccessLink('/module/crm/support/contacts') + '/' + id",
      '<a href="/module/crm/support/contacts/12">', "{ accessLink: '/module/crm/marketing/contacts', component: X }",
    ]) assert.ok(ADDRESS.test(line), `should be seen: ${line}`)
    for (const line of [
      "const a = '/module/crm/marketing/organizations/12'", "const b = '/module/crm/sales/contacts/4'", "const c = '/module/crm/marketing/contacts-old'", "const d = '/module/crm/marketing/contactsx'",
      "const e = '/module/crm/support/organizations?scope=people'", "const f = '/module/crm/marketing/leads/4'",
    ]) assert.ok(!ADDRESS.test(line), `should be ignored: ${line}`)
  })

  it('has a person link go through personHref on every screen that makes one', () => {
    const makers = ['invoice-detail-page', 'quote-detail-page', 'sales-order-detail-page', 'ticket-detail-page'].map((name) => `components/domain/crm/${name}.tsx`)
    for (const file of makers) {
      const text = readFileSync(path.join(ROOT, file), 'utf8')
      assert.match(text, /personHref\(\{ id: \w+\.contactId \}, 'marketing', resolveAccessLink\)/, `${file} links its Contact field with personHref`)
    }
    assert.match(readFileSync(path.join(ROOT, 'lib/facts/model.ts'), 'utf8'), /personHref\(\{ id \}, 'marketing', resolve\)/, 'a fact\'s person is linked with personHref')
    assert.match(readFileSync(path.join(ROOT, 'components/domain/crm/org-account-360-parts.tsx'), 'utf8'), /personPath\(links\.crmOrganisations/, 'Account 360 links a CRM person with personPath')
  })
})
