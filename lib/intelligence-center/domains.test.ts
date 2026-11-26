import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  allAreas,
  allModuleLinks,
  ALL_DOMAINS,
  areaById,
  areaHref,
  CONNECTED_VIEWS,
  classifyInsight,
  decodeSegment,
  stableKey,
  domainById,
  domainHref,
  DOMAINS,
  HOME_HREF,
  insightHref,
  KNOWN_DETECTORS,
  OTHER_AREA,
} from './domains'
import { ALL_DETECTOR_IDS, PLATFORM_DETECTOR_IDS } from './fixtures'
import { LINKABLE_ENTITY_TYPES, entityModule, KNOWN_ENTITY_TYPES } from './entity-links'
import { MODULE_INTELLIGENCE, moduleIntelligenceHref } from './modules'

const ROOT = process.cwd()

/** Every page route under app/, as a matcher (a [segment] matches one path segment). */
function appRoutes(): Array<{ raw: string; test: (path: string) => boolean }> {
  const out: Array<{ raw: string; test: (path: string) => boolean }> = []
  const walk = (parts: string[]) => {
    for (const name of readdirSync(join(ROOT, 'app', ...parts))) {
      const full = join(ROOT, 'app', ...parts, name)
      if (statSync(full).isDirectory()) {
        walk([...parts, name])
      } else if (name === 'page.tsx') {
        const pattern = parts.map((p) => (/^\[.+\]$/.test(p) ? '[^/]+' : p.replace(/[.*+?^${}()|\\]/g, '\\$&'))).join('/')
        const re = new RegExp(`^/${pattern}$`)
        out.push({ raw: `/${parts.join('/')}`, test: (path) => re.test(path) })
      }
    }
  }
  walk([])
  return out
}

const ROUTES = appRoutes()

const GTG_NAVIGATION = readFileSync(join(ROOT, 'lib', 'gtg-navigation.ts'), 'utf8')

const CONTENT_MAPS = readdirSync(join(ROOT, 'hooks'))
  .filter((f) => /^content-map.*\.ts$/.test(f))
  .map((f) => readFileSync(join(ROOT, 'hooks', f), 'utf8'))
  .join('\n')

/**
 * A route exists when a page file serves it, or (for /module/... screens, which the generic catch-all would answer for ANY address) when a module
 * content map names this exact access link.
 */
function routeExists(path: string): boolean {
  const clean = path.split('?')[0]
  if (!clean.startsWith('/module/')) return ROUTES.some((r) => r.test(clean))
  const ownPage = ROUTES.some((r) => !r.raw.startsWith('/module/[') && r.test(clean))
  if (ownPage || CONTENT_MAPS.includes(`'${clean}'`)) return true
  // Many access links are constants in lib/gtg-navigation.ts that a content map then uses: the constant must be used by a map.
  const line = GTG_NAVIGATION.split(/\r?\n/).find((l) => l.startsWith('export const ') && l.includes(`= '${clean}'`))
  const name = line?.match(/^export const (\w+) =/)?.[1]
  return name !== undefined && CONTENT_MAPS.includes(name)
}

describe('the domain taxonomy', () => {
  it('has the seven domains, each with a title, a one-sentence purpose and an icon', () => {
    assert.deepEqual(DOMAINS.map((d) => d.id), ['people-workforce', 'talent-onboarding', 'capability-learning', 'work-execution', 'revenue-pipeline', 'market-signals', 'platform-governance'])
    for (const d of DOMAINS) {
      assert.ok(d.title.length > 3)
      assert.match(d.monitors, /\.$/)
      assert.ok(d.icon)
    }
  })

  it('places every known detector, each in exactly one DOMAIN (deal health is split across two areas of one domain, by surface)', () => {
    // The 15 original detectors plus the 6 platform/agentic detectors named by contract with the backend.
    const EVERY = [...ALL_DETECTOR_IDS, ...PLATFORM_DETECTOR_IDS]
    assert.deepEqual([...KNOWN_DETECTORS].sort(), [...EVERY].sort())
    for (const id of EVERY) {
      const areas = allAreas().filter((a) => a.feeds.some((f) => f.detector === id))
      assert.ok(areas.length >= 1, `${id} has an area`)
      assert.equal(new Set(areas.map((a) => a.domain)).size, 1, `${id} is in one domain`)
      if (id !== 'commercial.deal_health') assert.equal(areas.length, 1, `${id} is in exactly one area`)
    }
    assert.deepEqual(allAreas().filter((a) => a.feeds.some((f) => f.detector === 'commercial.deal_health')).map((a) => a.id), ['crm-opportunities', 'gtm-deals-pipeline'])
  })

  it('maps the areas to the detectors the brief names', () => {
    const feeds = (domain: string, area: string) => areaById(domain, area)?.feeds.map((f) => f.detector)
    assert.deepEqual(feeds('people-workforce', 'attendance'), ['hr.attendance_health'])
    assert.deepEqual(feeds('people-workforce', 'leave'), ['hr.leave_attention'])
    assert.deepEqual(feeds('people-workforce', 'organisation-structure'), ['hr.organisation_structure'])
    assert.deepEqual(feeds('talent-onboarding', 'recruitment'), ['hr.recruitment_funnel'])
    assert.deepEqual(feeds('talent-onboarding', 'onboarding-probation'), ['hr.onboarding_probation'])
    assert.deepEqual(feeds('capability-learning', 'certifications'), ['hr.certification_expiry'])
    assert.deepEqual(feeds('capability-learning', 'learning-assignments'), ['hr.learning_assignments'])
    assert.deepEqual(feeds('capability-learning', 'capability-development'), ['hr.capability_development'])
    assert.deepEqual(feeds('work-execution', 'tasks-workflow'), ['hr.task_workflow'])
    assert.deepEqual(feeds('revenue-pipeline', 'gtm-deals-pipeline'), ['commercial.deal_health', 'commercial.pipeline_attention'])
    assert.deepEqual(feeds('revenue-pipeline', 'customers-renewals'), ['commercial.customer_renewals'])
    assert.deepEqual(feeds('revenue-pipeline', 'invoices'), ['commercial.invoice_attention'])
    assert.deepEqual(feeds('market-signals', 'evidence-quality'), ['commercial.signal_evidence_quality'])
    assert.deepEqual(feeds('market-signals', 'research-yield'), ['commercial.signal_yield'])
  })

  it('Platform, AI & Governance maps the six platform/agentic detectors into six pending areas and lists what has no detector', () => {
    const d = domainById('platform-governance')!
    assert.equal(d.notConnected, false, 'it is no longer "not connected": its checks exist, and are not yet assessed until they report')
    assert.deepEqual(d.areas.map((a) => a.id), ['scheduler-reliability', 'integration-status', 'event-delivery', 'ai-usage', 'governance', 'agentic-runs'])
    assert.deepEqual(d.areas.flatMap((a) => a.feeds.map((f) => f.detector)), PLATFORM_DETECTOR_IDS)
    assert.ok(d.areas.every((a) => a.pending === true))
    assert.deepEqual(d.covers.map((c) => c.label), ['Platform Services hub', 'Workflows', 'Communications', 'Documents', 'Reports (Sales & Marketing)', 'Reports (Learning)'])
    for (const other of DOMAINS.filter((x) => x.id !== 'platform-governance')) assert.equal(other.notConnected, false)
    assert.deepEqual(classifyInsight({ detector: 'platform.scheduler_reliability' }), { domain: 'platform-governance', area: 'scheduler-reliability' })
    assert.deepEqual(classifyInsight({ detector: 'agentic.run_health' }), { domain: 'platform-governance', area: 'agentic-runs' })
  })

  it('classifies by detector id first', () => {
    assert.deepEqual(classifyInsight({ detector: 'hr.leave_attention', surfaces: ['attendance'] }), { domain: 'people-workforce', area: 'leave' })
    assert.deepEqual(classifyInsight({ detector: 'commercial.invoice_attention', surfaces: [] }), { domain: 'revenue-pipeline', area: 'invoices' })
    assert.deepEqual(classifyInsight({ detector: 'commercial.signal_evidence_quality', surfaces: ['signals', 'signal_review'] }), { domain: 'market-signals', area: 'evidence-quality' })
  })

  it('splits deal health by surface: CRM opportunities when the insight carries crm_opportunities, GTM deals otherwise', () => {
    assert.deepEqual(classifyInsight({ detector: 'commercial.deal_health', surfaces: ['crm_opportunities'] }), { domain: 'revenue-pipeline', area: 'crm-opportunities' })
    assert.deepEqual(classifyInsight({ detector: 'commercial.deal_health', surfaces: ['gtm_deals', 'gtm_command_center'] }), { domain: 'revenue-pipeline', area: 'gtm-deals-pipeline' })
    assert.deepEqual(classifyInsight({ detector: 'commercial.deal_health', surfaces: [] }), { domain: 'revenue-pipeline', area: 'gtm-deals-pipeline' })
  })

  it('uses the surface second, for a detector it does not know, and puts what fits nowhere under Other findings (never dropped)', () => {
    assert.deepEqual(classifyInsight({ detector: 'hr.brand_new', surfaces: ['tasks'] }), { domain: 'work-execution', area: 'tasks-workflow' })
    assert.deepEqual(classifyInsight({ detector: 'x.unknown', surfaces: ['hr_dashboard'] }), { domain: 'other', area: OTHER_AREA.id })
    assert.deepEqual(classifyInsight({ detector: 'x.unknown' }), { domain: 'other', area: OTHER_AREA.id })
  })

  it('every area of every domain has a unique id and real feeds or surfaces', () => {
    const ids = allAreas().map((a) => `${a.domain}/${a.id}`)
    assert.equal(new Set(ids).size, ids.length)
    for (const a of allAreas().filter((x) => x.domain !== 'other')) assert.ok(a.feeds.length > 0 && a.surfaces.length > 0, a.id)
  })

  it('the connected views name only areas that exist', () => {
    for (const chain of CONNECTED_VIEWS) {
      assert.equal(chain.stages.length, 5)
      for (const stage of chain.stages) {
        assert.ok(domainById(stage.domain), stage.label)
        if (stage.area) assert.ok(areaById(stage.domain, stage.area), stage.label)
      }
    }
    assert.deepEqual(CONNECTED_VIEWS.map((c) => c.title), ['Revenue-related checks', 'People-capacity-related checks'])
  })
})

describe('stable finding keys', () => {
  const server = 'hr.leave_attention:org:t17:org0:leave:2026-11-24'

  it('removes the tenant segment and the trailing date, and keeps everything else', () => {
    assert.equal(stableKey(server), 'hr.leave_attention:org:org0:leave')
    assert.equal(stableKey('commercial.deal_health:crm:t3:team9:quiet:2026-11-24T00:00'), 'commercial.deal_health:crm:team9:quiet')
    assert.equal(stableKey('hr.certification_expiry:org:2026-11'), 'hr.certification_expiry:org:2026-11', 'a month is not a day: kept')
    assert.equal(stableKey('plain'), 'plain')
    assert.equal(stableKey(stableKey(server)), stableKey(server), 'idempotent')
  })

  it('the generated href never carries the tenant segment or the date', () => {
    const href = insightHref('people-workforce', 'leave', server)
    assert.equal(href, '/intelligence/people-workforce/leave/hr.leave_attention%3Aorg%3Aorg0%3Aleave')
    assert.doesNotMatch(decodeURIComponent(href), /:t\d+|\d{4}-\d{2}-\d{2}/)
  })

  it('the same finding on another day has the same address (a bookmark survives midnight)', () => {
    const today = insightHref('people-workforce', 'leave', server)
    const tomorrow = insightHref('people-workforce', 'leave', server.replace('2026-11-24', '2026-11-25'))
    assert.equal(today, tomorrow)
  })
})

describe('links', () => {
  it('builds Intelligence addresses and encodes the finding key', () => {
    assert.equal(HOME_HREF, '/intelligence')
    assert.equal(domainHref('people-workforce'), '/intelligence/people-workforce')
    assert.equal(areaHref('people-workforce', 'leave'), '/intelligence/people-workforce/leave')
    assert.equal(insightHref('people-workforce', 'leave', 'hr.leave_attention:org:2026-11'), '/intelligence/people-workforce/leave/hr.leave_attention%3Aorg%3A2026-11')
    assert.equal(decodeSegment('hr.leave_attention%3Aorg%3A2026-11'), 'hr.leave_attention:org:2026-11')
    assert.equal(decodeSegment('100%'), '100%', 'a malformed escape does not throw')
  })

  it('every Intelligence page the taxonomy can link to exists as a route under app/intelligence', () => {
    const exists = (path: string) => ROUTES.some((r) => r.test(path))
    assert.ok(exists('/intelligence'))
    for (const d of ALL_DOMAINS) {
      assert.ok(exists(domainHref(d.id)), domainHref(d.id))
      for (const a of d.areas) {
        assert.ok(exists(areaHref(d.id, a.id)), areaHref(d.id, a.id))
        assert.ok(exists(insightHref(d.id, a.id, 'some:key')), 'insight page')
      }
    }
  })

  it('every registered parent module has a dedicated Intelligence route and detector-backed submodule map', () => {
    assert.deepEqual(MODULE_INTELLIGENCE.map((m) => m.key), ['organization', 'hrms', 'talent', 'lms', 'competency', 'task', 'crm', 'platform-services', 'agentic-ai'])
    for (const moduleDef of MODULE_INTELLIGENCE) {
      const href = moduleIntelligenceHref(moduleDef.key)
      assert.ok(ROUTES.some((r) => r.test(href.split('?')[0])), href)
      // Capability Intelligence is the one module with no detector at all (its eight screens are Not Yet Assessed rows in the coverage registry).
      if (moduleDef.key === 'competency') assert.equal(moduleDef.areas.length, 0)
      else assert.ok(moduleDef.areas.length > 0, `${moduleDef.key} has explicit detector-backed areas`)
      for (const ref of moduleDef.areas) assert.ok(areaById(ref.domain, ref.area), `${moduleDef.key}: ${ref.domain}/${ref.area}`)
    }
  })

  it('every module link is a real screen: a page under app/, or an access link a module content map serves', () => {
    const links = allModuleLinks()
    assert.ok(links.length > 20)
    for (const l of links) assert.match(l.href, /^\/[^/]/, l.href)
    assert.deepEqual(links.filter((l) => !routeExists(l.href)).map((l) => `${l.label} -> ${l.href}`), [], 'links that do not resolve to a screen')
  })

  it('every record link the entity map can build points at a page that exists, and every unlinked kind has a verified module to find it in', () => {
    assert.deepEqual([...LINKABLE_ENTITY_TYPES].sort(), ['crm_invoice', 'crm_opportunity', 'department'])
    assert.ok(ROUTES.some((r) => r.test('/module/crm/sales/opportunities/12')))
    assert.ok(ROUTES.some((r) => r.test('/module/crm/sales/invoices/12')))
    assert.ok(ROUTES.some((r) => r.test('/organization/departments/12')))
    for (const type of KNOWN_ENTITY_TYPES) {
      const m = entityModule(type)
      assert.ok(m, type)
      assert.ok(routeExists(m.href), `${type} -> ${m.href}`)
    }
  })
})
