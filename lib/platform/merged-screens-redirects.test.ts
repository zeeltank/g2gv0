import { strict as assert } from 'node:assert'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { getRedirectStatusCodeFromError, getRedirectTypeFromError, getURLFromRedirectError } from 'next/dist/client/components/redirect'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import CrmAgentRunsRedirect from '../../app/module/crm/marketing/agent-runs/page'
import CrmMasterFieldsRedirect from '../../app/module/crm/master-fields/page'
import { CRM_CONTENT } from '../../hooks/content-map-crm'
import { M7_CONTENT } from '../../hooks/content-map-m7'

/**
 * The two retired addresses of Sales & Marketing: Master Fields (`/module/crm/master-fields`, now tabs of Field settings) and Agent Run History
 * (`/module/crm/marketing/agent-runs`, now the "Sales & Marketing agents" section of the Agentic AI Run Log), both merged on 26 Nov 2026. They live on ONLY as redirect pages (a
 * bookmark, a saved link or an agent message still carries them), and nothing in the content map points at the screens that were folded. A page that redirects throws Next's redirect
 * error, which carries the address and the status.
 */

async function visit(page: () => unknown) {
  try {
    await page()
  } catch (error) {
    if (isRedirectError(error)) return { url: getURLFromRedirectError(error)!, status: getRedirectStatusCodeFromError(error), type: getRedirectTypeFromError(error) }
    throw error
  }
  return assert.fail('the page did not redirect')
}

const runs = (search: Record<string, string | string[] | undefined>) => visit(() => CrmAgentRunsRedirect({ searchParams: Promise.resolve(search) }))

describe('the redirect page for /module/crm/master-fields', () => {
  it('sends a visit to the Picklist values tab of Field settings for Sales & Marketing, as a temporary (307) redirect that replaces the history entry', async () => {
    assert.deepEqual(await visit(CrmMasterFieldsRedirect), { url: '/platform-services/fields-configuration?module=crm&tab=picklists', status: 307, type: 'replace' })
  })
})

describe('the redirect page for /module/crm/marketing/agent-runs', () => {
  const BASE = '/module/agentic-ai/run-log?section=sales-marketing'

  it('sends a plain visit to the Sales & Marketing agents section of the Run Log, as a temporary (307) redirect that replaces the history entry', async () => {
    assert.deepEqual(await runs({}), { url: BASE, status: 307, type: 'replace' })
  })

  it('keeps the sub-tab an old link named', async () => {
    assert.equal((await runs({ tab: 'waiting' })).url, `${BASE}&tab=waiting`)
    assert.equal((await runs({ tab: 'autonomy' })).url, `${BASE}&tab=autonomy`)
    assert.equal((await runs({ tab: ['waiting', 'autonomy'] })).url, `${BASE}&tab=waiting`, 'a repeated parameter reads as its first value')
  })

  it('cannot be made to leave the Run Log: a hostile sub-tab is written into the query string, not into the path', async () => {
    const { url } = await runs({ tab: '//evil.example/x?y=1&section=agentic' })
    assert.ok(url.startsWith('/module/agentic-ai/run-log?section=sales-marketing&tab='), url)
    assert.equal(new URL(url, 'https://example.test').host, 'example.test')
    assert.equal(new URL(url, 'https://example.test').searchParams.get('section'), 'sales-marketing')
  })
})

describe('nothing is left of the two folded screens', () => {
  const root = path.resolve(__dirname, '..', '..')

  it('maps neither retired address in the content map: a visit never reaches a screen that no longer exists', () => {
    const mapped = CRM_CONTENT.map((route) => route.accessLink)
    for (const address of ['/module/crm/master-fields', '/module/crm/marketing/agent-runs']) assert.equal(mapped.includes(address), false, address)
  })

  it('maps the Run Log, in the Agentic AI map, to the page that carries both sections', () => {
    assert.ok(M7_CONTENT.some((route) => route.accessLink === '/module/agentic-ai/run-log'))
    const source = readFileSync(path.join(root, 'hooks/content-map-m7.ts'), 'utf8')
    assert.match(source, /ag-run-log-page/)
  })

  it('keeps the redirect pages as the only files in their folders, with no screen of their own', () => {
    for (const folder of ['app/module/crm/master-fields', 'app/module/crm/marketing/agent-runs']) {
      assert.deepEqual(readdirSync(path.join(root, folder)), ['page.tsx'], folder)
      const source = readFileSync(path.join(root, folder, 'page.tsx'), 'utf8')
      assert.match(source, /redirect\(/)
      assert.doesNotMatch(source, /'use client'|ProtectedLayout|GtgAppShell/)
    }
  })

  it('still has the five admin consoles and the Sales & Marketing agents screen, which are the contents of the new homes', () => {
    for (const file of ['crm-picklist-admin.tsx', 'crm-tax-rate-admin.tsx', 'crm-lead-routing-admin.tsx', 'crm-lead-capture-admin.tsx', 'crm-sla-policy-admin.tsx', 'agent-runs-view.tsx']) {
      assert.equal(existsSync(path.join(root, 'components/domain/crm', file)), true, file)
    }
  })
})
