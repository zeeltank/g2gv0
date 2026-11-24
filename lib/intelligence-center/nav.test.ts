import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { INTELLIGENCE_LINK, isGlobalIntelligencePath, isIntelligencePath, isModuleIntelligencePath, moduleIntelligencePath } from './nav'
import { moduleIntelligenceByKey, moduleIntelligenceHref } from './modules'

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8')

describe('where Intelligence is reached from', () => {
  it('is current for /intelligence and every page below it, and nothing else', () => {
    assert.equal(INTELLIGENCE_LINK, '/intelligence')
    assert.equal(isIntelligencePath('/intelligence'), true)
    assert.equal(isIntelligencePath('/intelligence/people-workforce'), true)
    assert.equal(isIntelligencePath('/intelligence/people-workforce/attendance/abc'), true)
    assert.equal(isIntelligencePath('/intelligence-extra'), false)
    assert.equal(isIntelligencePath('/dashboard'), false)
    assert.equal(isIntelligencePath('/platform-services/workflow'), false)
    assert.equal(isIntelligencePath(null), false)
    assert.equal(isIntelligencePath(undefined), false)
    assert.equal(isGlobalIntelligencePath('/intelligence'), true)
    assert.equal(isGlobalIntelligencePath('/intelligence/people-workforce/attendance'), true)
    assert.equal(isGlobalIntelligencePath('/intelligence/module/hrms'), false)
    assert.equal(moduleIntelligencePath('hrms'), '/intelligence/module/hrms')
    assert.equal(moduleIntelligenceHref('hrms'), '/intelligence/module/hrms')
    for (const [key, path] of [
      ['organization', '/intelligence/module/organization'],
      ['hrms', '/intelligence/module/hrms'],
      ['talent', '/intelligence/module/talent'],
      ['lms', '/intelligence/module/lms'],
      ['competency', '/intelligence/module/competency'],
      ['task', '/intelligence/module/task'],
      ['crm', '/intelligence/module/crm'],
      ['platform-services', '/intelligence/module/platform-services'],
      ['agentic-ai', '/intelligence/module/agentic-ai'],
    ] as const) {
      assert.equal(moduleIntelligenceHref(key), path)
    }
    assert.equal(isModuleIntelligencePath('/intelligence/module/hrms', 'hrms'), true)
    assert.equal(isModuleIntelligencePath('/intelligence/module/hrms', 'talent'), false)
  })

  it('is NOT added to the sidebar: the sidebar hook is exactly what the server sent', () => {
    const hook = read('hooks', 'use-sidebar-navigation.ts')
    // (the hook mentions "Intelligence" in two older comments about other modules; what must be absent is any Intelligence entry or helper)
    assert.doesNotMatch(hook, /intelligence-center|withIntelligenceNav|INTELLIGENCE_NAV|['"`]\/intelligence['"`/]/)
  })

  it('shows exactly one Intelligence item: Global only with no module scope, otherwise only the active module’s', () => {
    const bar = read('components', 'shell', 'platform-services-subheader.tsx')
    assert.match(bar, /isGlobalIntelligencePath\(pathname\)/)
    assert.match(bar, /href=\{INTELLIGENCE_LINK\}/)
    assert.match(bar, /moduleIntelligenceHref\(intelligenceModuleKey\)/)
    assert.match(bar, /isModuleIntelligencePath\(pathname, intelligenceModuleKey\)/)
    // the Global link is rendered only when there is no module scope
    assert.match(bar, /\{!moduleKey && !intelligenceModuleKey && \(\s*<Link\s+href=\{INTELLIGENCE_LINK\}/)
  })

  it('under /platform-services with no other module scope the single link is Platform Services Intelligence, never Global', () => {
    const bar = read('components', 'shell', 'platform-services-subheader.tsx')
    assert.match(bar, /pathname === '\/platform-services' \|\| pathname\?\.startsWith\('\/platform-services\/'\)/)
    assert.match(bar, /\(onPlatformServices \? 'platform-services' : null\)/)
    // it only applies without module scope, and the Global link stays gated on "no module scope AND no module Intelligence"
    assert.match(bar, /const onPlatformServices = !moduleKey && /)
    assert.match(bar, /\{!moduleKey && !intelligenceModuleKey && \(\s*<Link\s+href=\{INTELLIGENCE_LINK\}/)
    assert.equal(moduleIntelligenceByKey('platform-services')?.title, 'Platform Services')
    assert.equal(`${moduleIntelligenceByKey('platform-services')?.title} Intelligence`, 'Platform Services Intelligence')
    assert.equal(moduleIntelligenceHref('platform-services'), '/intelligence/module/platform-services')
    assert.equal(isModuleIntelligencePath('/intelligence/module/platform-services', 'platform-services'), true)
    assert.equal(isGlobalIntelligencePath('/intelligence/module/platform-services'), false)
  })

  it('the Main Dashboard (no module scope, not under /platform-services) shows Global Intelligence only', () => {
    const bar = read('components', 'shell', 'platform-services-subheader.tsx')
    // Global is rendered by exactly one element; the module link by exactly one; they cannot both render (Global needs !intelligenceModuleKey)
    assert.equal((bar.match(/href=\{INTELLIGENCE_LINK\}/g) ?? []).length, 1)
    assert.equal((bar.match(/href=\{moduleIntelligenceHref\(intelligenceModuleKey\)\}/g) ?? []).length, 1)
  })

  it('module Intelligence pages do not link back to Global Intelligence', () => {
    const view = read('components', 'domain', 'intelligence', 'module-view.tsx')
    assert.doesNotMatch(view, />\s*Global Intelligence\s*</)
    assert.doesNotMatch(view, /Back to Global Intelligence<\/BackLink>/)
  })

  it('does not resolve Intelligence URLs as the first menu module or render its root breadcrumb', () => {
    const shell = read('components', 'shell', 'gtg-app-shell.tsx')
    assert.match(shell, /if \(isIntelligencePath\(pathname\)\)\s*\{\s*setActive\(null\)/)
    assert.match(shell, /isIntelligencePath\(pathname\) \? \[\] : resolveBreadcrumb/)
    assert.doesNotMatch(shell, /router\.(?:push|replace)\(['"`]\/['"`]\)/)
  })

  it('keeps module deep links direct and uses Next links so browser history is preserved', () => {
    const bar = read('components', 'shell', 'platform-services-subheader.tsx')
    const route = read('app', 'intelligence', 'module', '[module]', 'page.tsx')
    assert.match(bar, /<Link[\s\S]*?href=\{moduleIntelligenceHref\(intelligenceModuleKey\)\}/)
    assert.doesNotMatch(bar, /window\.location\.(?:assign|replace)|router\.replace/)
    assert.match(route, /params/)
    assert.doesNotMatch(route, /redirect\(['"`]\/['"`]\)/)
  })
})
