import { strict as assert } from 'node:assert'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { getRedirectStatusCodeFromError, getURLFromRedirectError } from 'next/dist/client/components/redirect'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import PartnersRedirect from '../app/partners/page'
import type { NavModule, NavNode } from './gtg-navigation'
import { isCrmPath } from './platform/module-scope'
import { collapseSignalsNav, SIGNALS_TABS, visibleSignalsTabs } from './signals-nav'
import { portfolioService } from '../services/portfolio/portfolio-service'

/**
 * The Partner Network tab of Market Signals was removed on 26 Nov 2026 (owner decision). Its old address /partners stays as a redirect page to /signals, so a bookmark or a
 * stored link does not end on a 404; the tab, its screen and its service calls are gone. The database row behind the tab is deleted by hp_erp's `signals:market-signals-menu`
 * command on each host, so for a while a person's menu may still hold it: the sidebar must not draw it then.
 */

const root = join(__dirname, '..')

/** What the page does for a visit: where it sends the person, with which status. */
function visit() {
  try {
    ;(PartnersRedirect as () => never)()
  } catch (error) {
    if (isRedirectError(error)) return { url: getURLFromRedirectError(error)!, status: getRedirectStatusCodeFromError(error) }
    throw error
  }
  return assert.fail('the page did not redirect')
}

describe('the /partners address', () => {
  it('sends a visitor to Market Signals with a temporary (307) redirect, and takes no query string with it', () => {
    assert.deepEqual(visit(), { url: '/signals', status: 307 })
    assert.equal(PartnersRedirect.length, 0, 'the page reads no search parameters, so a filter of the old screen (status, type) never reaches Market Signals')
  })

  it('is the only file of its folder, and draws no screen, no frame and no partner list', () => {
    assert.deepEqual(readdirSync(join(root, 'app/partners')), ['page.tsx'])
    const page = readFileSync(join(root, 'app/partners/page.tsx'), 'utf8')
    assert.doesNotMatch(page, /SignalsFrame|PartnersView|PremiumPage|'use client'/)
    assert.equal(existsSync(join(root, 'components/domain/portfolio/partners-view.tsx')), false, 'the screen file is gone')
  })
})

describe('the Signals tabs and the services after the removal', () => {
  it('lists four tabs, none of them for partners, and the first reads Market Signals under the same key', () => {
    assert.deepEqual(SIGNALS_TABS.map((t) => [t.key, t.label]), [['opportunities', 'Market Signals'], ['ingestion', 'Ingestion Engine'], ['portfolio', 'Product Portfolio'], ['outreach', 'Outreach']])
    assert.deepEqual(visibleSignalsTabs(null).map((t) => t.route), ['/signals', '/ingestion', '/signals/portfolio', '/signals/outreach'])
  })

  it('treats /partners as no screen of Sales & Marketing: the address only redirects', () => {
    assert.equal(isCrmPath('/partners'), false)
    assert.equal(isCrmPath('/signals'), true)
  })

  it('has no partner call left in the portfolio service, while the readiness flag and the matching calls stay', () => {
    const names = Object.keys(portfolioService)
    assert.deepEqual(names.filter((n) => /partner/i.test(n)), [])
    for (const kept of ['getOffers', 'getPortfolioStats', 'getSignalMatches', 'getOpportunityMatches', 'getFindingMatches', 'actOnMatch']) assert.ok(names.includes(kept), kept)
  })
})

describe('a menu that still holds the old row (the database command has not run on that host yet)', () => {
  const leaf = (id: number, label: string, accessLink: string | null): NavNode => ({ id: String(id), label, accessLink, children: [] })
  const crm = (children: NavNode[]): NavModule => ({ id: '199', label: 'Sales & Marketing', short: 'S&M', accessLink: null, children })
  /** The branch before the rename command (first tab still called Company Opportunities, the removed tab's row still there) and after it. */
  const branch = (firstTab: string, withOldRow: boolean): NavNode => ({
    id: '489', label: 'Market Signals', accessLink: '/module/crm/signals',
    children: [leaf(490, firstTab, '/signals'), leaf(491, 'Ingestion Engine', '/ingestion'), leaf(492, 'Product Portfolio', '/portfolio'), ...(withOldRow ? [leaf(493, 'Partner Network', '/partners')] : [])],
  })
  const ids = (nodes: NavNode[]) => nodes.map((n) => n.id)

  it('draws Market Signals as one flat link, never the old row, whichever name the first tab still has', () => {
    const states: Array<[string, NavNode]> = [
      ['before the command', branch('Company Opportunities', true)],
      ['renamed, row not deleted yet', branch('Market Signals', true)],
      ['after the command', branch('Market Signals', false)],
    ]
    const results = states.map(([name, signals]) => {
      const out = collapseSignalsNav([crm([leaf(442, 'Command Center', '/module/crm/command-center'), signals])])
      const marketSignals = out.modules[0].children.find((c) => c.id === '489')!
      assert.equal(marketSignals.accessLink, '/signals', name)
      assert.deepEqual(marketSignals.children, [], name)
      assert.deepEqual(ids(out.modules[0].children), ['442', '489'], name)
      return out
    })
    assert.deepEqual(results[0].modules, results[2].modules, 'the sidebar is the same before and after')
    assert.deepEqual(results[1].modules, results[2].modules)
    assert.deepEqual(results[0].owners['/signals'], results[2].owners['/signals'])
  })
})
