import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { allAreas, areaById } from './domains'
import { MODULE_INTELLIGENCE } from './modules'
import { COVERAGE_REGISTRY, displayState, isPendingDetector, registryRows, reportedUnder, summarise } from './coverage-registry'
import { buildModuleView } from './derive'
import { ALL_DETECTOR_IDS, detectorList, META, PLATFORM_DETECTOR_IDS } from './fixtures'

const ROOT = process.cwd()

function appRoutes(): Array<{ raw: string; test: (path: string) => boolean }> {
  const out: Array<{ raw: string; test: (path: string) => boolean }> = []
  const walk = (parts: string[]) => {
    for (const name of readdirSync(join(ROOT, 'app', ...parts))) {
      const full = join(ROOT, 'app', ...parts, name)
      if (statSync(full).isDirectory()) walk([...parts, name])
      else if (name === 'page.tsx') {
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

/** A route exists when a page file serves it, or (for /module/... screens) when a module content map names this exact access link. */
function routeExists(path: string): boolean {
  if (!path.startsWith('/module/')) return ROUTES.some((r) => r.test(path))
  if (ROUTES.some((r) => !r.raw.startsWith('/module/[') && r.test(path)) || CONTENT_MAPS.includes(`'${path}'`)) return true
  const line = GTG_NAVIGATION.split(/\r?\n/).find((l) => l.startsWith('export const ') && l.includes(`= '${path}'`))
  const name = line?.match(/^export const (\w+) =/)?.[1]
  return name !== undefined && CONTENT_MAPS.includes(name)
}

const EXCLUDED_IDS = ['H9', 'H10', 'H11', 'H12', 'H13', 'H14', 'H15', 'H16', 'T9', 'T10', 'T16', 'O10']

describe('the coverage registry reconciles with the matrix', () => {
  it('lists all 132 functionalities, once each, with the matrix row counts per module', () => {
    assert.equal(COVERAGE_REGISTRY.length, 132)
    assert.equal(new Set(COVERAGE_REGISTRY.map((r) => r.id)).size, 132, 'ids are unique')
    const counts: Record<string, number> = {}
    for (const r of COVERAGE_REGISTRY) counts[r.module] = (counts[r.module] ?? 0) + 1
    assert.deepEqual(counts, { organization: 12, hrms: 21, talent: 17, lms: 15, competency: 8, task: 14, crm: 32, 'platform-services': 11, 'agentic-ai': 2 })
    const prefix: Record<string, string> = { organization: 'O', hrms: 'H', talent: 'T', lms: 'L', competency: 'C', task: 'K', crm: 'S', 'platform-services': 'P', 'agentic-ai': 'A' }
    for (const r of COVERAGE_REGISTRY) assert.match(r.id, new RegExp(`^${prefix[r.module]}\\d+$`), `${r.id} is in ${r.module}`)
  })

  it('splits as 36 partial + 12 excluded + 84 not yet assessed (29 + 7 platform/agentic partial rows by contract; 29/12/91 before the new detectors report)', () => {
    const s = summarise(COVERAGE_REGISTRY)
    assert.deepEqual(s, { total: 132, partial: 36, not_assessed: 84, excluded: 12 })
    assert.equal(s.partial + s.not_assessed + s.excluded, s.total)
    // Matrix baseline: the rows that depend only on pre-existing detectors are exactly the 29 the matrix counts as partially covered.
    const baseline = COVERAGE_REGISTRY.filter((r) => r.state === 'partial' && !r.detectors.some(isPendingDetector))
    assert.equal(baseline.length, 29)
    const reportedNothing = new Set<string>()
    const shown = COVERAGE_REGISTRY.map((r) => displayState(r, reportedNothing))
    assert.equal(shown.filter((x) => x === 'partial').length, 29)
    assert.equal(shown.filter((x) => x === 'excluded').length, 12)
    assert.equal(shown.filter((x) => x === 'not_assessed').length, 91)
    const reportedAll = new Set(PLATFORM_DETECTOR_IDS)
    assert.equal(COVERAGE_REGISTRY.filter((r) => displayState(r, reportedAll) === 'partial').length, 36)
  })

  it('per-module totals match the matrix section 3.10 (with the platform/agentic rows counted as not yet assessed until they report)', () => {
    const none = new Set<string>()
    const by = (m: string) => summarise(registryRows(m).map((r) => ({ ...r, state: displayState(r, none) })))
    assert.deepEqual(by('organization'), { total: 12, partial: 2, not_assessed: 9, excluded: 1 })
    assert.deepEqual(by('hrms'), { total: 21, partial: 4, not_assessed: 9, excluded: 8 })
    assert.deepEqual(by('talent'), { total: 17, partial: 7, not_assessed: 7, excluded: 3 })
    assert.deepEqual(by('lms'), { total: 15, partial: 5, not_assessed: 10, excluded: 0 })
    assert.deepEqual(by('competency'), { total: 8, partial: 0, not_assessed: 8, excluded: 0 })
    assert.deepEqual(by('task'), { total: 14, partial: 2, not_assessed: 12, excluded: 0 })
    assert.deepEqual(by('crm'), { total: 32, partial: 9, not_assessed: 23, excluded: 0 })
    assert.deepEqual(by('platform-services'), { total: 11, partial: 0, not_assessed: 11, excluded: 0 })
    assert.deepEqual(by('agentic-ai'), { total: 2, partial: 0, not_assessed: 2, excluded: 0 })
  })

  it('every route is a verified one, and a row is never invented a route', () => {
    for (const r of COVERAGE_REGISTRY) {
      if (r.route === null) continue
      assert.match(r.route, /^\/[^/]/, r.id)
      assert.ok(routeExists(r.route), `${r.id} -> ${r.route} does not resolve to a screen`)
    }
  })

  it('every partial row names real detectors, and only partial rows name any', () => {
    const known = new Set([...ALL_DETECTOR_IDS, ...PLATFORM_DETECTOR_IDS])
    for (const r of COVERAGE_REGISTRY) {
      if (r.state === 'partial') {
        assert.ok(r.detectors.length > 0, r.id)
        for (const d of r.detectors) assert.ok(known.has(d), `${r.id}: ${d}`)
      } else assert.deepEqual(r.detectors, [], r.id)
    }
  })
})

describe('excluded domains (decision D2) never produce metrics or links', () => {
  it('exactly the twelve payroll, compensation, performance, disciplinary, offboarding and My HR pay rows are excluded', () => {
    assert.deepEqual(COVERAGE_REGISTRY.filter((r) => r.state === 'excluded').map((r) => r.id).sort(), [...EXCLUDED_IDS].sort())
  })

  it('an excluded row has no route, no detector, and is never reported under another module', () => {
    for (const r of COVERAGE_REGISTRY.filter((x) => x.state === 'excluded')) {
      assert.equal(r.route, null, r.id)
      assert.deepEqual(r.detectors, [], r.id)
      assert.deepEqual(reportedUnder(r), [], r.id)
      assert.equal(displayState(r, new Set(ALL_DETECTOR_IDS)), 'excluded', 'no detector report can change it')
    }
  })

  it('no detector, area, module link or entity link points at an excluded screen', () => {
    const forbidden = /payroll|salary|compensation|performance-reviews|offboarding|disciplinary|form-16|employee-ledger|\/my-hr/i
    for (const area of allAreas()) {
      for (const f of area.feeds) assert.doesNotMatch(f.detector, /payroll|salary|compensation|performance|offboarding|disciplin/i, f.detector)
      for (const m of area.modules) assert.doesNotMatch(m.href, forbidden, m.href)
    }
    for (const r of COVERAGE_REGISTRY.filter((x) => x.state !== 'excluded' && x.route)) assert.doesNotMatch(r.route as string, forbidden, `${r.id} ${r.route}`)
  })

  it('an excluded module still yields no metric: a view built from a snapshot with every detector ok shows no finding for it', () => {
    const view = buildModuleView({ insights: [], detectors: detectorList(), meta: META, truncated: false, total: 0 }, MODULE_INTELLIGENCE.find((m) => m.key === 'hrms')!)
    assert.deepEqual(view.areas.map((a) => a.area.id), ['attendance', 'leave'])
    assert.equal(view.insights.length, 0)
  })
})

describe('ownership: one area, one module; functionality lists are disjoint (decision D4)', () => {
  it('every area appears under at most one module', () => {
    const seen = new Map<string, string>()
    for (const m of MODULE_INTELLIGENCE) {
      for (const ref of m.areas) {
        const id = `${ref.domain}/${ref.area}`
        assert.ok(areaById(ref.domain, ref.area), id)
        assert.equal(seen.get(id), undefined, `${id} is under both ${seen.get(id)} and ${m.key}`)
        seen.set(id, m.key)
      }
    }
  })

  it('every detector-backed area is owned by exactly one module (none is orphaned)', () => {
    const owned = new Set(MODULE_INTELLIGENCE.flatMap((m) => m.areas.map((a) => `${a.domain}/${a.area}`)))
    assert.deepEqual(allAreas().filter((a) => a.domain !== 'other').map((a) => `${a.domain}/${a.id}`).filter((id) => !owned.has(id)), [])
  })

  it('each module functionality list is disjoint, and every row belongs to a registered module', () => {
    const keys = new Set(MODULE_INTELLIGENCE.map((m) => m.key as string))
    const seen = new Map<string, string>()
    for (const r of COVERAGE_REGISTRY) {
      assert.ok(keys.has(r.module), r.id)
      assert.equal(seen.get(r.id), undefined, `${r.id} listed twice`)
      seen.set(r.id, r.module)
    }
    for (const m of MODULE_INTELLIGENCE) assert.ok(registryRows(m.key).length > 0, m.key)
  })

  it('capability development moved to Talent; Capability Intelligence owns only its eight not-yet-assessed screens', () => {
    const owner = MODULE_INTELLIGENCE.find((m) => m.areas.some((a) => a.area === 'capability-development'))
    assert.equal(owner?.key, 'talent')
    assert.deepEqual(MODULE_INTELLIGENCE.find((m) => m.key === 'competency')?.areas, [])
    assert.deepEqual(registryRows('competency').map((r) => r.id), ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'])
    assert.ok(registryRows('competency').every((r) => r.state === 'not_assessed'))
    // LMS assessments belong to LMS
    assert.equal(registryRows('lms').find((r) => r.id === 'L10')?.module, 'lms')
  })

  it('a row whose detector is reported under another module says so rather than claiming it', () => {
    assert.deepEqual(reportedUnder(registryRows('lms').find((r) => r.id === 'L10')!), ['Talent Management Intelligence'])
    assert.deepEqual(reportedUnder(registryRows('lms').find((r) => r.id === 'L5')!), [])
  })

  it('Agentic AI and Platform Services are separate modules with separate areas', () => {
    const agentic = MODULE_INTELLIGENCE.find((m) => m.key === 'agentic-ai')!
    const platform = MODULE_INTELLIGENCE.find((m) => m.key === 'platform-services')!
    assert.deepEqual(agentic.areas.map((a) => a.area), ['agentic-runs'])
    assert.deepEqual(platform.areas.map((a) => a.area), ['scheduler-reliability', 'integration-status', 'event-delivery', 'ai-usage', 'governance'])
    assert.equal(platform.title, 'Platform Services')
  })
})
