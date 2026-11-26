import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CRM_PATH_PREFIXES, isCrmPath, moduleIdForPlatformKey, platformKeyForMenuLink } from './module-scope'

/**
 * Which Platform Services module a screen belongs to, from the menu link and the address alone. The bug this guards:
 * Sales & Marketing had no AI Stack descriptor, so its key was null and the top bar showed the central "Platform
 * services" view instead of its own module, unlike Organization.
 */
describe('platformKeyForMenuLink', () => {
  it('names Sales & Marketing from its level-1 link, the row the bar used to miss', () => {
    assert.equal(platformKeyForMenuLink('/module/crm'), 'crm')
    assert.equal(platformKeyForMenuLink('/module/crm/marketing/leads'), 'crm')
  })

  it('still names the six modules that already worked', () => {
    assert.equal(platformKeyForMenuLink('/module/organizational-management'), 'organization')
    assert.equal(platformKeyForMenuLink('/module/hrit-solutions'), 'hrms')
    assert.equal(platformKeyForMenuLink('/module/talent-management'), 'talent')
    assert.equal(platformKeyForMenuLink('/module/lms'), 'lms')
    assert.equal(platformKeyForMenuLink('/module/capability-intelligence'), 'competency')
    assert.equal(platformKeyForMenuLink('/module/task-management'), 'task')
  })

  it('answers null for a module outside Platform Services and for nothing at all, never a guess', () => {
    assert.equal(platformKeyForMenuLink('/module/main-dashboard'), null)
    assert.equal(platformKeyForMenuLink('/module/agentic-ai/agentic-library'), null)
    assert.equal(platformKeyForMenuLink('/gtm/outreach'), null)
    assert.equal(platformKeyForMenuLink(''), null)
    assert.equal(platformKeyForMenuLink(null), null)
    assert.equal(platformKeyForMenuLink(undefined), null)
  })

  it('does not take a module whose slug merely starts like another (crm-archive is not crm)', () => {
    assert.equal(platformKeyForMenuLink('/module/crm-archive'), null)
    assert.equal(platformKeyForMenuLink('/module/lmsx'), null)
  })
})

describe('isCrmPath', () => {
  it('is true for the GTM screens, Market Signals and its family, and anything under /module/crm', () => {
    for (const path of ['/gtm/outreach', '/gtm/command-center', '/signals', '/signals/portfolio', '/ingestion', '/portfolio', '/partners', '/module/crm', '/module/crm/sales/quotes']) {
      assert.equal(isCrmPath(path), true, path)
    }
  })

  it('is true for the prefix itself, and false for a path that only starts with the same letters', () => {
    assert.equal(isCrmPath('/gtm'), true)
    assert.equal(isCrmPath('/gtmx'), false)
    assert.equal(isCrmPath('/signals-archive'), false)
    assert.equal(isCrmPath('/module/crmx'), false)
  })

  it('is false for every other module and for no path', () => {
    for (const path of ['/module/organizational-management/user-management', '/platform-services/workflow', '/dashboard', '/ai/providers', '/']) {
      assert.equal(isCrmPath(path), false, path)
    }
    assert.equal(isCrmPath(''), false)
    assert.equal(isCrmPath(null), false)
    assert.equal(isCrmPath(undefined), false)
  })

  it('keeps its prefixes to whole path segments, so no entry can swallow a neighbour', () => {
    for (const prefix of CRM_PATH_PREFIXES) {
      assert.ok(prefix.startsWith('/'), prefix)
      assert.ok(!prefix.endsWith('/'), prefix)
    }
  })
})

describe('moduleIdForPlatformKey', () => {
  const tree = [
    { id: '1', accessLink: '/module/organizational-management' },
    { id: '199', accessLink: '/module/crm' },
    { id: '300', accessLink: null },
    { id: '301' },
  ]

  it('finds the menu id of the module, which is how AI Stack opens the module\'s own page from a Platform Services URL', () => {
    assert.equal(moduleIdForPlatformKey(tree, 'crm'), '199')
    assert.equal(moduleIdForPlatformKey(tree, 'organization'), '1')
  })

  it('answers null when the tree has no such module, never another module\'s id', () => {
    assert.equal(moduleIdForPlatformKey(tree, 'hrms'), null)
    assert.equal(moduleIdForPlatformKey([], 'crm'), null)
  })
})
