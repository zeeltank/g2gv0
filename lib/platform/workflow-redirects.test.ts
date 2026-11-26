import { strict as assert } from 'node:assert'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { getRedirectStatusCodeFromError, getRedirectTypeFromError, getURLFromRedirectError } from 'next/dist/client/components/redirect'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import GtmWorkflowsRedirect from '../../app/gtm/workflows/page'
import CrmAutomationRulesRedirect from '../../app/module/crm/marketing/automation-rules/page'
import { CRM_CONTENT } from '../../hooks/content-map-crm'
import { AUTOMATIONS_HREF } from './workflow-tabs'

/**
 * The two retired addresses of Sales & Marketing automation: GTM Workflows (`/gtm/workflows`) and Automation Rules (`/module/crm/marketing/automation-rules`). Both became
 * the Automations tab of the Workflows page in Platform Services (26 Nov 2026). They live on ONLY as redirect pages (a bookmark or a saved link still carries them), and
 * nothing in the content map points at the screens that were deleted. A page that redirects throws Next's redirect error, which carries the address and the status.
 */

const PAGES: Array<[string, () => void]> = [
  ['/gtm/workflows', GtmWorkflowsRedirect],
  ['/module/crm/marketing/automation-rules', CrmAutomationRulesRedirect],
]

function visit(page: () => void) {
  try {
    page()
  } catch (error) {
    if (isRedirectError(error)) return { url: getURLFromRedirectError(error)!, status: getRedirectStatusCodeFromError(error), type: getRedirectTypeFromError(error) }
    throw error
  }
  return assert.fail('the page did not redirect')
}

for (const [address, page] of PAGES) {
  describe(`the redirect page for ${address}`, () => {
    it('sends a visit to the Automations tab of Sales & Marketing as a temporary (307) redirect that replaces the history entry', () => {
      assert.deepEqual(visit(page), { url: '/platform-services/workflow?module=crm&tab=automations', status: 307, type: 'replace' })
      assert.equal(visit(page).url, AUTOMATIONS_HREF)
    })
  })
}

describe('nothing is left of the two retired screens', () => {
  const root = path.resolve(__dirname, '..', '..')

  it('maps neither address, nor the old Workflows address of the CRM, in the content map: a visit never reaches a screen that no longer exists', () => {
    const mapped = CRM_CONTENT.map((route) => route.accessLink)
    for (const address of ['/gtm/workflows', '/module/crm/workflows', '/module/crm/marketing/automation-rules']) assert.equal(mapped.includes(address), false, address)
  })

  it('has deleted the three Automation Rules components, and the content map imports none of the retired screens', () => {
    for (const file of ['automation-rules-view.tsx', 'automation-rules-manager.tsx', 'automation-rules-list-view.tsx']) {
      assert.equal(existsSync(path.join(root, 'components/domain/crm', file)), false, file)
    }
    const map = readFileSync(path.join(root, 'hooks/content-map-crm.ts'), 'utf8')
    assert.doesNotMatch(map, /workflows-view|automation-rules-/)
  })

  it('keeps the redirect pages as the only files in their folders, with no screen of their own', () => {
    for (const folder of ['app/gtm/workflows', 'app/module/crm/marketing/automation-rules']) {
      assert.deepEqual(readdirSync(path.join(root, folder)), ['page.tsx'], folder)
      const source = readFileSync(path.join(root, folder, 'page.tsx'), 'utf8')
      assert.match(source, /redirect\(AUTOMATIONS_HREF\)/)
      assert.doesNotMatch(source, /'use client'|ProtectedLayout|GtgAppShell/)
    }
  })

  it('has no AutomationRule type and no service method for one left in the CRM service or its types', () => {
    const service = readFileSync(path.join(root, 'services/crm/index.ts'), 'utf8')
    const types = readFileSync(path.join(root, 'types/crm.ts'), 'utf8')
    for (const source of [service, types]) assert.doesNotMatch(source, /AutomationRule|automation-rules/)
    assert.match(service, /getAgentRuns|cancelAgentRun/, 'the Agent Run History calls are still there')
  })
})
